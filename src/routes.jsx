import { lazy } from "react";

// Route-level code splitting. Kept in its own module so main.jsx can stay
// focused on bootstrap / router wiring without tripping react-refresh's
// "only export components" rule.
export const AuthGate = lazy(() =>
  import("./components/AuthGate.jsx").then((m) => ({ default: m.AuthGate })),
);
export const PrivacyPolicy = lazy(() =>
  import("./components/PrivacyPolicy.jsx").then((m) => ({ default: m.PrivacyPolicy })),
);
export const TermsOfService = lazy(() =>
  import("./components/TermsOfService.jsx").then((m) => ({ default: m.TermsOfService })),
);
export const DataDeletion = lazy(() =>
  import("./components/DataDeletion.jsx").then((m) => ({ default: m.DataDeletion })),
);
export const Pricing = lazy(() =>
  import("./components/Pricing.jsx").then((m) => ({ default: m.Pricing })),
);
export const Landing = lazy(() =>
  import("./components/Landing.jsx").then((m) => ({ default: m.Landing })),
);
export const About = lazy(() =>
  import("./components/About.jsx").then((m) => ({ default: m.About })),
);
