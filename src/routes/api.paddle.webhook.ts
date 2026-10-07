import { createFileRoute } from "@tanstack/react-router";
import { handlePaddleWebhook } from "@/lib/paddle.webhook.server";

export const Route = createFileRoute("/api/paddle/webhook")({
  server: { handlers: { POST: async ({ request }) => handlePaddleWebhook(request) } },
});
