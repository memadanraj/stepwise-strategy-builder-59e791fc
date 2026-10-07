import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarDays, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { statusLabel } from "@/lib/studio";
import type { Tables } from "@/integrations/supabase/types";

export function ProjectCard({ project }: { project: Tables<"projects"> }) {
  const queryClient = useQueryClient();

  async function remove() {
    if (!confirm(`Delete "${project.title}"?`)) return;
    const { error } = await supabase.from("projects").delete().eq("id", project.id);
    if (error) { toast.error(error.message); return; }
    queryClient.invalidateQueries({ queryKey: ["projects"] });
  }

  const status = statusLabel[project.status] ?? project.status;

  return (
    <article className="group overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-shadow hover:shadow-md">
      <div className={`relative bg-surface-raised bg-glow ${project.format === "short" ? "aspect-[16/10]" : "aspect-video"}`}>
        <div className="absolute inset-0 bg-grid opacity-30" />
        <span className="absolute left-3 top-3 rounded-full border border-border bg-background/85 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide">
          {project.format === "short" ? "Short · 9:16" : "Long-form · 16:9"}
        </span>
        <button
          onClick={remove}
          aria-label="Delete project"
          className="absolute right-3 top-3 rounded-lg border border-border bg-background/85 p-2 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <div className="p-4">
        <Link to="/projects/$projectId" params={{ projectId: project.id }} className="block truncate font-display font-bold hover:text-signal">
          {project.title}
        </Link>
        <div className="mt-2 flex items-center justify-between gap-3 text-xs">
          <span className="rounded-full bg-surface-raised px-2 py-1 capitalize text-muted-foreground">{status}</span>
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <CalendarDays className="size-3.5" />
            {new Date(project.updated_at).toLocaleDateString()}
          </span>
        </div>
      </div>
    </article>
  );
}
