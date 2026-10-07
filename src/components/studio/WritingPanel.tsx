import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, Search, Type, FileText, Layers, Copy, Check, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  researchTopic, generateHooksTitles, generateScript, scriptToScenes,
  type Research, type HookOption, type TitleOption,
} from "@/lib/writing.functions";
import type { Tables } from "@/integrations/supabase/types";

type Slug = "topic_research" | "hooks_titles" | "full_script" | "script_to_scenes";

export function WritingPanel({ project, onScenesChanged }: { project: Tables<"projects">; onScenesChanged: () => void }) {
  const qc = useQueryClient();
  const key = ["writing", project.id];
  const { data: writing } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from("project_writing").select("*").eq("project_id", project.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: costs = {} } = useQuery({
    queryKey: ["ai_task_costs"],
    queryFn: async () => {
      const { data } = await supabase.from("ai_tasks").select("slug,credit_cost");
      return Object.fromEntries((data ?? []).map((t) => [t.slug, t.credit_cost])) as Record<string, number>;
    },
  });

  const fns = {
    topic_research: useServerFn(researchTopic),
    hooks_titles: useServerFn(generateHooksTitles),
    full_script: useServerFn(generateScript),
    script_to_scenes: useServerFn(scriptToScenes),
  };
  const [busy, setBusy] = useState<Slug | null>(null);
  const [hook, setHook] = useState<string | null>(null);
  const [script, setScript] = useState("");
  const [idea, setIdea] = useState(project.idea ?? "");

  useEffect(() => { setScript(writing?.script ?? ""); }, [writing?.script]);
  useEffect(() => { setIdea(project.idea ?? ""); }, [project.idea]);

  async function saveIdea() {
    const { error } = await supabase.from("projects").update({ idea: idea.trim() }).eq("id", project.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Idea saved");
    qc.invalidateQueries({ queryKey: ["project", project.id] });
  }

  async function run(slug: Slug, success: string) {
    if (slug === "script_to_scenes" && !confirm("Replace all current scenes with a breakdown of this script?")) return;
    setBusy(slug);
    try {
      if (idea.trim() !== (project.idea ?? "")) await saveIdea();
      if (slug === "script_to_scenes" && script !== (writing?.script ?? "")) await saveScript(true);
      const res = slug === "full_script"
        ? await fns.full_script({ data: { projectId: project.id, hook: hook ?? undefined } })
        : await fns[slug]({ data: { projectId: project.id } });
      if (!res.ok) toast.error(res.error);
      else toast.success(typeof res.value === "number" ? `Created ${res.value} scenes` : success);
      if (slug === "script_to_scenes") onScenesChanged();
    } catch {
      toast.error("AI generation failed");
    } finally {
      setBusy(null);
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["credit_transactions"] });
    }
  }

  async function saveScript(silent = false) {
    const { error } = await supabase.from("project_writing")
      .upsert({ project_id: project.id, script, updated_at: new Date().toISOString() });
    if (error) { toast.error(error.message); return; }
    if (!silent) toast.success("Script saved");
    qc.invalidateQueries({ queryKey: key });
  }

  async function applyTitle(t: string) {
    const { error } = await supabase.from("projects").update({ title: t }).eq("id", project.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Title applied");
    qc.invalidateQueries({ queryKey: ["project", project.id] });
  }

  const research = writing?.research as Research | null;
  const hooks = (writing?.hooks as HookOption[] | null) ?? [];
  const titles = (writing?.titles as TitleOption[] | null) ?? [];
  const words = script.trim() ? script.trim().split(/\s+/).length : 0;

  const nextStep: { slug: Slug; title: string; copy: string; label: string; icon: typeof Search } =
    !research
      ? { slug: "topic_research", title: "Start with research", copy: "Turn the raw idea into a sharper angle and useful talking points.", label: "Research topic", icon: Search }
      : !hooks.length
        ? { slug: "hooks_titles", title: "Find the strongest angle", copy: "Generate hooks and titles, then pick the direction you want for the script.", label: "Generate hooks", icon: Type }
        : !script.trim()
          ? { slug: "full_script", title: "Write the script", copy: hook ? "Your selected hook will be used as the opening direction." : "Turn the idea into a full, editable script.", label: "Write full script", icon: FileText }
          : { slug: "script_to_scenes", title: "Turn the script into scenes", copy: "Once the script feels right, break it into scenes for visuals and audio.", label: "Create scenes", icon: Layers };

  const AiBtn = ({ slug, label, icon: Icon, success }: { slug: Slug; label: string; icon: typeof Sparkles; success: string }) => (
    <Button variant="panel" size="sm" disabled={busy !== null} onClick={() => run(slug, success)}>
      {busy === slug ? <Loader2 className="animate-spin" /> : <Icon />}
      {busy === slug ? "Working…" : label}
    </Button>
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-signal/20 bg-signal/5 p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-signal/10 text-signal">
            <Sparkles className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-signal">Writing workflow</p>
            <h2 className="mt-1 text-xl font-bold">{nextStep.title}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{nextStep.copy}</p>
            <Button className="mt-4" variant="signal" size="sm" disabled={busy !== null} onClick={() => run(nextStep.slug, nextStep.slug === "script_to_scenes" ? "Scenes created" : nextStep.slug === "full_script" ? "Script written" : nextStep.slug === "hooks_titles" ? "Hooks and titles ready" : "Research ready")}>
              {busy === nextStep.slug ? <Loader2 className="animate-spin" /> : <nextStep.icon />}
              {busy === nextStep.slug ? "Working…" : nextStep.label}
              <ArrowRight />
            </Button>
          </div>
          <div className="hidden shrink-0 sm:block">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Flow</p>
            <p className="mt-2 text-xs text-muted-foreground">Idea → Research → Hook → Script → Scenes</p>
          </div>
        </div>
      </section>

      <Section number="01" title="Video idea" action={
        <Button variant="panel" size="sm" disabled={idea === (project.idea ?? "")} onClick={saveIdea}>Save idea</Button>
      }>
        <div className="rounded-xl border border-border bg-surface p-4">
          <Textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={4}
            placeholder="What is this video about? Include the audience, angle, or tone if you already know them." />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">You don't need a perfect brief — a rough idea is enough to begin.</p>
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{idea.length}/2000</span>
          </div>
        </div>
      </Section>

      <Section number="02" title="Research" action={
        <AiBtn slug="topic_research" label={research ? `Redo · ${costs.topic_research ?? "…"} cr` : `Research · ${costs.topic_research ?? "…"} cr`} icon={Search} success="Research ready" />
      }>
        {research ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Card label="Angle"><p>{research.angle}</p></Card>
            <Card label="Audience"><p>{research.audience}</p></Card>
            <Card label="Key points"><List items={research.key_points} /></Card>
            <Card label="Facts to verify"><List items={research.facts} /></Card>
            <Card label="Viewer questions" className="md:col-span-2"><List items={research.questions} /></Card>
          </div>
        ) : <Empty>Research sharpens the angle before you spend time writing. Nothing here yet.</Empty>}
      </Section>

      <Section number="03" title="Hooks & titles" action={
        <AiBtn slug="hooks_titles" label={hooks.length ? `Regenerate · ${costs.hooks_titles ?? "…"} cr` : `Generate · ${costs.hooks_titles ?? "…"} cr`} icon={Type} success="Hooks and titles ready" />
      }>
        {hooks.length || titles.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Card label="Choose an opening hook">
              <div className="space-y-2">
                {hooks.map((h) => (
                  <button key={h.hook} onClick={() => setHook(hook === h.hook ? null : h.hook)}
                    className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${hook === h.hook ? "border-signal bg-signal/10" : "border-border hover:border-muted-foreground"}`}
                    aria-pressed={hook === h.hook}
                  >
                    <span className="font-mono text-[10px] uppercase text-signal">{h.style}</span>
                    <p className="mt-1 leading-5">{h.hook}</p>
                    {hook === h.hook && <p className="mt-2 text-xs font-medium text-signal">Selected for script generation</p>}
                  </button>
                ))}
              </div>
            </Card>
            <Card label="Choose a title">
              <div className="space-y-2">
                {titles.map((t) => (
                  <div key={t.title} className="rounded-lg border border-border p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold leading-5">{t.title}</p>
                      <Button size="sm" variant="ghost" onClick={() => applyTitle(t.title)}>Use</Button>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{t.why}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        ) : <Empty>Generate a few directions, then choose the one that feels right before writing.</Empty>}
      </Section>

      <Section number="04" title="Script" action={
        <div className="flex flex-wrap gap-2">
          <AiBtn slug="full_script" label={`Write script · ${costs.full_script ?? "…"} cr`} icon={FileText} success="Script written" />
          <AiBtn slug="script_to_scenes" label={`Create scenes · ${costs.script_to_scenes ?? "…"} cr`} icon={Layers} success="Scenes created" />
        </div>
      }>
        <div className="rounded-xl border border-border bg-surface p-4">
          <Textarea rows={18} value={script} onChange={(e) => setScript(e.target.value)}
            placeholder="Write your script here, or generate one above. Use ## headings for acts if you want more structure." className="border-0 bg-transparent p-0 font-mono text-sm leading-7 shadow-none focus-visible:ring-0" />
          <div className="mt-4 flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-mono text-xs text-muted-foreground">{words.toLocaleString()} WORDS · ~{Math.round(words / 2.5)}s SPOKEN</p>
            <div className="flex flex-wrap gap-2">
              <CopyBtn text={script} />
              {hook && <span className="rounded-full bg-signal/10 px-2.5 py-1 text-[11px] text-signal">Hook selected</span>}
              {script !== (writing?.script ?? "") && <Button size="sm" variant="signal" onClick={() => saveScript()}>Save script</Button>}
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({ number, title, action, children }: { number: string; title: string; action: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Step {number}</p>
          <h3 className="mt-1 text-xl font-bold">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
function Card({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-surface p-4 text-sm ${className}`}>
      <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
function List({ items }: { items: string[] }) {
  return <ul className="list-disc space-y-1.5 pl-4 text-sm leading-6">{items.map((i) => <li key={i}>{i}</li>)}</ul>;
}
function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm leading-6 text-muted-foreground">{children}</div>;
}
function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button size="sm" variant="ghost" disabled={!text} onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}>
      {done ? <Check /> : <Copy />} Copy
    </Button>
  );
}
