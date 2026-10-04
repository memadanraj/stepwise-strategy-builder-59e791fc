// Server-only image generation via Lovable AI Gateway (non-streaming, returns PNG bytes).
import { AiGatewayError } from "./ai-gateway.server";

export async function generateImageBytes(apiKey: string, model: string, prompt: string): Promise<Uint8Array> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], modalities: ["image", "text"] }),
  });
  if (!res.ok) {
    console.error("Image gateway error", res.status, await res.text().catch(() => ""));
    if (res.status === 429) throw new AiGatewayError("AI is busy right now. Please try again shortly.", 429);
    if (res.status === 402) throw new AiGatewayError("AI credits for this workspace are exhausted.", 402);
    throw new AiGatewayError("Image generation failed.", res.status);
  }
  const json = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new AiGatewayError("AI returned no image.", 500);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
