import assert from "node:assert/strict";
import { test } from "node:test";

import { saveStudioDocumentRecord } from "../src/server/persistence.js";

// A minimal chainable Supabase-client double. Each from() returns a fresh
// builder; the terminal .single()/.maybeSingle() resolve to the scripted
// { data, error } for the operation that was invoked (insert / update / probe).
function makeClient({ insertSingle, updateSingle, probeMaybeSingle } = {}) {
  return {
    from() {
      const builder = { _op: "probe" };
      builder.insert = () => { builder._op = "insert"; return builder; };
      builder.update = () => { builder._op = "update"; return builder; };
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.single = () => Promise.resolve(builder._op === "insert" ? insertSingle : updateSingle);
      builder.maybeSingle = () => Promise.resolve(probeMaybeSingle);
      return builder;
    },
  };
}

const env = (client) => ({ supabaseUrl: "x", supabaseServiceRoleKey: "y", supabaseClient: client });
const doc = { schemaVersion: 3, rows: [], brandProfile: { businessName: "x" } };

test("null-version create against an existing row returns conflict and never overwrites", async () => {
  const client = makeClient({
    insertSingle: { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } },
    probeMaybeSingle: { data: { version: 4 }, error: null },
  });
  const result = await saveStudioDocumentRecord(env(client), "user_a", doc, null);
  assert.deepEqual(result, { conflict: true, serverVersion: 4 });
});

test("null-version first create succeeds at version 1", async () => {
  const client = makeClient({
    insertSingle: { data: { version: 1, updated_at: "2026-07-16T00:00:00.000Z" }, error: null },
  });
  const result = await saveStudioDocumentRecord(env(client), "user_a", doc, null);
  assert.equal(result.version, 1);
  assert.equal(result.updated_at, "2026-07-16T00:00:00.000Z");
});

test("expected-version update retains optimistic-lock conflict semantics", async () => {
  const client = makeClient({
    updateSingle: { data: null, error: { code: "PGRST116" } }, // zero-row update
    probeMaybeSingle: { data: { version: 9 }, error: null },
  });
  const result = await saveStudioDocumentRecord(env(client), "user_a", doc, 3);
  assert.deepEqual(result, { conflict: true, serverVersion: 9 });
});

test("expected-version update succeeds and bumps the version", async () => {
  const client = makeClient({
    updateSingle: { data: { version: 6, updated_at: "t" }, error: null },
  });
  const result = await saveStudioDocumentRecord(env(client), "user_a", doc, 5);
  assert.equal(result.version, 6);
});
