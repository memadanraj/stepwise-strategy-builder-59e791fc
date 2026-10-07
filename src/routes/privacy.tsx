import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Reelforge" },
      { name: "description", content: "How Reelforge collects, uses and protects your data, cookies and AI-generated content." },
      { property: "og:title", content: "Privacy Policy — Reelforge" },
      { property: "og:description", content: "How Reelforge handles your data and cookies." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "/privacy" }],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <LegalLayout title="Privacy Policy" updated="October 7, 2026">
      <section><h2>What we collect</h2><ul>
        <li>Account details: email, name and sign-in provider.</li>
        <li>Content you create: ideas, scripts, scenes, images, audio and videos.</li>
        <li>Billing details, processed securely by Stripe — we never store card numbers.</li>
        <li>Usage data, such as pages visited, only if you accept analytics cookies.</li>
      </ul></section>
      <section><h2>How we use it</h2><p>To run the studio, generate content with AI on your behalf, process payments, prevent abuse and improve the product. We do not sell your personal data.</p></section>
      <section><h2>AI processing</h2><p>Prompts and project content are sent to AI providers solely to produce the output you request.</p></section>
      <section><h2>Cookies</h2><p>Essential cookies keep you signed in. Analytics cookies are optional and only set after you accept them in the cookie banner. You can change your choice by clearing your browser storage.</p></section>
      <section><h2>Your rights</h2><p>You can access, export, correct or delete your data at any time. Deleting your account removes your projects and generated files.</p></section>
      <section><h2>Contact</h2><p>Questions about privacy? Email privacy@reelforge.app.</p></section>
    </LegalLayout>
  );
}
