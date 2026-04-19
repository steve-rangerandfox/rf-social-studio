import React from "react";
import { PublicLayout, PublicSection } from "./PublicLayout.jsx";

export function DataDeletion() {
  return (
    <PublicLayout
      eyebrow="Data"
      title="Data Deletion"
      meta="How to delete your data from RF Social Studio"
    >
      <PublicSection title="Disconnect your Instagram account">
        <p>To remove your Instagram data from RF Social Studio:</p>
        <ol>
          <li>Log into RF Social Studio</li>
          <li>Click <strong>Instagram</strong> in the sidebar under Connections</li>
          <li>Click <strong>Disconnect</strong></li>
        </ol>
        <p>This immediately removes your Instagram profile information and cached media data from the app.</p>
      </PublicSection>

      <PublicSection title="Delete all studio data">
        <p>To delete all your data including post drafts, captions, schedules, and settings:</p>
        <ol>
          <li>Open your browser&rsquo;s developer tools (F12)</li>
          <li>Go to the Application tab</li>
          <li>Click &ldquo;Clear site data&rdquo;</li>
        </ol>
        <p>This removes all locally stored data. If server-side sync is enabled, your data is also scoped to your user account and can be deleted on request.</p>
      </PublicSection>

      <PublicSection title="Request full deletion">
        <p>To request complete deletion of all data associated with your account, email <a href="mailto:social@rangerandfox.tv">social@rangerandfox.tv</a> with the subject line &ldquo;Data Deletion Request&rdquo;. We will process your request within 30 days and confirm deletion by email.</p>
      </PublicSection>
    </PublicLayout>
  );
}
