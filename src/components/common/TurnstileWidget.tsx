import { useEffect, useRef } from "react";

type TurnstileInstance = {
  render: (element: HTMLElement, options: {
    sitekey: string;
    callback?: (token: string) => void;
    "expired-callback"?: () => void;
    "error-callback"?: () => void;
  }) => string;
  reset: (widgetId: string) => void;
};

declare global {
  interface Window { turnstile?: TurnstileInstance; }
}

let scriptPromise: Promise<void> | undefined;

function loadTurnstile() {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    if (window["turnstile"]) return resolve();
    const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Turnstile failed to load.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset.turnstile = "true";
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Turnstile failed to load.")), { once: true });
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function TurnstileWidget({ onToken }: { onToken: (token: string | null) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const siteKey = import.meta.env["VITE_TURNSTILE_SITE_KEY"] as string | undefined;

  useEffect(() => {
    if (!siteKey || !ref.current) return;
    let cancelled = false;
    loadTurnstile()
      .then(() => {
        if (cancelled || !ref.current || !window["turnstile"]) return;
        widgetId.current = window["turnstile"].render(ref.current, {
          sitekey: siteKey,
          callback: (token) => onToken(token),
          "expired-callback": () => onToken(null),
          "error-callback": () => onToken(null),
        });
      })
      .catch(() => onToken(null));
    return () => {
      cancelled = true;
      widgetId.current = null;
      if (ref.current) ref.current.innerHTML = "";
    };
  }, [onToken, siteKey]);

  if (!siteKey) return null;
  return <div ref={ref} className="flex justify-center" aria-label="Bot protection" />;
}
