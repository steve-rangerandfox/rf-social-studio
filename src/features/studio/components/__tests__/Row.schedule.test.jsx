import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

import { Row } from "../Row.jsx";

// Row is a props-only component; its scheduled transition must delegate to the
// canonical scheduling operation (onSchedule → StudioContext.schedulePost),
// while every other status change continues through the generic onChange path.

afterEach(() => cleanup());

const dragHandlers = { onMouseEnter: () => {}, onPointerDown: () => {}, isDragging: false, isDragOver: false };

function renderRow(row, { onChange = vi.fn(), onSchedule = vi.fn() } = {}) {
  render(
    <Row
      row={row}
      sel={false}
      onSel={() => {}}
      onChange={onChange}
      onSchedule={onSchedule}
      onSelect={() => {}}
      isSelected={false}
      isFocused={false}
      dragHandlers={dragHandlers}
      hasConnectedAccount
    />,
  );
  return { onChange, onSchedule };
}

describe("Row status transitions", () => {
  it("routes a transition to scheduled through onSchedule (not onChange)", () => {
    const scheduledAt = "2026-08-01T09:00:00.000Z";
    const { onChange, onSchedule } = renderRow({
      id: "r1", status: "approved", scheduledAt, platform: "ig_post", caption: "hi", tags: [], platforms: ["ig_post"],
    });

    fireEvent.click(screen.getByRole("button", { name: /Approved/i })); // open status dropdown
    fireEvent.click(screen.getByRole("button", { name: /Scheduled/i }));

    expect(onSchedule).toHaveBeenCalledWith(scheduledAt);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("routes a non-scheduled transition through the generic onChange path", () => {
    const { onChange, onSchedule } = renderRow({
      id: "r2", status: "draft", platform: "ig_post", caption: "hi", tags: [], platforms: ["ig_post"],
    });

    fireEvent.click(screen.getByRole("button", { name: /Draft/i })); // open status dropdown
    fireEvent.click(screen.getByRole("button", { name: /In Review/i }));

    expect(onChange).toHaveBeenCalledWith({ status: "needs_review" });
    expect(onSchedule).not.toHaveBeenCalled();
  });
});
