import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

const KEY = "reelforge_cookie_consent";

export function getCookieConsent(): "accepted" | "declined" | null {
  if (typeof window === "undefined") return null;
  return (localStorage.getItem(KEY) as "accepted" | "declined" | null) ?? null;
}

export function CookieConsent() {
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(getCookieConsent() === null); }, []);
  if (!open) return null;
  const choose = (v: "accepted" | "declined") => {
    localStorage.setItem(KEY, v);
    window.dispatchEvent(new Event("cookie-consent"));
    setOpen(false);
  };
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="cookie-consent-title" className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-xl rounded-2xl border border-border bg-surface p-5 shadow-lg">
      <h2 id="cookie-consent-title" className="text-sm font-semibold text-foreground">Cookie preferences</h2>
      <p className="mt-2 text-sm text-foreground">
        We use essential browser storage for product functionality, and optional analytics measurement to improve Reelforge.{" "}
        <Link to="/privacy" className="underline">Learn more</Link>
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="panel" size="sm" onClick={() => choose("declined")}>Decline</Button>
        <Button variant="signal" size="sm" onClick={() => choose("accepted")}>Accept</Button>
      </div>
    </div>
  );
}
