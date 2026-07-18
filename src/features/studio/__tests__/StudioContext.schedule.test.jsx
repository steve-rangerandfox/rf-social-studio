import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, waitFor, cleanup } from "@testing-library/react";

// Real StudioContext mounting (minimum providers) to prove the scheduling
// runtime boundary across three distinct layers:
//   1. React state / queued update  — schedulePost applies ONE atomic update
//      (media + scheduled lifecycle) only after materialization completes;
//   2. durable persistence           — that single revision reaches the Document
//      Integrity Baseline's durable store carrying frames + status together, and
//      a persistence failure surfaces through the existing saveState error owner;
// Network/IDB are deterministic in-memory doubles; materialization is mocked so
// render/upload timing is controllable without a canvas.

const h = vi.hoisted(() => ({
  materialize: { impl: null },
  fetchImpl: null,
  docStore: new Map(),
  docFail: false,
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

let authState = { userId: "user_a", getToken: async () => "token" };

vi.mock("@clerk/react", () => ({
  useAuth: () => authState,
  useUser: () => ({ user: { fullName: "Tester" } }),
}));
vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/app" }),
}));
vi.mock("../../../components/Toaster.jsx", () => ({ useToast: () => h.toast }));
vi.mock("../../../lib/api-client.js", () => ({
  setApiUserId: vi.fn(),
  fetchStudioDocument: vi.fn(() => (h.fetchImpl ? h.fetchImpl() : Promise.resolve({ document: null }))),
  saveStudioDocument: vi.fn((document, version) => Promise.resolve({ version: (version ?? 0) + 1, updatedAt: "x" })),
  fetchInstagramFeed: vi.fn(() => new Promise(() => {})),
}));
vi.mock("../../../lib/idb-store.js", () => ({
  addToSyncQueue: vi.fn(async () => {}),
  getSyncQueueByScope: vi.fn(async () => []),
  deleteSyncEntry: vi.fn(async () => true),
  saveDocument: vi.fn(async (scope, doc) => {
    if (h.docFail) throw new Error("idb down");
    h.docStore.set(scope, doc);
    return true;
  }),
  loadDocument: vi.fn(async () => null),
  saveSyncRecord: vi.fn(async () => true),
  loadSyncRecord: vi.fn(async () => null),
}));
vi.mock("../materialize-designed-media.js", () => ({
  materializeForSchedule: vi.fn((...args) => (h.materialize.impl ? h.materialize.impl(...args) : Promise.resolve(null))),
}));

import { materializeForSchedule } from "../materialize-designed-media.js";
import { loadStudioDocument, __resetSyncRecordCacheForTests } from "../document-store.js";
import { StudioProvider, useStudio } from "../StudioContext.jsx";

let ctx = null;
function Capture() {
  ctx = useStudio();
  return null;
}

const carouselRow = { id: "c1", platform: "ig_post", status: "approved", caption: "hi", carouselSlides: [{ layout: "a" }, { layout: "b" }] };
const singleRow = { id: "s1", platform: "ig_post", status: "approved", caption: "hi", mediaUrl: "https://cdn.example.com/x.jpg" };
const draftRow = { id: "d1", platform: "ig_post", status: "draft", caption: "hi" };
const FRAMES = ["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.jpg"];
const carouselPatch = { carouselFrameUrls: FRAMES, mediaKind: "carousel", mediaUrl: FRAMES[0], thumbnailUrl: FRAMES[0] };

function seed(rows) {
  h.fetchImpl = async () => ({ document: { schemaVersion: 3, rows, auditLog: [] }, version: 1 });
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  authState = { userId: "user_a", getToken: async () => "token" };
  h.materialize.impl = null;
  h.fetchImpl = null;
  h.docStore = new Map();
  h.docFail = false;
  __resetSyncRecordCacheForTests();
  ctx = null;
});
afterEach(() => cleanup());

async function mount(rows) {
  seed(rows);
  render(<StudioProvider><Capture /></StudioProvider>);
  await waitFor(() => expect(ctx?.rows?.some((r) => r.id === rows[0].id)).toBe(true));
}

const rowById = (id) => ctx.rows.find((r) => r.id === id);
const ISO = "2026-08-01T09:00:00.000Z";

describe("schedulePost — React state / queued update boundary", () => {
  it("waits for materialization, then applies ONE atomic update with frames + status + scheduledAt", async () => {
    await mount([carouselRow]);

    let resolveMat;
    h.materialize.impl = () => new Promise((res) => { resolveMat = () => res({ ...carouselPatch }); });

    let schedulePromise;
    await act(async () => { schedulePromise = ctx.schedulePost("c1", ISO); await Promise.resolve(); });

    // Materialization in flight → the row is NOT yet scheduled and has no frames.
    expect(materializeForSchedule).toHaveBeenCalledTimes(1);
    expect(rowById("c1").status).toBe("approved");
    expect(rowById("c1").carouselFrameUrls).toBeFalsy();

    // Render/upload completes → the single scheduled write lands atomically.
    await act(async () => { resolveMat(); await schedulePromise; });
    const r = rowById("c1");
    expect(r.status).toBe("scheduled");
    expect(r.scheduledAt).toBe(ISO);
    expect(r.carouselFrameUrls).toEqual(FRAMES);
  });

  it("leaves the row unscheduled when materialization fails", async () => {
    await mount([carouselRow]);
    h.materialize.impl = () => Promise.reject(new Error("canvas blocked"));

    let result;
    await act(async () => { result = await ctx.schedulePost("c1", ISO); });

    expect(result).toBe(false);
    const r = rowById("c1");
    expect(r.status).toBe("approved");
    expect(r.scheduledAt).toBeFalsy();
    expect(r.carouselFrameUrls).toBeFalsy();
  });

  it("approveAndSchedule delegates to schedulePost", async () => {
    await mount([singleRow]);
    h.materialize.impl = () => Promise.resolve(null);

    await act(async () => { ctx.approveAndSchedule("s1"); await Promise.resolve(); });

    await waitFor(() => expect(rowById("s1").status).toBe("scheduled"));
    expect(materializeForSchedule).toHaveBeenCalled();
    expect(rowById("s1").scheduledAt).toBeTruthy();
  });

  it("non-scheduled status changes stay on the generic update path (no materialization)", async () => {
    await mount([draftRow]);
    await act(async () => { ctx.update("d1", { status: "needs_review" }); await Promise.resolve(); });
    expect(rowById("d1").status).toBe("needs_review");
    expect(materializeForSchedule).not.toHaveBeenCalled();
  });
});

describe("schedulePost — durable persistence boundary (Document Integrity Baseline)", () => {
  it("the single scheduled revision reaches the durable store carrying frames + status together", async () => {
    await mount([carouselRow]);
    h.materialize.impl = () => Promise.resolve({ ...carouselPatch });

    await act(async () => { await ctx.schedulePost("c1", ISO); });

    // The Baseline debounced-persists (localStorage primary). Read the durable
    // revision back: no persisted revision exposes scheduled status without its
    // materialized frame URLs — they are one and the same revision.
    await waitFor(() => {
      __resetSyncRecordCacheForTests();
      const durable = loadStudioDocument("user_a").rows.find((r) => r.id === "c1");
      expect(durable.status).toBe("scheduled");
      expect(durable.scheduledAt).toBe(ISO);
      expect(durable.carouselFrameUrls).toEqual(FRAMES);
    });
  });

  it("a durable-persistence failure is surfaced through the existing saveState error owner", async () => {
    await mount([carouselRow]);
    h.materialize.impl = () => Promise.resolve({ ...carouselPatch });

    // Force BOTH durable stores to fail for the document key only.
    const realSet = Storage.prototype.setItem;
    const setSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function set(k, v) {
      if (String(k).startsWith("rf_studio_document")) throw new Error("QuotaExceededError");
      return realSet.call(this, k, v);
    });
    h.docFail = true;

    await act(async () => { await ctx.schedulePost("c1", ISO); });

    // The scheduled transition was accepted in state (one revision, frames+status)...
    expect(rowById("c1").status).toBe("scheduled");
    expect(rowById("c1").carouselFrameUrls).toEqual(FRAMES);
    // ...and the durable-persistence failure surfaces via the existing owner.
    await waitFor(() => expect(ctx.saveState.status).toBe("error"));
    setSpy.mockRestore();
  });
});
