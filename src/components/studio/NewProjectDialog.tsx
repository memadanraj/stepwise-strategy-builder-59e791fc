import { useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clapperboard, Film, Sparkles, WandSparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function Choice({ value, current, onPick, title, desc, icon: Icon }: {
  value: string;
  current: string;
  onPick: (v: string) => void;
  title: string;
  desc: string;
  icon: typeof Film;
}) {
  const on = value === current;
  return (
    <button
      type="button"
      onClick={() => onPick(value)}
      className={`rounded-xl border p-4 text-left transition-all ${on ? "border-signal bg-signal/5 shadow-sm" : "border-border hover:border-muted-foreground/40 hover:bg-surface-raised"}`}
      aria-pressed={on}
    >
      <div className="flex items-start gap-3">
        <div className={`grid size-9 shrink-0 place-items-center rounded-lg ${on ? "bg-signal/10 text-signal" : "bg-surface-raised text-muted-foreground"}`}>
          <Icon className="size-4" />
        </div>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{desc}</p>
        </div>
      </div>
    </button>
  );
}

export function NewProjectDialog({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [idea, setIdea] = useState("");
  const [format, setFormat] = useState("long");
  const [mode, setMode] = useState("simple");
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    if ((form.elements.namedItem("website") as HTMLInputElement | null)?.value) return;
    const cleanTitle = title.trim();
    const cleanIdea = idea.trim();
    if (cleanTitle.length < 2 || cleanTitle.length > 120) { toast.error("Title must be 2–120 characters."); return; }
    if (cleanIdea.length > 2000) { toast.error("Idea must be 2,000 characters or fewer."); return; }
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setBusy(false); return; }
    const { data: created, error } = await supabase.from("projects").insert({
      user_id: u.user.id,
      title: cleanTitle,
      idea: cleanIdea || null,
      format,
      mode,
    }).select("id").single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Project created");
    await queryClient.invalidateQueries({ queryKey: ["projects"] });
    setOpen(false);
    setTitle(""); setIdea("");
    navigate({ to: "/projects/$projectId", params: { projectId: created.id } });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl bg-surface p-0">
        <DialogHeader className="border-b border-border px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-signal/10 text-signal">
              <Sparkles className="size-5" />
            </div>
            <div>
              <DialogTitle className="font-display text-2xl">Start a new project</DialogTitle>
              <DialogDescription className="mt-1">Give Reelforge the basics. You can refine everything inside the Studio.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-6 px-6 py-6">
          <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />

          <div className="space-y-2">
            <Label htmlFor="title">Working title</Label>
            <Input id="title" required minLength={2} maxLength={120} placeholder="Why octopuses might be aliens" value={title} onChange={(e) => setTitle(e.target.value)} />
            <p className="text-xs text-muted-foreground">A clear working title is enough. You can change it later.</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="idea">What's the video about?</Label>
              <span className="text-[11px] text-muted-foreground">{idea.length}/2000</span>
            </div>
            <Textarea id="idea" rows={4} maxLength={2000} placeholder="Describe the idea, audience, point of view, or tone…" value={idea} onChange={(e) => setIdea(e.target.value)} />
          </div>

          <div>
            <p className="text-sm font-medium">Choose a format</p>
            <p className="mt-1 text-xs text-muted-foreground">This controls the canvas and pacing used throughout your project.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Choice value="long" current={format} onPick={setFormat} title="Long-form" desc="5–20 min · landscape 16:9" icon={Clapperboard} />
              <Choice value="short" current={format} onPick={setFormat} title="Short" desc="Under 60s · vertical 9:16" icon={Film} />
            </div>
          </div>

          <div>
            <p className="text-sm font-medium">How much control do you want?</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Choice value="simple" current={mode} onPick={setMode} title="Simple mode" desc="Start fast. AI helps draft the major steps for you." icon={WandSparkles} />
              <Choice value="advanced" current={mode} onPick={setMode} title="Advanced mode" desc="Prefer to tune each step yourself? Choose this." icon={Clapperboard} />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="signal" disabled={busy} className="sm:min-w-40">
              {busy ? "Creating project…" : "Create project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
