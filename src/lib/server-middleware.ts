import { createMiddleware } from "@tanstack/react-start";

// Client-safe wrappers: the real implementations live in *.server.ts modules,
// which import protection blocks from the client bundle. They are loaded
// lazily inside the server handler so they never enter the client graph.

export const rateLimitServerFunctions = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const mod = await import("./rate-limit.server");
    return mod.rateLimit(next);
  },
);

export async function reportServerError(error: unknown, context: Record<string, unknown> = {}) {
  const mod = await import("./observability.server");
  return mod.reportServerError(error, context);
}
