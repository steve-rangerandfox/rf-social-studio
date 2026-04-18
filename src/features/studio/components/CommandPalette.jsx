import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useStudio } from "../StudioContext.jsx";
import { MONTHS_FULL, PLATFORMS, STATUSES } from "../shared.js";

export function CommandPalette({ onClose }) {
  const {
    setView, setMonth, setAttentionOnly,
    setQuery, setStatusFilter, setPlatformFilter,
    setSettings, setAssets, setShowConn,
    add, exportData, month,
  } = useStudio();

  const [query, setQ] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Build command list
  const commands = useMemo(() => [
    // Navigation
    { id: "view-list", label: "Go to List view", shortcut: "1", section: "Navigate", action: () => setView("list") },
    { id: "view-calendar", label: "Go to Calendar view", shortcut: "2", section: "Navigate", action: () => setView("calendar") },
    { id: "view-grid", label: "Go to Grid view", shortcut: "3", section: "Navigate", action: () => setView("grid") },
    { id: "view-analytics", label: "Go to Analytics", shortcut: "4", section: "Navigate", action: () => setView("analytics") },

    // Actions
    { id: "new-post", label: "Create new post", shortcut: "N", section: "Actions", action: () => add(month) },
    { id: "search", label: "Search posts", shortcut: "/", section: "Actions", action: () => document.querySelector(".ops-search")?.focus() },
    { id: "toggle-attention", label: "Toggle needs attention filter", section: "Actions", action: () => setAttentionOnly(v => !v) },
    { id: "export", label: "Export studio data", section: "Actions", action: () => exportData() },

    // Filter by status
    ...Object.entries(STATUSES).map(([key, status]) => ({
      id: `filter-status-${key}`, label: `Filter: ${status.label}`, section: "Filter", action: () => { setStatusFilter(key); setView("list"); },
    })),

    // Filter by platform
    ...Object.entries(PLATFORMS).map(([key, platform]) => ({
      id: `filter-platform-${key}`, label: `Filter: ${platform.label}`, section: "Filter", action: () => { setPlatformFilter(key); setView("list"); },
    })),
    { id: "filter-clear", label: "Clear all filters", section: "Filter", action: () => { setQuery(""); setStatusFilter("all"); setPlatformFilter("all"); setAttentionOnly(false); } },

    // Jump to month
    ...MONTHS_FULL.map((m, i) => ({
      id: `month-${i}`, label: `Jump to ${m}`, section: "Calendar", action: () => { setMonth(i); setView("list"); },
    })),

    // Settings
    { id: "settings", label: "Open settings", section: "Settings", action: () => setSettings(true) },
    { id: "connections", label: "Manage connections", section: "Settings", action: () => setShowConn("instagram") },
    { id: "assets", label: "Open asset library", section: "Settings", action: () => setAssets(true) },
  ], [setView, add, month, setAttentionOnly, exportData, setStatusFilter, setPlatformFilter, setQuery, setMonth, setSettings, setShowConn, setAssets]);

  // Fuzzy filter
  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return commands;
    const words = q.toLowerCase().split(/\s+/);
    return commands.filter(cmd => {
      const label = cmd.label.toLowerCase();
      return words.every(word => label.includes(word));
    });
  }, [query, commands]);

  // Group by section (preserving order)
  const grouped = useMemo(() => {
    const map = new Map();
    for (const cmd of filtered) {
      if (!map.has(cmd.section)) map.set(cmd.section, []);
      map.get(cmd.section).push(cmd);
    }
    return [...map.entries()]; // [[section, items], ...]
  }, [filtered]);

  // Flat list for keyboard navigation
  const flatItems = useMemo(() => filtered, [filtered]);

  // Clamp activeIdx when results change
  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Scroll active item into view
  useEffect(() => {
    const active = listRef.current?.querySelector(".cmd-palette-item.active");
    if (active) active.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const execute = useCallback((cmd) => {
    onClose();
    // Defer action so the palette closes first
    requestAnimationFrame(() => cmd.action());
  }, [onClose]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx(i => (i + 1) % (flatItems.length || 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(i => (i - 1 + (flatItems.length || 1)) % (flatItems.length || 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flatItems[activeIdx]) execute(flatItems[activeIdx]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }, [flatItems, activeIdx, execute, onClose]);

  // Close on backdrop click
  const handleBackdrop = useCallback((e) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  // Track which section each flat index belongs to for rendering headers
  let flatIdx = 0;

  return (
    <div className="cmd-palette-backdrop" onClick={handleBackdrop}>
      <div className="cmd-palette" role="dialog" aria-label="Command palette">
        <input
          ref={inputRef}
          className="cmd-palette-input"
          type="text"
          placeholder="Type a command\u2026"
          value={query}
          onChange={e => setQ(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="cmd-palette-list" ref={listRef}>
          {grouped.length === 0 && (
            <div className="cmd-palette-empty">No matching commands</div>
          )}
          {grouped.map(([section, items]) => (
            <div key={section}>
              <div className="cmd-palette-section">{section}</div>
              {items.map(cmd => {
                const idx = flatIdx++;
                return (
                  <div
                    key={cmd.id}
                    className={`cmd-palette-item${idx === activeIdx ? " active" : ""}`}
                    onClick={() => execute(cmd)}
                    onMouseEnter={() => setActiveIdx(idx)}
                  >
                    <span className="cmd-palette-item-label">{cmd.label}</span>
                    {cmd.shortcut && (
                      <span className="cmd-palette-item-shortcut">{cmd.shortcut}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
