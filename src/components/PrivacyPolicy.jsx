import React from "react";

export function PrivacyPolicy() {
  return (
    <div style={{
      maxWidth: 720, margin: "0 auto", padding: "48px 24px",
      fontFamily: '"Oakes Grotesk", system-ui, sans-serif', color: "#181714",
      lineHeight: 1.7, fontSize: 15,
    }}>
      <h1 style={{
        fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 32,
        fontWeight: 800, letterSpacing: "-0.04em", marginBottom: 8,
      }}>Privacy Policy</h1>
      <p style={{ color: "#746B5E", fontSize: 13, marginBottom: 32, fontFamily: "'JetBrains Mono', monospace" }}>
        Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
      </p>

      <Section title="What we collect">
        <p>When you connect your Instagram account, we access your public profile information (username, profile picture, bio) and your media feed (posts, captions, timestamps) through the Instagram Graph API. We use Clerk for authentication, which handles your login credentials securely.</p>
      </Section>

      <Section title="How we use it">
        <p>Your data is used exclusively to power RF Social Studio features:</p>
        <ul>
          <li>Displaying your Instagram feed in the Grid view</li>
          <li>Showing your profile information in the connection panel</li>
          <li>Enabling content scheduling and publishing</li>
          <li>Generating analytics from your post performance</li>
        </ul>
      </Section>

      <Section title="Storage">
        <p>Your studio document (post drafts, captions, schedules) is stored in your browser's local storage and optionally synced to our Supabase database, scoped to your authenticated user account. Instagram media data is cached locally and refreshed on each session.</p>
      </Section>

      <Section title="Third-party services">
        <ul>
          <li><strong>Clerk</strong> — authentication and session management</li>
          <li><strong>Supabase</strong> — optional server-side document persistence</li>
          <li><strong>Instagram Graph API</strong> — media and profile data</li>
          <li><strong>Anthropic Claude API</strong> — AI caption generation (prompts are not stored)</li>
        </ul>
      </Section>

      <Section title="Data deletion">
        <p>You can disconnect your Instagram account at any time from the Connections panel, which removes your Instagram data from the app. To delete all studio data, clear your browser's local storage or contact us. You can also request complete account deletion by emailing the address below.</p>
      </Section>

      <Section title="Contact">
        <p>For privacy questions or data deletion requests, contact <a href="mailto:social@rangerandfox.tv" style={{ color: "#E56A0B" }}>social@rangerandfox.tv</a>.</p>
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
