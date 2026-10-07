import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ImageIcon, Film, Loader2, Plus, Trash2, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generateSceneImage, generateSceneClip } from "@/lib/visuals.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Tables } from "@/integrations/supabase/types";

const STYLES = [
  ["cinematic", "Cinematic"], ["photoreal", "Photoreal"], ["anime", "Anime"], ["flat", "Flat"],
  ["watercolor", "Watercolor"], ["retro", "Retro"], ["darkdoc", "Dark doc"],
] as const;

function useSignedUrl(path: string | null) {
  return useQuery({
    queryKey: ["signed", path],
    enabled: !!path,
    staleTime: 240_000,
    queryFn: async () => {
      const { data } = await supabase.storage.from("project-assets").createSignedUrl(path!, 300);
      return data?.signedUrl ?? null;
    },
  });
}

export function VisualsPanel({ project }: { project: Tables<"projects"> }) {
  const qc = useQueryClient();
  const { data: scenes = [] } = useQuery({
    queryKey: ["scenes", project.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("scenes").select("*").eq("project_id", project.id).order("position");
      if (error) throw error;
      return data;
    },
  });
  const { data: costs } = useQuery({
    queryKey: ["ai_task_cost", "visuals"],
    queryFn: async () => {
      const { data } = await supabase.from("ai_tasks").select("slug,credit_cost").in("slug", ["generate_image", "generate_clip"]);
      return Object.fromEntries((data ?? []).map((t) => [t.slug, t.credit_cost])) as Record<string, number>;
    },
  });

  async function setStyle(style: string) {
    const { error } = await supabase.from("projects").update({ visual_style: style }).eq("id", project.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["project", project.id] });
    toast.success(`Visual style set to ${style}`);
  }

  const readyVisuals = scenes.filter((s) => s.image_path || s.clip_path).length;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-signal/20 bg-signal/5 p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-signal/10 text-signal">
            <Sparkles className="size-5" />
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-signal">Visual workflow</p>
            <h2 className="mt-1 text-xl font-bold">Give every scene a visual direction</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Pick one style for the project, define recurring characters when needed, then generate an image or motion clip for each scene.
            </p>
          </div>
          <div className="ml-auto hidden shrink-0 text-right sm:block">
            <p className="font-display text-xl font-bold">{readyVisuals}/{scenes.length}</p>
            <p className="text-[11px] text-muted-foreground">scenes with visuals</p>
          </div>
        </div>
      </section>

      <Panel title="Visual style" description="Applied as the default creative direction across generated scene visuals.">
        <div className="flex flex-wrap gap-2">
          {STYLES.map(([value, label]) => {
            const active = project.visual_style === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setStyle(value)}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${active ? "border-signal bg-signal text-signal-foreground" : "border-border bg-surface hover:bg-surface-raised"}`}
                aria-pressed={active}
              >
                {active && <Check className="size-3.5" />}
                {label}
              </button>
            );
          })}
        </div>
      </Panel>

      <Characters projectId={project.id} />

      <Panel
        title="Scene visuals"
        description={scenes.length ? `${readyVisuals} of ${scenes.length} scenes already have generated media.` : "Create scenes first, then generate visuals here."}
      >
        {scenes.length === 0 ? (
          <Empty>Add scenes in the Scenes step before generating visuals.</Empty>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {scenes.map((scene, index) => (
              <SceneVisual key={scene.id} scene={scene} index={index} project={project} costs={costs} />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function SceneVisual({ scene, index, project, costs }: { scene: Tables<"scenes">; index: number; project: Tables<"projects">; costs?: Record<string, number> }) {
  const qc = useQueryClient();
  const imgFn = useServerFn(generateSceneImage);
  const clipFn = useServerFn(generateSceneClip);
  const [busy, setBusy] = useState<null | "image" | "clip">(null);
  const img = useSignedUrl(scene.image_path);
  const clip = useSignedUrl(scene.clip_path);

  async function run(kind: "image" | "clip") {
    setBusy(kind);
    try {
      const fn = kind === "image" ? imgFn : clipFn;
      const res = await fn({ data: { projectId: project.id, sceneId: scene.id } });
      if (!res.ok) toast.error(res.error);
      else toast.success(kind === "image" ? "Image ready" : "Clip ready");
    } catch {
      toast.error("Generation failed");
    } finally {
      setBusy(null);
      qc.invalidateQueries({ queryKey: ["scenes", project.id] });
      qc.invalidateQueries({ queryKey: ["assets", project.id] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["credit_transactions"] });
    }
  }

  const aspect = project.format === "short" ? "aspect-[9/16] max-h-80 mx-auto" : "aspect-video";
  const hasPrompt = !!scene.visual_prompt?.trim();
  const media = clip.data || img.data;

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className={`relative ${aspect} overflow-hidden bg-surface-raised`}>
        {clip.data ? (
          <video src={clip.data} controls className="size-full object-cover" />
        ) : img.data ? (
          <img src={img.data} alt={scene.title} className="size-full object-cover" />
        ) : (
          <div className="flex size-full flex-col items-center justify-center px-6 text-center">
            {busy ? <Loader2 className="size-6 animate-spin text-signal" /> : <ImageIcon className="size-6 text-muted-foreground" />}
            <p className="mt-2 text-sm font-medium">{busy ? "Creating visual…" : "No visual yet"}</p>
            {!busy && <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">{hasPrompt ? "Generate an image first, or create a motion clip." : "Add a visual description in Scenes first."}</p>}
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-background/85 px-2 py-1 font-mono text-[10px] text-signal">
          SCENE {String(index + 1).padStart(2, "0")}
        </span>
        {clip.data && <span className="absolute right-3 top-3 rounded-full bg-background/85 px-2 py-1 text-[10px] font-medium">Motion clip</span>}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold">{scene.title}</h3>
          {media && <span className="shrink-0 rounded-full bg-signal/10 px-2 py-1 text-[10px] font-medium text-signal">Ready</span>}
        </div>
        <p className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">
          {scene.visual_prompt || "No visual description — add one in Scenes."}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button size="sm" variant="panel" disabled={!!busy || !hasPrompt} onClick={() => run("image")}>
            {busy === "image" ? <Loader2 className="animate-spin" /> : <ImageIcon />}
            {img.data ? "Regenerate" : "Generate"} {costs?.["generate_image"] != null ? `· ${costs["generate_image"]} cr` : ""}
          </Button>
          <Button size="sm" variant="panel" disabled={!!busy || !hasPrompt} onClick={() => run("clip")}>
            {busy === "clip" ? <Loader2 className="animate-spin" /> : <Film />}
            {clip.data ? "Regenerate" : "Create clip"} {costs?.["generate_clip"] != null ? `· ${costs["generate_clip"]} cr` : ""}
          </Button>
        </div>
      </div>
    </article>
  );
}

function Characters({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const key = ["characters", projectId];
  const { data: chars = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from("characters").select("*").eq("project_id", projectId).order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  async function add() {
    if (!name.trim()) return;
    const { error } = await supabase.from("characters").insert({ project_id: projectId, name: name.trim(), description: desc.trim() || null });
    if (error) { toast.error(error.message); return; }
    setName(""); setDesc("");
    qc.invalidateQueries({ queryKey: key });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("characters").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: key });
  }

  return (
    <Panel title="Characters" description="Optional. Save recurring characters here so your visual prompts stay consistent across scenes.">
      {chars.length > 0 && (
        <div className="mb-4 space-y-2">
          {chars.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface-raised p-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface font-semibold text-signal">{c.name.charAt(0).toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{c.name}</p>
                <p className="truncate text-xs text-muted-foreground">{c.description || "No description yet"}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove(c.id)} aria-label={`Delete ${c.name}`}><Trash2 /></Button>
            </div>
          ))}
        </div>
      )}
      <div className="grid gap-2 md:grid-cols-[160px_1fr_auto]">
        <Input placeholder="Character name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Appearance, age, clothing, key features…" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <Button variant="signal" onClick={add} disabled={!name.trim()}><Plus /> Add character</Button>
      </div>
    </Panel>
  );
}

function Panel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div className="mb-4">
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-border bg-surface-raised p-8 text-center text-sm leading-6 text-muted-foreground">{children}</div>;
}
