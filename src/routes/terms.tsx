import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — Reelforge" },
      { name: "description", content: "The rules for using Reelforge: accounts, credits, subscriptions, content ownership and acceptable use." },
      { property: "og:title", content: "Terms & Conditions — Reelforge" },
      { property: "og:description", content: "The rules for using the Reelforge AI video studio." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "/terms" }],
  }),
  component: Terms,
});

function Terms() {
  return (
    <LegalLayout title="Terms & Conditions" updated="October 7, 2026">
      <section><h2>Your account</h2><p>You must be at least 16 and keep your login secure. You are responsible for activity on your account.</p></section>
      <section><h2>Credits & subscriptions</h2><p>AI generations use credits. Credits are reserved when a job starts and refunded automatically if it fails. Subscriptions renew through Paddle until cancelled; cancellation takes effect at the end of the billing period. Paddle handles payment processing, invoices and payment-method management. Purchased credits are non-refundable once used.</p></section>
      <section><h2>Your content</h2><p>You own what you create. You grant us a limited licence to store and process it only to provide the service.</p></section>
      <section><h2>Acceptable use</h2><ul>
        <li>No illegal, hateful, sexual content involving minors, or harassing content.</li>
        <li>No impersonating real people without consent or infringing others' rights.</li>
        <li>No abuse, scraping or attempts to bypass credit limits.</li>
      </ul></section>
      <section><h2>YouTube</h2><p>When you connect a channel, you also agree to the YouTube Terms of Service.</p></section>
      <section><h2>Liability</h2><p>The service is provided "as is". AI output may be inaccurate; review it before publishing.</p></section>
      <section><h2>Contact</h2><p>Questions? Email support@reelforge.app.</p></section>
    </LegalLayout>
  );
}
