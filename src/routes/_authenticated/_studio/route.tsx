import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, Clapperboard, Settings, LogOut, Plus, Coins, ShieldCheck, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { profileQuery } from "@/lib/studio";
import { useServerFn } from "@tanstack/react-start";
import { checkIsAdmin } from "@/lib/admin.functions";
import { NewProjectDialog } from "@/components/studio/NewProjectDialog";

export const Route = createFileRoute("/_authenticated/_studio")({
  component: StudioLayout,
});

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: Clapperboard },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function StudioLayout() {
  const { user } = Route.useRouteContext();
  const { data: profile } = useQuery(profileQuery(user.id));
  const check = useServerFn(checkIsAdmin);
  const { data: role } = useQuery({ queryKey: ["is_admin"], queryFn: () => check() });
  const navItems = role?.isAdmin ? [...nav, { to: "/admin", label: "Admin", icon: ShieldCheck } as const] : nav;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const name = profile?.display_name ?? user.email ?? "Creator";
  const credits = profile?.credits_balance ?? "—";

  return (
    <div className="min-h-screen bg-background md:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4 md:flex">
        <Link to="/" className="flex items-center gap-2 px-2 font-display text-lg font-extrabold">
          <span className="grid size-7 place-items-center rounded-md bg-gradient-signal text-signal-foreground">▶</span>
          Reelforge
        </Link>

        <NewProjectDialog>
          <Button variant="signal" className="mt-7 w-full justify-center">
            <Plus /> Create project
          </Button>
        </NewProjectDialog>

        <div className="mt-8">
          <p className="px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Workspace</p>
          <nav className="mt-2 space-y-1">
            {navItems.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
                activeProps={{ className: "bg-sidebar-accent text-foreground shadow-sm" }}
              >
                <n.icon className="size-4" /> {n.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-auto space-y-3">
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Available credits</p>
                <p className="mt-1 flex items-center gap-2 font-display text-2xl font-bold">
                  <Coins className="size-4 text-signal" /> {credits}
                </p>
              </div>
              <Link to="/settings" className="text-xs font-medium text-signal hover:underline">Manage</Link>
            </div>
            <p className="mt-1 text-xs capitalize text-muted-foreground">{profile?.plan_slug ?? "free"} plan</p>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-raised font-display font-bold">
              {name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
            <button
              onClick={signOut}
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
          <div className="flex min-h-14 items-center gap-3 px-4 sm:px-6">
            <Link to="/" className="font-display font-extrabold md:hidden">Reelforge</Link>
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden rounded-full border border-border bg-surface px-3 py-1.5 font-mono text-[11px] text-muted-foreground sm:inline-flex">
                <Coins className="mr-1.5 size-3.5 text-signal" /> {credits} credits
              </span>
              <NewProjectDialog>
                <Button size="sm" variant="signal" className="md:hidden">
                  <Plus /> New
                </Button>
              </NewProjectDialog>
              <div className="grid size-8 place-items-center rounded-full bg-surface-raised font-display text-sm font-bold md:hidden" title={name}>
                {name.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>

          <nav className="flex gap-1 overflow-x-auto border-t border-border px-4 py-2 md:hidden">
            {navItems.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors"
                activeProps={{ className: "bg-surface-raised text-foreground" }}
              >
                <n.icon className="size-4" />
                {n.label}
              </Link>
            ))}
          </nav>
        </header>

        <main className="min-h-[calc(100vh-3.5rem)] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
