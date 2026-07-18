import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// DetailPanel's status-select transition to "scheduled" must delegate to the
// canonical StudioContext.schedulePost; every other status change stays on the
// generic update() path. useStudio is mocked with spies, and DetailPanel's heavy
// child components / supabase module-load are stubbed so this stays a narrow
// delegation test rather than a full-panel mount.

vi.mock("../../../../lib/supabase.js", () => ({ uploadAssetWithProgress: vi.fn(), checkFileSize: vi.fn() }));
vi.mock("../StoryThumbnail.jsx", () => ({ StoryThumbnail: () => null }));
vi.mock("../AICaptionAssist.jsx", () => ({ AICaptionAssist: () => null }));
vi.mock("../CrossPostModal.jsx", () => ({ CrossPostModal: () => null }));
vi.mock("../PostPreviews.jsx", () => ({ NetworkPreview: () => null, PreviewEmptyState: () => null }));
vi.mock("../MediaGallery.jsx", () => ({ MediaGallery: () => null }));
vi.mock("../CapabilityDialog.jsx", () => ({ CapabilityDialog: () => null }));
vi.mock("../EditImageModal.jsx", () => ({ EditImageModal: () => null }));
vi.mock("../MediaViewerModal.jsx", () => ({ MediaViewerModal: () => null }));
vi.mock("../DateTimePicker.jsx", () => ({ DateTimePicker: () => null }));

const spies = vi.hoisted(() => ({ update: null, schedulePost: null, ctx: null }));
vi.mock("../../StudioContext.jsx", () => ({ useStudio: () => spies.ctx }));

import { DetailPanel } from "../DetailPanel.jsx";

const baseRow = {
  id: "r1", platform: "ig_post", status: "approved", scheduledAt: "2026-08-01T09:00:00.000Z",
  note: "Post", caption: "hello", tags: [], platforms: ["ig_post"], mediaItems: [], comments: [],
};

function setup(rowOverrides = {}) {
  const update = vi.fn();
  const schedulePost = vi.fn();
  spies.update = update;
  spies.schedulePost = schedulePost;
  spies.ctx = {
    selectedRowId: "r1",
    setSelectedRowId: vi.fn(),
    rows: [{ ...baseRow, ...rowOverrides }],
    update,
    remove: vi.fn(),
    showToast: vi.fn(),
    setComposer: vi.fn(),
    setStory: vi.fn(),
    setPublishConfirm: vi.fn(),
    connections: { instagram: true, linkedin: false },
    currentUser: { id: "u1", name: "Tester" },
    team: [],
    addComment: vi.fn(),
    approveAndSchedule: vi.fn(),
    schedulePost,
  };
  render(<DetailPanel />);
  return { update, schedulePost };
}

afterEach(() => cleanup());
beforeEach(() => { spies.update = null; spies.schedulePost = null; spies.ctx = null; });

describe("DetailPanel status transition delegation", () => {
  it("routes a transition to scheduled through schedulePost (not update)", () => {
    const { update, schedulePost } = setup();

    fireEvent.click(document.querySelector(".stage-select-trigger")); // open approval menu
    fireEvent.click(screen.getByRole("button", { name: /Scheduled/i }));

    expect(schedulePost).toHaveBeenCalledWith("r1", "2026-08-01T09:00:00.000Z");
    expect(update).not.toHaveBeenCalledWith("r1", expect.objectContaining({ status: "scheduled" }));
  });

  it("routes a non-scheduled transition through the generic update path", () => {
    const { update, schedulePost } = setup();

    fireEvent.click(document.querySelector(".stage-select-trigger"));
    fireEvent.click(screen.getByRole("button", { name: /^Draft/i })); // backward transition, allowed

    expect(update).toHaveBeenCalledWith("r1", { status: "draft" });
    expect(schedulePost).not.toHaveBeenCalled();
  });
});
