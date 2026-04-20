import React from "react";
import { PublicLayout } from "./PublicLayout.jsx";

// Editorial 404. No broken-image emoji, no "Oops!" — a short
// typeset statement with two paths back.

export function NotFound() {
  return (
    <PublicLayout
      eyebrow="404 \u00B7 Page"
      title="We can't find that page."
      meta="The studio is open, though"
    >
      <p>
        The URL you followed doesn&rsquo;t lead anywhere we publish. The path may
        have moved during our move to <code>/app</code> as the product root, or
        the link itself was mistyped.
      </p>
      <p>
        From here:
      </p>
      <ul>
        <li><a href="/">Return home</a> &mdash; the landing page.</li>
        <li><a href="/app">Open the studio</a> &mdash; if you were signed in.</li>
        <li><a href="/pricing">See pricing</a> &mdash; three flat tiers.</li>
        <li><a href="/about">About</a> &mdash; what we&rsquo;re building and why.</li>
      </ul>
      <p>
        If something here is broken, let us know at{" "}
        <a href="mailto:social@rangerandfox.tv">social@rangerandfox.tv</a>.
      </p>
    </PublicLayout>
  );
}
