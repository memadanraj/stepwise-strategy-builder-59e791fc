import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Clapperboard, Coins, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { profileQuery, projectsQuery, creditTxnsQuery } from "@/lib/studio";
import { ProjectCard } from "@/components/studio/ProjectCard";
import { NewProjectDialog } from "@/components/studio/NewProjectDialog";

export const Route = createFileRoute("/_authenticated/_studio/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Reelforge" },
      { name: "description", content: "Your Reelforge studio overview." },
      { property: "og:title", content: "Dashboard — Reelforge" },
      { property: "og:description", content: "Your Reelforge studio overview." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = Route.useRouteContext();
  const { data: profile } = useQuery(profileQuery(user.id));
  const { data: projects = [] } = useQuery(projectsQuery);
  const { data: txns = [] } = useQuery(creditTxnsQuery);

  const stats = [
    { label: "Projects", value: projects.length, hint: "All your video projects" },
    { label: "In production", value: projects.filter((p) => !["draft", "published"].includes(p.status)).length, hint: "Projects being worked on" },
    { label: "Published", value: projects.filter((p) => p.status === "published").length, hint: "Ready for your audience" },
    { label: "Credits", value: profile?.credits_balance ?? "—", hint: "Available for AI tools" },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-signal">Your studio</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
            Welcome back, {profile?.display_name ?? "creator"}.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Turn your next idea into a finished video without jumping between tools.
          </p>
        </div>
        <NewProjectDialog>
          <Button variant="signal"><Plus /> Start a project</Button>
        </NewProjectDialog>
      </div>

      <div className="mt-7 rounded-2xl border border-signal/20 bg-signal/5 p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-signal/10 text-signal">
            <Sparkles className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">The easiest place to start is a new project.</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Add your idea, choose a format, and Reelforge will walk you through writing, scenes, visuals, audio, and export.
            </p>
          </div>
          <NewProjectDialog>
            <Button variant="panel" className="hidden sm:inline-flex">Create now <ArrowRight /></Button>
          </NewProjectDialog>
        </div>
      </div>

      <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-surface p-4 sm:p-5">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
            <p className="mt-2 font-display text-2xl font-bold sm:text-3xl">{s.value}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{s.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Workspace</p>
              <h2 className="mt-1 text-xl font-bold">Recent projects</h2>
            </div>
            <Link to="/projects" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
              View all <ArrowRight className="size-4" />
            </Link>
          </div>

          {projects.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-border bg-surface p-8 text-center sm:p-10">
              <div className="mx-auto grid size-12 place-items-center rounded-xl bg-surface-raised">
                <Clapperboard className="size-5 text-signal" />
              </div>
              <p className="mt-4 font-display text-lg font-bold">Your first project starts here</p>
              <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                Give the project a working title and idea. You can refine everything later.
              </p>
              <NewProjectDialog>
                <Button variant="signal" className="mt-5"><Plus /> Create your first project</Button>
              </NewProjectDialog>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {projects.slice(0, 4).map((p) => <ProjectCard key={p.id} project={p} />)}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Usage</p>
              <h2 className="mt-1 text-xl font-bold">Credit activity</h2>
            </div>
            <Link to="/settings" className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
              <Coins className="size-3.5" /> Billing
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-surface">
            {txns.length === 0 && <li className="p-5 text-sm leading-6 text-muted-foreground">No credit activity yet.</li>}
            {txns.slice(0, 6).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                <span className="min-w-0 truncate">{t.description ?? t.kind}</span>
                <span className={`shrink-0 font-mono text-xs ${t.amount >= 0 ? "text-track-2" : "text-signal"}`}>
                  {t.amount >= 0 ? "+" : ""}{t.amount}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
