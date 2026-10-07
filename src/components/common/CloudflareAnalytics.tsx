import { useEffect } from "react";
import { getCookieConsent } from "@/components/common/CookieConsent";

const SCRIPT_ID = "cf-web-analytics";

function appendBeacon(token: string) {
  if (document.getElementById(SCRIPT_ID)) return;
  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.defer = true;
  script.src = "https://static.cloudflareinsights.com/beacon.min.js";
  script.setAttribute("data-cf-beacon", JSON.stringify({ token }));
  document.head.appendChild(script);
}

export function CloudflareAnalytics() {
  useEffect(() => {
    const token = import.meta.env.VITE_CF_WEB_ANALYTICS_TOKEN as string | undefined;
    if (!token || getCookieConsent() !== "accepted") return;
    appendBeacon(token);

    const onConsent = () => {
      if (getCookieConsent() === "accepted") appendBeacon(token);
      else document.getElementById(SCRIPT_ID)?.remove();
    };
    window.addEventListener("cookie-consent", onConsent);
    return () => window.removeEventListener("cookie-consent", onConsent);
  }, []);

  return null;
}
