type PaddleCheckout = {
  open: (options: { transactionId: string; settings?: { displayMode?: "overlay"; successUrl?: string } }) => void;
};
type PaddleGlobal = {
  Initialize: (options: { token: string; environment?: "sandbox" }) => void;
  Checkout: PaddleCheckout;
};
declare global {
  interface Window { Paddle?: PaddleGlobal; __dcxoraPaddleInitialized?: boolean; }
}
let paddleScriptPromise: Promise<PaddleGlobal> | undefined;
function loadPaddleScript() {
  if (paddleScriptPromise) return paddleScriptPromise;
  paddleScriptPromise = new Promise<PaddleGlobal>((resolve, reject) => {
    if (window.Paddle) { resolve(window.Paddle); return; }
    const existing = document.querySelector<HTMLScriptElement>('script[data-paddle="v2"]');
    if (existing) {
      existing.addEventListener("load", () => window.Paddle && resolve(window.Paddle), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Paddle.js.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    script.async = true;
    script.dataset["paddle"] = "v2";
    script.addEventListener("load", () => window.Paddle ? resolve(window.Paddle) : reject(new Error("Paddle.js loaded without the Paddle global.")), { once: true });
    script.addEventListener("error", () => reject(new Error("Failed to load Paddle.js.")), { once: true });
    document.head.appendChild(script);
  });
  return paddleScriptPromise;
}
export async function getPaddle() {
  if (typeof window === "undefined") throw new Error("Paddle Checkout is only available in the browser.");
  const token = import.meta.env["VITE_PADDLE_CLIENT_TOKEN"] as string | undefined;
  if (!token) throw new Error("Missing VITE_PADDLE_CLIENT_TOKEN environment variable.");
  const paddle = await loadPaddleScript();
  if (!window.__dcxoraPaddleInitialized) {
    const environment = import.meta.env["VITE_PADDLE_ENVIRONMENT"] as string | undefined;
    paddle.Initialize({ token, ...(environment === "sandbox" ? { environment: "sandbox" as const } : {}) });
    window.__dcxoraPaddleInitialized = true;
  }
  return paddle;
}
