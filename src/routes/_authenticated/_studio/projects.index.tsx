import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FolderOpen, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { projectsQuery } from "@/lib/studio";
import { ProjectCard } from "@/components/studio/ProjectCard";
import { NewProjectDialog } from "@/components/studio/NewProjectDialog";

export const Route = createFileRoute("/_authenticated/_studio/projects/")({
  head: () => ({
    meta: [
      { title: "Projects — Reelforge" },
      { name: "description", content: "All your Reelforge video projects." },
      { property: "og:title", content: "Projects — Reelforge" },
      { property: "og:description", content: "All your Reelforge video projects." },
    ],
  }),
  component: Projects,
});

const filters = [
  { value: "all", label: "All" },
  { value: "long", label: "Long-form" },
  { value: "short", label: "Shorts" },
];

function Projects() {
  const { data: projects = [], isLoading } = useQuery(projectsQuery);
  const [q, setQ] = useState("");
  const [format, setFormat] = useState("all");

  const shown = useMemo(
    () => projects.filter(
      (p) => (format === "all" || p.format === format) && p.title.toLowerCase().includes(q.trim().toLowerCase()),
    ),
    [projects, q, format],
  );

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-signal">Workspace</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Projects</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Keep every idea, draft, render, and published video in one place.
          </p>
        </div>
        <NewProjectDialog><Button variant="signal"><Plus /> New project</Button></NewProjectDialog>
      </div>

      <div className="mt-7 rounded-2xl border border-border bg-surface p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9 pr-9"
              placeholder="Search by project title"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search projects"
            />
            {q && (
              <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Clear search">
                <X className="size-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Format</span>
            <div className="flex rounded-lg border border-border p-1">
              {filters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFormat(f.value)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${format === f.value ? "bg-surface-raised text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">{shown.length} {shown.length === 1 ? "project" : "projects"}</span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((n) => <div key={n} className="aspect-[1.2] animate-pulse rounded-xl border border-border bg-surface" />)}
        </div>
      ) : shown.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-surface p-10 text-center sm:p-14">
          <div className="mx-auto grid size-12 place-items-center rounded-xl bg-surface-raised">
            <FolderOpen className="size-5 text-signal" />
          </div>
          <p className="mt-4 font-display text-lg font-bold">{projects.length === 0 ? "No projects yet" : "No matching projects"}</p>
          <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
            {projects.length === 0
              ? "Create a project and Reelforge will take you from idea to finished video."
              : "Try a different title or switch the format filter."}
          </p>
          {projects.length === 0 && (
            <NewProjectDialog><Button variant="signal" className="mt-5"><Plus /> Create a project</Button></NewProjectDialog>
          )}
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}
    </div>
  );
}
