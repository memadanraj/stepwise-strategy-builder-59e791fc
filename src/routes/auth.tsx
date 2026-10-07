import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TurnstileWidget } from "@/components/common/TurnstileWidget";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Reelforge" },
      { name: "description", content: "Sign in or create your Reelforge account to start making YouTube videos with AI." },
      { property: "og:title", content: "Sign in — Reelforge" },
      { property: "og:description", content: "Sign in or create your Reelforge account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const handleCaptcha = useCallback((token: string | null) => setCaptchaToken(token), []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: "/dashboard", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    // Honeypot: bots fill hidden fields; silently ignore.
    if ((form.elements.namedItem("website") as HTMLInputElement | null)?.value) return;
    const cleanEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail) || cleanEmail.length > 255) {
      toast.error("Please enter a valid email address.");
      return;
    }
    if (mode !== "forgot" && (password.length < 8 || password.length > 72)) {
      toast.error("Password must be 8–72 characters.");
      return;
    }
    if (mode === "signup" && name.trim().length > 100) {
      toast.error("Name must be under 100 characters.");
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      if (mode === "signin") {
        const { error } = await (supabase.auth.signInWithPassword as any)({ email, password, options: captchaToken ? { captchaToken } : undefined });
        if (error) throw error;
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/dashboard", data: { full_name: name }, ...(captchaToken ? { captchaToken } : {}) },
        });
        if (error) throw error;
        setNotice("Check your inbox to confirm your email, then sign in.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setNotice("If that email has an account, a reset link is on its way.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (result.error) toast.error(result.error.message ?? "Google sign-in failed");
  }

  const title = mode === "signin" ? "Welcome back" : mode === "signup" ? "Create your studio" : "Reset your password";

  return (
    <div className="relative grid min-h-screen place-items-center px-6">
      <div className="absolute inset-0 bg-glow" />
      <div className="relative w-full max-w-sm rounded-2xl bg-surface p-8 shadow-panel">
        <Link to="/" className="flex items-center gap-2 font-display font-extrabold">
          <span className="grid size-7 place-items-center rounded-md bg-gradient-signal text-signal-foreground">▶</span>
          Reelforge
        </Link>
        <h1 className="mt-6 text-2xl font-bold">{title}</h1>

        {mode !== "forgot" && (
          <>
            <Button variant="panel" className="mt-6 w-full" onClick={google} type="button">
              Continue with Google
            </Button>
            <div className="my-5 flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> OR <span className="h-px flex-1 bg-border" />
            </div>
          </>
        )}

        <form onSubmit={submit} className={`space-y-4 ${mode === "forgot" ? "mt-6" : ""}`}>
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required maxLength={255} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {mode !== "forgot" && (
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <Label htmlFor="password">Password</Label>
                {mode === "signin" && (
                  <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setMode("forgot")}>
                    Forgot?
                  </button>
                )}
              </div>
              <Input id="password" type="password" required minLength={8} maxLength={72} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          )}
          <TurnstileWidget onToken={handleCaptcha} />\n          {notice && <p className="rounded-md bg-surface-raised p-3 text-sm text-muted-foreground">{notice}</p>}
          <Button variant="signal" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signin" ? (
            <>New here? <button className="text-foreground underline" onClick={() => setMode("signup")}>Create an account</button></>
          ) : (
            <>Have an account? <button className="text-foreground underline" onClick={() => setMode("signin")}>Sign in</button></>
          )}
        </p>
      </div>
    </div>
  );
}
