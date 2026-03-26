import React from "react";

export function TermsOfService() {
  return (
    <div style={{
      maxWidth: 720, margin: "0 auto", padding: "48px 24px",
      fontFamily: "'Inter', system-ui, sans-serif", color: "#181714",
      lineHeight: 1.7, fontSize: 15,
    }}>
      <h1 style={{
        fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 32,
        fontWeight: 800, letterSpacing: "-0.04em", marginBottom: 8,
      }}>Terms of Service</h1>
      <p style={{ color: "#746B5E", fontSize: 13, marginBottom: 32, fontFamily: "'JetBrains Mono', monospace" }}>
        Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
      </p>

      <Section title="Acceptance">
        <p>By using RF Social Studio, you agree to these terms. If you do not agree, do not use the service.</p>
      </Section>

      <Section title="What the service provides">
        <p>RF Social Studio is a social media content planning and scheduling tool. It helps you draft, organize, preview, and publish content to connected social media accounts including Instagram, TikTok, Facebook, and LinkedIn.</p>
      </Section>

      <Section title="Your account">
        <p>You are responsible for maintaining the security of your account credentials. You must provide accurate information when connecting social media accounts. You may not use the service for any unlawful purpose or to violate any third-party platform's terms of service.</p>
      </Section>

      <Section title="Your content">
        <p>You retain full ownership of all content you create, upload, or publish through RF Social Studio. We do not claim any rights to your posts, captions, images, or videos. You are solely responsible for the content you publish to social media platforms.</p>
      </Section>

      <Section title="Connected accounts">
        <p>When you connect a social media account (Instagram, TikTok, Facebook, LinkedIn), you authorize RF Social Studio to access your account data and publish content on your behalf according to the permissions you grant. You can disconnect any account at any time from the Connections panel.</p>
      </Section>

      <Section title="AI-generated content">
        <p>RF Social Studio includes AI caption generation powered by Anthropic's Claude API. AI-generated captions are suggestions only. You are responsible for reviewing and approving all content before publishing. We do not guarantee the accuracy, appropriateness, or effectiveness of AI-generated text.</p>
      </Section>

      <Section title="Service availability">
        <p>We aim to keep RF Social Studio available and reliable but do not guarantee uninterrupted service. We are not liable for missed or failed scheduled posts due to API outages, rate limits, or connectivity issues with third-party platforms.</p>
      </Section>

      <Section title="Limitation of liability">
        <p>RF Social Studio is provided "as is" without warranties of any kind. We are not liable for any damages arising from your use of the service, including but not limited to lost content, failed publications, or account suspensions on third-party platforms.</p>
      </Section>

      <Section title="Changes to terms">
        <p>We may update these terms from time to time. Continued use of the service after changes constitutes acceptance of the updated terms.</p>
      </Section>

      <Section title="Contact">
        <p>For questions about these terms, contact <a href="mailto:social@rangerandfox.tv" style={{ color: "#E56A0B" }}>social@rangerandfox.tv</a>.</p>
      </Section>

      <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid #D8CABA", fontSize: 12, color: "#746B5E" }}>
        Ranger & Fox Social Studio
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{
        fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 18,
        fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8,
      }}>{title}</h2>
      {children}
    </div>
  );
}
