import { useEffect } from "react";
import { getCookieConsent } from "@/components/common/CookieConsent";

const SCRIPT_ID = "cf-web-analytics";

export function CloudflareAnalytics() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const token = import.meta.env["VITE_CF_WEB_ANALYTICS_TOKEN"] as string | undefined;
    if (!token || getCookieConsent() !== "accepted" || document.getElementById(SCRIPT_ID)) return;

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.defer = true;
    script.src = "https://static.cloudflareinsights.com/beacon.min.js";
    script.setAttribute("data-cf-beacon", JSON.stringify({ token }));
    document.head.appendChild(script);

    return () => {
      document.getElementById(SCRIPT_ID)?.remove();
    };
  }, []);

  useEffect(() => {
    const refresh = () => {
      if (getCookieConsent() === "accepted") {
        const token = import.meta.env["VITE_CF_WEB_ANALYTICS_TOKEN"] as string | undefined;
        if (!token || document.getElementById(SCRIPT_ID)) return;
        const script = document.createElement("script");
        script.id = SCRIPT_ID;
        script.defer = true;
        script.src = "https://static.cloudflareinsights.com/beacon.min.js";
        script.setAttribute("data-cf-beacon", JSON.stringify({ token }));
        document.head.appendChild(script);
      } else {
        document.getElementById(SCRIPT_ID)?.remove();
      }
    };
    window.addEventListener("cookie-consent", refresh);
    return () => window.removeEventListener("cookie-consent", refresh);
  }, []);

  return null;
}
