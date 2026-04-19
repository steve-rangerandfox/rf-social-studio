import React from "react";
import { PublicLayout, PublicSection } from "./PublicLayout.jsx";

export function TermsOfService() {
  const updated = new Date().toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  return (
    <PublicLayout
      eyebrow="Terms"
      title="Terms of Service"
      meta={`Last updated \u00B7 ${updated}`}
    >
      <PublicSection title="Acceptance">
        <p>By using RF Social Studio, you agree to these terms. If you do not agree, do not use the service.</p>
      </PublicSection>

      <PublicSection title="What the service provides">
        <p>RF Social Studio is a social media content planning and scheduling tool. It helps you draft, organize, preview, and publish content to connected social media accounts including Instagram, TikTok, Facebook, and LinkedIn.</p>
      </PublicSection>

      <PublicSection title="Your account">
        <p>You are responsible for maintaining the security of your account credentials. You must provide accurate information when connecting social media accounts. You may not use the service for any unlawful purpose or to violate any third-party platform&rsquo;s terms of service.</p>
      </PublicSection>

      <PublicSection title="Your content">
        <p>You retain full ownership of all content you create, upload, or publish through RF Social Studio. We do not claim any rights to your posts, captions, images, or videos. You are solely responsible for the content you publish to social media platforms.</p>
      </PublicSection>

      <PublicSection title="Connected accounts">
        <p>When you connect a social media account (Instagram, TikTok, Facebook, LinkedIn), you authorize RF Social Studio to access your account data and publish content on your behalf according to the permissions you grant. You can disconnect any account at any time from the Connections panel.</p>
      </PublicSection>

      <PublicSection title="AI-generated content">
        <p>RF Social Studio includes AI caption generation powered by Anthropic&rsquo;s Claude API. AI-generated captions are suggestions only. You are responsible for reviewing and approving all content before publishing. We do not guarantee the accuracy, appropriateness, or effectiveness of AI-generated text.</p>
      </PublicSection>

      <PublicSection title="Service availability">
        <p>We aim to keep RF Social Studio available and reliable but do not guarantee uninterrupted service. We are not liable for missed or failed scheduled posts due to API outages, rate limits, or connectivity issues with third-party platforms.</p>
      </PublicSection>

      <PublicSection title="Limitation of liability">
        <p>RF Social Studio is provided &ldquo;as is&rdquo; without warranties of any kind. We are not liable for any damages arising from your use of the service, including but not limited to lost content, failed publications, or account suspensions on third-party platforms.</p>
      </PublicSection>

      <PublicSection title="Changes to terms">
        <p>We may update these terms from time to time. Continued use of the service after changes constitutes acceptance of the updated terms.</p>
      </PublicSection>

      <PublicSection title="Contact">
        <p>For questions about these terms, contact <a href="mailto:social@rangerandfox.tv">social@rangerandfox.tv</a>.</p>
      </PublicSection>
    </PublicLayout>
  );
}
