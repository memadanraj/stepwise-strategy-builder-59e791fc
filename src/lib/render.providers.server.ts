export type RenderManifest = {
  projectId: string; width: number; height: number; fps: number; format: string;
  scenes: any[]; tracks: any[]; clips: any[]; captions: any[]; assets: any[];
};
export type RenderSubmitResult = { providerJobId: string };
export type RenderStatus = {
  status: "queued" | "processing" | "completed" | "failed";
  progress: number; outputUrl?: string; error?: string;
};
export interface RenderProvider {
  submit(manifest: RenderManifest): Promise<RenderSubmitResult>;
  status(providerJobId: string): Promise<RenderStatus>;
}

const AUDIO_TRACKS = new Set(["audio", "voice", "music", "sfx"]);

function asNumber(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Convert our render manifest into a Shotstack edit. */
export function toShotstackEdit(m: RenderManifest) {
  const assetById = new Map(m.assets.map((a: any) => [a.id, a]));
  const trackById = new Map(m.tracks.map((t: any) => [t.id, t]));
  const visual: any[] = [];
  const audio: any[] = [];

  for (const c of m.clips) {
    const a: any = c.asset_id ? assetById.get(c.asset_id) : null;
    if (!a?.url) continue;
    const t: any = trackById.get(c.track_id);
    if (t?.muted || t?.visible === false) continue;

    const start = Math.max(0, asNumber(c.start_seconds, 0));
    const length = Math.max(0.1, asNumber(c.duration_seconds, 1));
    const isAudio = AUDIO_TRACKS.has(t?.track_type) || ["audio", "voice", "music", "sfx"].includes(a.kind);

    if (isAudio) {
      audio.push({
        asset: {
          type: "audio",
          src: a.url,
          trim: Math.max(0, asNumber(c.source_start_seconds, 0)),
        },
        start,
        length,
        volume: asNumber(c.volume, 1) * asNumber(t?.volume, 1),
      });
    } else {
      visual.push({
        asset: a.kind === "video"
          ? { type: "video", src: a.url, trim: Math.max(0, asNumber(c.source_start_seconds, 0)) }
          : { type: "image", src: a.url },
        start,
        length,
        fit: "cover",
        opacity: Math.max(0, Math.min(1, asNumber(c.opacity, 1))),
      });
    }
  }

  // The second repo does not yet include the full Phase 09 timeline UI.
  // This fallback makes Phase 10 useful immediately by rendering scenes in order.
  if (visual.length === 0) {
    let t = 0;
    for (const s of m.scenes) {
      const length = Math.max(1, asNumber(s.duration_seconds, 5));
      const src = s.clip_url || s.image_url;
      if (!src) continue;
      visual.push({
        asset: s.clip_url
          ? { type: "video", src: s.clip_url }
          : { type: "image", src: s.image_url },
        start: t,
        length,
        fit: "cover",
        effect: s.clip_url ? undefined : "zoomInSlow",
      });
      t += length;
    }
  }

  if (visual.length === 0) throw new Error("Nothing to render — generate scene images or clips first.");

  const captions = m.captions
    .filter((c: any) => c.text?.trim())
    .map((c: any) => ({
      asset: {
        type: "title",
        text: c.text,
        style: "subtitle",
        size: "small",
        position: c.position === "top" ? "top" : c.position === "center" ? "center" : "bottom",
      },
      start: Math.max(0, asNumber(c.start_seconds, 0)),
      length: Math.max(0.2, asNumber(c.end_seconds, 0) - asNumber(c.start_seconds, 0)),
    }));

  const tracks = [captions, visual, audio].filter((clips) => clips.length).map((clips) => ({ clips }));
  return {
    timeline: { background: "#000000", tracks },
    output: {
      format: "mp4",
      fps: m.fps || 30,
      size: { width: m.width, height: m.height },
    },
  };
}

export class ShotstackRenderProvider implements RenderProvider {
  constructor(private apiKey: string, private env: string) {}

  private base() {
    return `https://api.shotstack.io/edit/${this.env}`;
  }

  async submit(m: RenderManifest) {
    const r = await fetch(`${this.base()}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": this.apiKey },
      body: JSON.stringify(toShotstackEdit(m)),
    });
    const j: any = await r.json().catch(() => ({}));

    if (!r.ok || !j?.response?.id) {
      console.error("Shotstack submit failed", r.status, j);
      throw new Error(
        r.status === 403 || r.status === 401
          ? "Shotstack rejected the API key."
          : `Shotstack couldn't start the render (${j?.message || r.status}).`,
      );
    }

    return { providerJobId: j.response.id as string };
  }

  async status(id: string): Promise<RenderStatus> {
    const r = await fetch(`${this.base()}/render/${encodeURIComponent(id)}`, {
      headers: { "x-api-key": this.apiKey },
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`Shotstack status failed (${r.status})`);

    const s = String(j.response?.status || "queued");
    const progress: Record<string, number> = {
      queued: 5, fetching: 20, rendering: 60, saving: 90, done: 100,
    };

    if (s === "done") return { status: "completed", progress: 100, outputUrl: j.response.url };
    if (s === "failed") return { status: "failed", progress: 0, error: j.response?.error || "Render failed" };
    return {
      status: s === "queued" ? "queued" : "processing",
      progress: progress[s] ?? 50,
    };
  }
}

export function getRenderProvider(): RenderProvider | null {
  const key = process.env["SHOTSTACK_API_KEY"];
  if (key) return new ShotstackRenderProvider(key, process.env["SHOTSTACK_ENV"] || "stage");

  const url = process.env["RENDERER_URL"];
  if (!url) return null;

  return new HttpRenderProvider(url, process.env["RENDERER_API_KEY"]);
}

export class HttpRenderProvider implements RenderProvider {
  constructor(private baseUrl: string, private apiKey?: string) {}

  private headers() {
    return {
      "Content-Type": "application/json",
      ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
    };
  }

  async submit(manifest: RenderManifest) {
    const r = await fetch(`${this.baseUrl.replace(/\/$/, "")}/jobs`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ manifest }),
    });
    if (!r.ok) throw new Error(`Renderer submit failed (${r.status})`);
    const j: any = await r.json();
    if (!j.id && !j.jobId) throw new Error("Renderer returned no job id");
    return { providerJobId: j.id || j.jobId };
  }

  async status(id: string): Promise<RenderStatus> {
    const r = await fetch(`${this.baseUrl.replace(/\/$/, "")}/jobs/${encodeURIComponent(id)}`, {
      headers: this.headers(),
    });
    if (!r.ok) throw new Error(`Renderer status failed (${r.status})`);
    const j: any = await r.json();
    const raw = String(j.status || "processing");
    const status: RenderStatus["status"] =
      raw === "succeeded" || raw === "success" ? "completed"
      : raw === "error" ? "failed"
      : raw === "queued" ? "queued"
      : "processing";
    return {
      status,
      progress: Number(j.progress ?? 0),
      outputUrl: j.output_url || j.outputUrl || j.url,
      error: j.error?.message || j.error,
    };
  }
}
