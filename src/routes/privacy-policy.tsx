import { createFileRoute } from "@tanstack/react-router";
import policyHtml from "@/lib/privacy-policy-content.html?raw";
import "@/lib/privacy-policy-styles.css";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy | Radiant Guard Services Pvt. Ltd." },
      {
        name: "description",
        content:
          "How Radiant Guard Services Pvt. Ltd. collects, uses, shares and protects personal data, and the rights available to you under India's Digital Personal Data Protection Act, 2023.",
      },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Privacy Policy | Radiant Guard Services Pvt. Ltd." },
      {
        property: "og:description",
        content:
          "How we collect, use, share and protect personal data, and your rights under the Digital Personal Data Protection Act, 2023.",
      },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "index,follow" },
    ],
    links: [
      { rel: "canonical", href: "https://radiant.hyperrevamp.com/privacy-policy" },
    ],
  }),
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
  return (
    <div
      className="privacy-policy-page"
      style={{ minHeight: "100dvh", background: "#f7f6f3", padding: "0 12px" }}
      // Static, company-authored policy document — not user input.
      dangerouslySetInnerHTML={{ __html: policyHtml }}
    />
  );
}
