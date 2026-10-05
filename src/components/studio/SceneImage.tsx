import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Film, ImageIcon, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { generateSceneClip, generateSceneImage } from "@/lib/visuals.functions";
import { VISUAL_STYLES, type VisualStyle } from "@/lib/visual-styles";
import type { Tables } from "@/integrations/supabase/types";

/** Latest generated/uploaded image per scene, with signed URLs. */
export function useSceneImages(projectId: string) {
  return useQuery({
    queryKey: ["scene_images", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("assets").select("id,scene_id,storage_path,created_at")
        .eq("project_id", projectId).eq("kind", "image").not("scene_id", "is", null).order("created_at", { ascending: false });
      if (error) throw error;
      const latest = new Map<string, string>();
      for (const a of data) if (a.scene_id && a.storage_path && !latest.has(a.scene_id)) latest.set(a.scene_id, a.storage_path);
      const paths = [...latest.values()];
      if (!paths.length) return {} as Record<string, string>;
      const { data: signed } = await supabase.storage.from("project-assets").createSignedUrls(paths, 3600);
      const byPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
      return Object.fromEntries([...latest].map(([sid, p]) => [sid, byPath.get(p) ?? ""])) as Record<string, string>;
    },
  });
}

export function useSceneClips(projectId: string) {
  return useQuery({
    queryKey: ["scene_clips", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("assets").select("id,scene_id,storage_path,created_at")
        .eq("project_id", projectId).eq("kind", "video").not("scene_id", "is", null).order("created_at", { ascending: false });
      if (error) throw error;
      const latest = new Map<string, string>();
      for (const a of data) if (a.scene_id && a.storage_path && !latest.has(a.scene_id)) latest.set(a.scene_id, a.storage_path);
      const paths = [...latest.values()];
      if (!paths.length) return {} as Record<string, string>;
      const { data: signed } = await supabase.storage.from("project-assets").createSignedUrls(paths, 3600);
      const byPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
      return Object.fromEntries([...latest].map(([sid, p]) => [sid, byPath.get(p) ?? ""])) as Record<string, string>;
    },
  });
}

export function useClipCost() {
  return useQuery({
    queryKey: ["ai_task_cost", "generate_clip"],
    queryFn: async () => (await supabase.from("ai_tasks").select("credit_cost").eq("slug", "generate_clip").maybeSingle()).data?.credit_cost ?? null,
  });
}

export function useImageCost() {
  return useQuery({
    queryKey: ["ai_task_cost", "scene_image"],
    queryFn: async () => (await supabase.from("ai_tasks").select("credit_cost").eq("slug", "scene_image").maybeSingle()).data?.credit_cost ?? null,
  });
}

export function StylePicker({ project }: { project: Tables<"projects"> }) {
  const qc = useQueryClient();
  async function pick(s: VisualStyle) {
    const { error } = await supabase.from("projects").update({ visual_style: s }).eq("id", project.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["project", project.id] });
  }
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Visual style</span>
      {(Object.keys(VISUAL_STYLES) as VisualStyle[]).map((s) => (
        <button key={s} onClick={() => pick(s)}
          className={`rounded-full border px-3 py-1 text-xs transition-colors ${project.visual_style === s ? "border-signal bg-signal/10 text-foreground" : "border-border text-muted-foreground hover:border-muted-foreground"}`}>
          {VISUAL_STYLES[s].label}
        </button>
      ))}
    </div>
  );
}

export function SceneImage({ scene, url, clipUrl, cost, clipCost, vertical }: { scene: Tables<"scenes">; url?: string | undefined; clipUrl?: string | undefined; cost: number | null | undefined; clipCost: number | null | undefined; vertical: boolean }) {
  const qc = useQueryClient();
  const gen = useServerFn(generateSceneImage);
  const clipGen = useServerFn(generateSceneClip);
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const res = await gen({ data: { sceneId: scene.id } });
      if (!res.ok) toast.error(res.error); else toast.success("Image ready");
    } catch { toast.error("Image generation failed"); }
    finally {
      setBusy(false);
      for (const k of [["scene_images", scene.project_id], ["assets", scene.project_id], ["profile"], ["credit_transactions"]]) qc.invalidateQueries({ queryKey: k });
    }
  }
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-lg border border-border bg-background ${vertical ? "aspect-[9/16] w-28" : "aspect-video w-48"}`}>
      {url ? <img src={url} alt={scene.title} className="size-full object-cover" /> :
        <div className="flex size-full items-center justify-center text-muted-foreground"><ImageIcon className="size-6" /></div>}
      <Button size="sm" variant="panel" disabled={busy} onClick={run}
        className="absolute bottom-1 left-1 right-1 h-7 text-[11px]">
        {busy ? <Loader2 className="animate-spin" /> : url ? <RefreshCw /> : <ImageIcon />}
        {busy ? "Painting…" : `${url ? "Redo" : "Generate"} · ${cost ?? "…"} cr`}
      </Button>
    </div>
  );
}
