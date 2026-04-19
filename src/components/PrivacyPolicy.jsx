import React from "react";
import { PublicLayout, PublicSection } from "./PublicLayout.jsx";

export function PrivacyPolicy() {
  const updated = new Date().toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  return (
    <PublicLayout
      eyebrow="Policy"
      title="Privacy Policy"
      meta={`Last updated \u00B7 ${updated}`}
    >
      <PublicSection title="What we collect">
        <p>When you connect your Instagram account, we access your public profile information (username, profile picture, bio) and your media feed (posts, captions, timestamps) through the Instagram Graph API. We use Clerk for authentication, which handles your login credentials securely.</p>
      </PublicSection>

      <PublicSection title="How we use it">
        <p>Your data is used exclusively to power RF Social Studio features:</p>
        <ul>
          <li>Displaying your Instagram feed in the Grid view</li>
          <li>Showing your profile information in the connection panel</li>
          <li>Enabling content scheduling and publishing</li>
          <li>Generating analytics from your post performance</li>
        </ul>
      </PublicSection>

      <PublicSection title="Storage">
        <p>Your studio document (post drafts, captions, schedules) is stored in your browser&rsquo;s local storage and optionally synced to our Supabase database, scoped to your authenticated user account. Instagram media data is cached locally and refreshed on each session.</p>
      </PublicSection>

      <PublicSection title="Third-party services">
        <ul>
          <li><strong>Clerk</strong> &mdash; authentication and session management</li>
          <li><strong>Supabase</strong> &mdash; optional server-side document persistence</li>
          <li><strong>Instagram Graph API</strong> &mdash; media and profile data</li>
          <li><strong>Anthropic Claude API</strong> &mdash; AI caption generation (prompts are not stored)</li>
        </ul>
      </PublicSection>

      <PublicSection title="Data deletion">
        <p>You can disconnect your Instagram account at any time from the Connections panel, which removes your Instagram data from the app. To delete all studio data, clear your browser&rsquo;s local storage or contact us. You can also request complete account deletion by emailing the address below.</p>
      </PublicSection>

      <PublicSection title="Contact">
        <p>For privacy questions or data deletion requests, contact <a href="mailto:social@rangerandfox.tv">social@rangerandfox.tv</a>.</p>
      </PublicSection>
    </PublicLayout>
  );
}
