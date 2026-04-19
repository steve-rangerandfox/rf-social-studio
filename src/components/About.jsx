import React from "react";
import { PublicLayout, PublicSection } from "./PublicLayout.jsx";

export function About() {
  return (
    <PublicLayout
      eyebrow="About"
      title="A studio tool, not a SaaS dashboard."
      meta="A short statement about what we are building and why"
    >
      <PublicSection title="What we are building">
        <p>
          RF Social Studio is a social-content workspace shaped to feel like a
          working studio &mdash; planning, drafting, designing, and publishing
          inside one calm space, not five tabs strung together. It started as
          the in-house tool at Ranger &amp; Fox, the motion studio behind the
          name.
        </p>
        <p>
          Most social tools are built for marketers; we built this for content
          teams who care how their channel reads. The interface is editorial
          on purpose. The voice is calm on purpose. The number prefixes,
          warm-paper palette, and Bricolage display type are not styling &mdash;
          they are the point of view.
        </p>
      </PublicSection>

      <PublicSection title="What we believe">
        <p>
          <strong>Calm is faster than busy.</strong> Every interaction in the
          studio is one fewer thing demanding your attention. We avoid alerts,
          badges, and confetti. The work is the reward.
        </p>
        <p>
          <strong>Editorial rhythm beats dashboards.</strong> A queue should
          read like an editorial calendar, not a Jira board. A status should be
          a quiet rule on the left of a row, not a coloured pill that fights
          for foreground.
        </p>
        <p>
          <strong>AI should sound like the brand.</strong> The Brand Profile is
          the source of truth; suggestions come from it. We refuse to let the
          AI feel generic.
        </p>
        <p>
          <strong>Pricing is for working teams.</strong> Flat tiers. Free for
          solo. $5 / $10. No per-post fees. No quote-call sales motion.
        </p>
      </PublicSection>

      <PublicSection title="Who runs it">
        <p>
          Built and maintained by Stephen at Ranger &amp; Fox &mdash; a motion
          design studio in California. We use it ourselves every week, and we
          ship the product the same way we ship client work: small,
          considered, quietly opinionated.
        </p>
        <p>
          Reach us at{" "}
          <a href="mailto:social@rangerandfox.tv">social@rangerandfox.tv</a>.
          We read everything.
        </p>
      </PublicSection>

      <PublicSection title="Where to next">
        <p>
          Try it free at{" "}
          <a href="/app">the studio</a>, or read{" "}
          <a href="/pricing">the pricing</a>. Legal lives on{" "}
          <a href="/privacy">Privacy</a> and{" "}
          <a href="/terms">Terms</a>.
        </p>
      </PublicSection>
    </PublicLayout>
  );
}
