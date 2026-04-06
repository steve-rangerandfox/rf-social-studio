import React, { useRef, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useStudio } from "../StudioContext.jsx";
import { Row } from "./Row.jsx";
import { InlineCreateRow } from "./InlineCreateRow.jsx";
import { EmptyState } from "./EmptyState.jsx";
import { MONTHS_FULL, PLATFORMS, T } from "../shared.js";

export function ListView() {
  const {
    view, timeScale, month, year,
    sorted, grouped, sel, toggleSel, toggleAll,
    connections,
    update, remove, showToast,
    selectedRowId, setSelectedRowId,
    makeDrag, add,
    monthRefs, maxMonthCount,
    inlineCreateActive,
  } = useStudio();

  const parentRef = useRef(null);

  /* ── Month view virtualizer ── */
  const monthVirtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 86,
    overscan: 10,
    enabled: view === "list" && timeScale === "month",
  });

  /* ── Year view: flatten grouped data ── */
  const flatItems = useMemo(() => {
    if (timeScale !== "year") return [];
    const items = [];
    for (const group of grouped) {
      items.push({ type: "header", group });
      if (group.rows.length === 0) {
        items.push({ type: "empty", group });
      } else {
        for (const row of group.rows) {
          items.push({ type: "row", row, group });
        }
      }
    }
    return items;
  }, [grouped, timeScale]);

  const yearVirtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const item = flatItems[index];
      if (item.type === "header") return 44;
      if (item.type === "empty") return 120;
      return 86;
    },
    overscan: 10,
    enabled: view === "list" && timeScale === "year",
  });

  if (view !== "list") return null;

  const renderRow = (row, idx) => (
    <Row
      key={row.id}
      row={row}
      sel={sel.has(row.id)}
      onSel={v => toggleSel(row.id, v)}
      onChange={p => update(row.id, p)}
      onDel={() => { remove(row.id); showToast("Post removed", T.red); }}
      onSelect={() => setSelectedRowId(row.id)}
      isSelected={selectedRowId === row.id}
      hasConnectedAccount={connections.instagram || connections.linkedin}
      dragHandlers={makeDrag(row, idx)}
    />
  );

  return (
    <div className="t-area">
      {timeScale === "month" && (
        <div className="list-month-heading">
          <span className="list-month-title">{MONTHS_FULL[month]}</span>
          <span className="list-month-year">{year}</span>
        </div>
      )}

      <div className="t-head">
        <div className="th"><input type="checkbox" className="cb" checked={sel.size === sorted.length && sorted.length > 0} onChange={e => toggleAll(e.target.checked)} /></div>
        <div className="th" />
        <div className="th">Date / Time PT</div>
        <div className="th">Title</div>
        <div className="th" />
        <div className="th" />
        <div className="th">Status</div>
        <div className="th" />
      </div>

      {inlineCreateActive && <InlineCreateRow />}

      {timeScale === "month" ? (
        <>
          {sorted.length === 0
            ? <EmptyState
                title={`${MONTHS_FULL[month]}'s clear`}
                subtitle="Start building your queue for this month."
                actionLabel="+ Add post"
                onAction={() => add(month)}
              />
            : (
              <div ref={parentRef} style={{ height: "100%", overflow: "auto" }}>
                <div style={{ height: `${monthVirtualizer.getTotalSize()}px`, position: "relative" }}>
                  {monthVirtualizer.getVirtualItems().map((virtualItem) => (
                    <div
                      key={sorted[virtualItem.index].id}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                    >
                      {renderRow(sorted[virtualItem.index], virtualItem.index)}
                    </div>
                  ))}
                </div>
              </div>
            )
          }
          {sorted.length > 0 && (
            <div className="add-row"><button className="add-btn" onClick={() => add(month)}>+ Add post</button></div>
          )}
        </>
      ) : (
        /* YEAR VIEW — grouped by month with sticky headers, virtualized */
        <div ref={parentRef} style={{ height: "100%", overflow: "auto" }}>
          <div style={{ height: `${yearVirtualizer.getTotalSize()}px`, position: "relative" }}>
            {yearVirtualizer.getVirtualItems().map((virtualItem) => {
              const item = flatItems[virtualItem.index];

              if (item.type === "header") {
                const { mi, mName, rows: mRows } = item.group;
                const igM = mRows.filter(r => r.platform.startsWith("ig")).length;
                const liM = mRows.filter(r => r.platform === "linkedin").length;
                const barH = (n) => Math.max(Math.round((n / maxMonthCount) * 14), 2);
                return (
                  <div
                    key={`header-${mi}`}
                    ref={el => { if (el) monthRefs.current[mi] = el; }}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <div className="month-anchor-header">
                      <span className="month-anchor-label">{mName} {year}</span>
                      <span className="month-anchor-count">{mRows.length} post{mRows.length !== 1 ? "s" : ""}</span>
                      <div className="month-sparkline">
                        {igM > 0 && <div className="month-spark-bar ig fill" style={{ height: barH(igM) }} title={`${igM} IG`} />}
                        {liM > 0 && <div className="month-spark-bar li fill" style={{ height: barH(liM) }} title={`${liM} LI`} />}
                      </div>
                    </div>
                  </div>
                );
              }

              if (item.type === "empty") {
                const { mi, mName } = item.group;
                return (
                  <div
                    key={`empty-${mi}`}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <div className="month-empty">
                      <EmptyState
                        title={`${mName}'s clear`}
                        subtitle="Start building your queue for this month."
                        actionLabel={`+ Add first post for ${mName}`}
                        onAction={() => add(mi)}
                      />
                    </div>
                  </div>
                );
              }

              /* type === "row" */
              return (
                <div
                  key={item.row.id}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  {renderRow(item.row, virtualItem.index)}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
