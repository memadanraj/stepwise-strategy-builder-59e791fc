import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Reelforge" },
      { name: "description", content: "How Reelforge collects, uses, stores and protects account, project, billing and analytics data." },
      { property: "og:title", content: "Privacy Policy — Reelforge" },
      { property: "og:description", content: "How Reelforge handles account, project, billing and analytics data." },
      { property: "og:type", content: "article" },
      { property: "og:image", content: "https://dcxora.app/og-image.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://dcxora.app/og-image.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://dcxora.app/privacy" }],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <LegalLayout title="Privacy Policy" updated="October 7, 2026">
      <section>
        <h2>Overview</h2>
        <p>
          This policy explains what Reelforge collects, why we use it, and the choices available to you when you use the service.
        </p>
      </section>
      <section>
        <h2>Information we collect</h2>
        <ul>
          <li>Account information such as email address, display name and authentication provider.</li>
          <li>Content you create or upload, including ideas, scripts, scenes, images, audio, videos and project metadata.</li>
          <li>Usage and technical information needed to operate the service, prevent abuse and troubleshoot reliability.</li>
          <li>Billing-related identifiers supplied by Paddle. Reelforge does not store full payment card numbers.</li>
        </ul>
      </section>
      <section>
        <h2>How we use information</h2>
        <p>
          We use information to authenticate users, operate and secure the studio, generate the content you request, process billing,
          enforce plan and credit limits, prevent abuse, provide support, and improve reliability.
        </p>
      </section>
      <section>
        <h2>Service providers</h2>
        <p>
          Reelforge uses third-party providers for authentication, billing, AI generation, media processing, storage, rendering,
          YouTube integration and monitoring. They receive only the information needed to provide the requested function.
        </p>
      </section>
      <section>
        <h2>AI processing</h2>
        <p>
          Prompts and project content may be sent to the AI or media providers required to produce the output you request.
          Generated output should be reviewed before publication.
        </p>
      </section>
      <section>
        <h2>Cookies and analytics</h2>
        <p>
          Reelforge uses essential browser storage for authentication and product functionality. Optional Cloudflare Web Analytics is
          privacy-first and cookie-free; this site loads the analytics beacon only after you accept analytics in the consent banner.
        </p>
      </section>
      <section>
        <h2>Security and retention</h2>
        <p>
          We use access controls, signed URLs, server-side credentials and verified webhook signatures to protect data and integrations.
          We retain information while your account is active and for as long as reasonably necessary for security, billing, legal,
          backup and operational purposes.
        </p>
      </section>
      <section>
        <h2>Your choices</h2>
        <p>
          You can request access, correction or deletion of your account information and project data. You can also withdraw optional
          analytics consent by clearing site storage.
        </p>
      </section>
      <section>
        <h2>Children</h2>
        <p>Reelforge is not directed to children under 16, and we do not knowingly create accounts for children under that age.</p>
      </section>
      <section>
        <h2>Contact</h2>
        <p>For privacy questions or data requests, email <a className="underline" href="mailto:privacy@dcxora.app">privacy@dcxora.app</a>.</p>
      </section>
    </LegalLayout>
  );
}
