import { useState, type ChangeEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AudioLines, Loader2, Play, RefreshCw, Sparkles, Music2, SlidersHorizontal, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generateSceneVoiceover, previewVoice, syncElevenLabsVoices, generateMusicTrack } from "@/lib/audio.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Tables } from "@/integrations/supabase/types";

const db: any = supabase;

export function AudioPanel({ project }: { project: Tables<"projects"> }) {
  const qc = useQueryClient();
  const sync = useServerFn(syncElevenLabsVoices);
  const music = useServerFn(generateMusicTrack);
  const { data: scenes = [] } = useQuery({
    queryKey: ["scenes", project.id],
    queryFn: async () => {
      const r = await db.from("scenes").select("*").eq("project_id", project.id).order("position");
      if (r.error) throw r.error;
      return r.data || [];
    },
  });
  const { data: voices = [] } = useQuery({
    queryKey: ["voices"],
    queryFn: async () => {
      const r = await db.from("voices").select("*").eq("status", "active").order("name");
      if (r.error) throw r.error;
      return r.data || [];
    },
  });
  const { data: tracks = [] } = useQuery({
    queryKey: ["music_tracks", project.id],
    queryFn: async () => {
      const r = await db.from("music_tracks").select("*").eq("project_id", project.id).order("created_at", { ascending: false });
      return r.data || [];
    },
  });

  const [syncing, setSyncing] = useState(false);

  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["scenes", project.id] }),
      qc.invalidateQueries({ queryKey: ["voices"] }),
      qc.invalidateQueries({ queryKey: ["music_tracks", project.id] }),
      qc.invalidateQueries({ queryKey: ["scene_audio", project.id] }),
      qc.invalidateQueries({ queryKey: ["profile"] }),
    ]);
  }

  const narrated = scenes.filter((scene: any) => scene.narration?.trim()).length;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-signal/20 bg-signal/5 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-signal/10 text-signal">
            <AudioLines className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-signal">Audio workflow</p>
            <h2 className="mt-1 text-xl font-bold">Give the video a voice and a bed</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Generate scene narration first, then add an instrumental bed. Mix settings here flow into the timeline.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:min-w-36">
            <Stat n={voices.length} l="Voices" />
            <Stat n={tracks.length} l="Music beds" />
          </div>
        </div>
      </section>

      <MusicComposer project={project} tracks={tracks} generate={music} refresh={refresh} />

      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <AudioLines className="size-4 text-signal" />
              <h2 className="font-semibold">Scene narration</h2>
            </div>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {narrated} of {scenes.length} scenes have narration text. Generate a voiceover when the wording feels ready.
            </p>
          </div>
          <Button
            variant="panel"
            size="sm"
            disabled={syncing}
            onClick={async () => {
              setSyncing(true);
              try {
                const r = await sync();
                if (!r.ok) toast.error(r.error);
                else toast.success(`Synced ${r.count} ElevenLabs voices`);
                await refresh();
              } catch (e: any) {
                toast.error(e.message);
              } finally {
                setSyncing(false);
              }
            }}
          >
            {syncing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            {syncing ? "Syncing…" : "Sync voices"}
          </Button>
        </div>

        {scenes.length === 0 ? (
          <Empty>Create scenes first, then return here to generate narration.</Empty>
        ) : (
          <div className="space-y-3">
            {scenes.map((scene: any, index: number) => (
              <SceneAudio key={scene.id} scene={scene} index={index} project={project} voices={voices} refresh={refresh} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ n, l }: { n: number; l: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="font-mono text-[10px] uppercase text-muted-foreground">{l}</p>
      <p className="mt-1 text-xl font-semibold">{n}</p>
    </div>
  );
}

function SceneAudio({
  scene,
  index,
  project,
  voices,
  refresh,
}: {
  scene: any;
  index: number;
  project: any;
  voices: any[];
  refresh: () => Promise<void>;
}) {
  const gen = useServerFn(generateSceneVoiceover);
  const preview = useServerFn(previewVoice);
  const [voice, setVoice] = useState(voices[0]?.id || "");
  const [busy, setBusy] = useState("");
  const [url, setUrl] = useState("");

  async function run(kind: "generate" | "preview") {
    setBusy(kind);
    try {
      const fn = kind === "generate" ? gen : preview;
      const r = kind === "generate"
        ? await fn({ data: { projectId: project.id, sceneId: scene.id, voiceId: voice } })
        : await fn({ data: { projectId: project.id, voiceId: voice } });
      if (!r.ok) toast.error(r.error);
      else {
        setUrl(r.url);
        toast.success(kind === "generate" ? "Voiceover ready" : "Preview ready");
        await refresh();
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy("");
    }
  }

  async function saveMix(e: ChangeEvent<HTMLInputElement>) {
    const value = Number(e.target.value);
    await db.from("scene_audio").upsert({
      project_id: project.id,
      scene_id: scene.id,
      voice_volume: value,
      updated_at: new Date().toISOString(),
    }, { onConflict: "scene_id" });
    toast.success("Voice volume saved");
  }

  const hasNarration = !!scene.narration?.trim();

  return (
    <article className="rounded-2xl border border-border bg-surface-raised p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 gap-3">
          <span className="mt-0.5 font-mono text-xs text-signal">{String(index + 1).padStart(2, "0")}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">{scene.title}</h3>
              {scene.voiceover_path && (
                <span className="inline-flex items-center gap-1 rounded-full bg-signal/10 px-2 py-1 text-[10px] font-medium text-signal">
                  <Check className="size-3" /> Voiceover ready
                </span>
              )}
            </div>
            <p className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">
              {scene.narration || "No narration has been written for this scene yet."}
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_auto_auto] lg:w-[520px]">
          <select
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
            className="h-9 rounded-lg border border-border bg-surface px-3 text-sm"
            aria-label={`Voice for ${scene.title}`}
          >
            {voices.map((v: any) => <option key={v.id} value={v.id}>{v.name} · {v.provider}</option>)}
          </select>
          <Button size="sm" variant="panel" disabled={!voice || !!busy} onClick={() => run("preview")}>
            {busy === "preview" ? <Loader2 className="animate-spin" /> : <Play />}
            Preview
          </Button>
          <Button size="sm" variant="signal" disabled={!voice || !hasNarration || !!busy} onClick={() => run("generate")}>
            {busy === "generate" ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {scene.voiceover_path ? "Regenerate" : "Generate"}
          </Button>
        </div>
      </div>

      {!hasNarration && (
        <p className="mt-3 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          Add narration in the Scenes step before generating a voiceover.
        </p>
      )}

      {url && <audio className="mt-3 w-full" controls src={url} />}

      <div className="mt-4 flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center">
        <label className="min-w-0 flex-1 text-xs text-muted-foreground">
          <span className="flex justify-between">
            <span className="inline-flex items-center gap-1.5"><SlidersHorizontal className="size-3.5 text-signal" /> Voice volume</span>
            <span>100% default</span>
          </span>
          <input className="mt-2 w-full" type="range" min="0" max="2" step=".05" defaultValue="1" onChange={saveMix} />
        </label>
        <p className="max-w-sm text-xs leading-5 text-muted-foreground">
          Ducking defaults on. Fine attack/release controls are available in the Timeline step.
        </p>
      </div>
    </article>
  );
}

function MusicComposer({
  project,
  tracks,
  generate,
  refresh,
}: {
  project: any;
  tracks: any[];
  generate: any;
  refresh: () => Promise<void>;
}) {
  const [title, setTitle] = useState("Cinematic bed");
  const [prompt, setPrompt] = useState("Atmospheric cinematic instrumental with subtle tension, warm strings and restrained percussion, no vocals");
  const [seconds, setSeconds] = useState(30);
  const [busy, setBusy] = useState(false);

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-raised text-signal">
          <Music2 className="size-4" />
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Music</p>
          <h2 className="mt-1 font-semibold">Create an instrumental bed</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Describe the mood you want behind the narration. You can generate more than one option and choose later.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)_110px_auto]">
        <Input aria-label="Music title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Track title" />
        <Input aria-label="Music prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        <Input aria-label="Music duration seconds" type="number" min={3} max={600} value={seconds} onChange={(e) => setSeconds(Number(e.target.value) || 3)} />
        <Button
          variant="signal"
          disabled={busy || prompt.trim().length < 10}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await generate({ data: { projectId: project.id, title, prompt, durationSeconds: seconds } });
              if (!r.ok) toast.error(r.error);
              else toast.success("Music added");
              await refresh();
            } catch (e: any) {
              toast.error(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {busy ? "Generating…" : "Generate"}
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <span>Title</span>
        <span>·</span>
        <span>Prompt</span>
        <span>·</span>
        <span>Duration in seconds</span>
      </div>

      {tracks.length > 0 && (
        <div className="mt-5 grid gap-2 md:grid-cols-2">
          {tracks.map((t: any) => (
            <div key={t.id} className="rounded-xl border border-border bg-surface-raised p-3">
              <p className="text-sm font-medium">{t.title}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{t.provider} · {t.license}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-border bg-surface-raised p-8 text-center text-sm leading-6 text-muted-foreground">{children}</div>;
}
