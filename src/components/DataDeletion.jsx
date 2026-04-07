import React from "react";

export function DataDeletion() {
  return (
    <div style={{
      maxWidth: 720, margin: "0 auto", padding: "48px 24px",
      fontFamily: '"Switzer", system-ui, sans-serif', color: "#181714",
      lineHeight: 1.7, fontSize: 15,
    }}>
      <h1 style={{
        fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 32,
        fontWeight: 800, letterSpacing: "-0.04em", marginBottom: 8,
      }}>Data Deletion</h1>
      <p style={{ color: "#746B5E", fontSize: 13, marginBottom: 32, fontFamily: "'JetBrains Mono', monospace" }}>
        How to delete your data from RF Social Studio
      </p>

      <Section title="Disconnect your Instagram account">
        <p>To remove your Instagram data from RF Social Studio:</p>
        <ol>
          <li>Log into RF Social Studio</li>
          <li>Click <strong>Instagram</strong> in the sidebar under Connections</li>
          <li>Click <strong>Disconnect</strong></li>
        </ol>
        <p>This immediately removes your Instagram profile information and cached media data from the app.</p>
      </Section>

      <Section title="Delete all studio data">
        <p>To delete all your data including post drafts, captions, schedules, and settings:</p>
        <ol>
          <li>Open your browser's developer tools (F12)</li>
          <li>Go to the Application tab</li>
          <li>Click "Clear site data"</li>
        </ol>
        <p>This removes all locally stored data. If server-side sync is enabled, your data is also scoped to your user account and can be deleted on request.</p>
      </Section>

      <Section title="Request full deletion">
        <p>To request complete deletion of all data associated with your account, email <a href="mailto:social@rangerandfox.tv" style={{ color: "#E56A0B" }}>social@rangerandfox.tv</a> with the subject line "Data Deletion Request". We will process your request within 30 days and confirm deletion by email.</p>
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
