// Inngest client singleton.
// Import this everywhere you need to send events or reference function IDs.
// The client reads INNGEST_EVENT_KEY from the environment automatically.

import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "rf-social-studio" });
