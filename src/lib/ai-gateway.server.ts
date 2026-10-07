export class AiGatewayError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

function resolveModel(requested?: string) {
  if (requested?.startsWith("gpt-")) return requested;
  return process.env.OPENAI_TEXT_MODEL || "gpt-6-sol";
}

export async function generateStructured<T>(opts: {
  apiKey: string;
  model: string;
  instructions: string;
  input: string;
  schemaName: string;
  schema: Record<string, unknown>;
}): Promise<T> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: resolveModel(opts.model),
      instructions: opts.instructions,
      input: opts.input,
      store: false,
      text: {
        format: {
          type: "json_schema",
          name: opts.schemaName,
          strict: true,
          schema: opts.schema,
        },
      },
    }),
  });

  const body: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("OpenAI error", response.status, body);
    if (response.status === 429) throw new AiGatewayError("AI is busy right now. Please try again shortly.", 429);
    throw new AiGatewayError(body?.error?.message || "AI generation failed.", response.status);
  }

  const text = body?.output_text || body?.output?.flatMap((item: any) => item?.content || [])
    ?.find((part: any) => part?.type === "output_text")?.text;
  if (!text) throw new AiGatewayError("AI returned no content.", 500);
  return JSON.parse(text) as T;
}
