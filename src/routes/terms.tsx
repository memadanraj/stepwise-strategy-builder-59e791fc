import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — Reelforge" },
      { name: "description", content: "Terms for using Reelforge, including accounts, subscriptions, credits, content, acceptable use and third-party integrations." },
      { property: "og:title", content: "Terms & Conditions — Reelforge" },
      { property: "og:description", content: "The rules for using the Reelforge AI video studio." },
      { property: "og:type", content: "article" },
      { property: "og:image", content: "https://dcxora.app/og-image.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://dcxora.app/og-image.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://dcxora.app/terms" }],
  }),
  component: Terms,
});

function Terms() {
  return (
    <LegalLayout title="Terms & Conditions" updated="October 7, 2026">
      <section><h2>Acceptance</h2><p>By creating an account or using Reelforge, you agree to these terms. Do not use the service if you cannot comply with them.</p></section>
      <section><h2>Your account</h2><p>You must be at least 16 and keep your credentials secure. You are responsible for activity performed through your account and for keeping account information accurate.</p></section>
      <section><h2>Subscriptions and credits</h2><p>Paid plans and one-time credit packs are sold through Paddle. Subscriptions renew according to the plan interval until cancelled. Cancellation normally takes effect at the end of the current billing period. Credits are consumed by generation tasks according to the pricing shown in the app; failed generation jobs may be automatically refunded where the product indicates that behavior.</p></section>
      <section><h2>Payments and refunds</h2><p>Paddle processes payments, invoices and payment-method management. Any refund rights shown at checkout, required by applicable law, or granted by Reelforge apply; otherwise, unused services may be subject to the refund rules displayed at the time of purchase.</p></section>
      <section><h2>Your content</h2><p>You retain rights in content you submit and output generated for you, subject to the rights of third-party providers and any applicable law. You grant Reelforge a limited license to host, transmit and process that content only as needed to operate the service.</p></section>
      <section><h2>Acceptable use</h2><ul><li>No unlawful, fraudulent, abusive or harmful use.</li><li>No non-consensual impersonation, infringement of others' rights, or attempts to bypass security, rate limits or credit controls.</li><li>No use of Reelforge to generate or distribute prohibited content.</li></ul></section>
      <section><h2>Third-party services</h2><p>Reelforge depends on third-party services including Supabase, Paddle, AI/media providers and YouTube. Their own terms and policies may also apply when you use those integrations.</p></section>
      <section><h2>AI output and YouTube</h2><p>AI-generated content can be inaccurate, incomplete or unsuitable. You are responsible for reviewing outputs before publishing them. When you connect or publish to YouTube, you are responsible for complying with YouTube's rules and copyright requirements.</p></section>
      <section><h2>Availability and liability</h2><p>The service is provided on an as-available basis. We do not guarantee uninterrupted operation or that every AI output will meet your expectations. To the extent permitted by law, Reelforge is not liable for indirect or consequential losses arising from use of the service.</p></section>
      <section><h2>Suspension or termination</h2><p>We may suspend or terminate accounts that materially violate these terms, create security or abuse risk, or use the service unlawfully. You may stop using the service at any time.</p></section>
      <section><h2>Contact</h2><p>Questions about these terms? Email <a className="underline" href="mailto:support@dcxora.app">support@dcxora.app</a>.</p></section>
    </LegalLayout>
  );
}
