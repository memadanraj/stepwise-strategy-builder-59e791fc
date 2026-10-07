import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TurnstileWidget } from "@/components/common/TurnstileWidget";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — Reelforge" },
      { name: "description", content: "Choose a new password for your Reelforge account." },
      { property: "og:title", content: "Set a new password — Reelforge" },
      { property: "og:description", content: "Choose a new password for your Reelforge account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const handleCaptcha = useCallback((token: string | null) => setCaptchaToken(token), []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8 || password.length > 72) { toast.error("Password must be 8–72 characters."); return; }
    if (import.meta.env.VITE_TURNSTILE_SITE_KEY && !captchaToken) { toast.error("Please complete the bot check."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password } as any);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="relative grid min-h-screen place-items-center px-6">
      <div className="absolute inset-0 bg-glow" />
      <form onSubmit={submit} className="relative w-full max-w-sm space-y-4 rounded-2xl bg-surface p-8 shadow-panel">
        <h1 className="text-2xl font-bold">Set a new password</h1>
        <div className="space-y-1.5">
          <Label htmlFor="pw">New password</Label>
          <Input id="pw" type="password" required minLength={8} maxLength={72} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <TurnstileWidget onToken={handleCaptcha} />
        <Button variant="signal" className="w-full" disabled={busy}>{busy ? "Saving…" : "Update password"}</Button>
      </form>
    </div>
  );
}
