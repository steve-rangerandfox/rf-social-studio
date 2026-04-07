import React, { useEffect, useRef, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { useStudio } from "../StudioContext.jsx";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "needs_review", label: "Needs review" },
  { value: "ready", label: "Ready" },
  { value: "approved", label: "Approved" },
  { value: "scheduled", label: "Scheduled" },
  { value: "posted", label: "Posted" },
];

const CHANNEL_OPTIONS = [
  { value: "all", label: "All channels" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
];

export function Toolbar() {
  const {
    view, query, setQuery,
    statusFilter, setStatusFilter,
    platformFilter, setPlatformFilter,
    attentionOnly, setAttentionOnly,
    attentionCount, filteredRows,
  } = useStudio();

  const [searchExpanded, setSearchExpanded] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef(null);

  useEffect(() => {
    if (!filtersOpen) return undefined;
    const handlePointerDown = (event) => {
      if (filtersRef.current && !filtersRef.current.contains(event.target)) {
        setFiltersOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [filtersOpen]);

  if (view === "analytics") return null;

  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) +
    (platformFilter !== "all" ? 1 : 0) +
    (attentionOnly ? 1 : 0);

  const hasActiveFilters = activeFilterCount > 0;

  const clearAll = () => {
    setStatusFilter("all");
    setPlatformFilter("all");
    setAttentionOnly(false);
  };

  return (
    <div className="ops-toolbar">
      {searchExpanded || query ? (
        <input
          className="ops-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search titles, captions, or owner"
          title="Search (/)"
          autoFocus={searchExpanded}
          onBlur={() => { if (!query) setSearchExpanded(false); }}
        />
      ) : (
        <button className="ops-search-trigger" onClick={() => setSearchExpanded(true)} title="Search (/)">
          <Search size={14} />
        </button>
      )}

      <div className="ops-anchor" ref={filtersRef}>
        <button
          className={`ops-filters-btn ${hasActiveFilters ? "has-filters" : ""}`}
          onClick={() => setFiltersOpen((current) => !current)}
          title="Filters"
        >
          <SlidersHorizontal size={14} />
          <span>Filters</span>
          {hasActiveFilters && <span className="ops-filters-badge">{activeFilterCount}</span>}
        </button>

        {filtersOpen && (
          <div className="ops-filters-popover" role="dialog">
            <div className="ops-filters-section">
              <div className="ops-filters-section-label">Status</div>
              <div className="ops-filters-options">
                {STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    className={`ops-filters-option ${statusFilter === option.value ? "active" : ""}`}
                    onClick={() => setStatusFilter(option.value)}
                  >
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="ops-filters-section">
              <div className="ops-filters-section-label">Channel</div>
              <div className="ops-filters-options">
                {CHANNEL_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    className={`ops-filters-option ${platformFilter === option.value ? "active" : ""}`}
                    onClick={() => setPlatformFilter(option.value)}
                  >
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="ops-filters-attention-row">
              <span className="ops-filters-attention-label">
                Needs attention {attentionCount > 0 ? `(${attentionCount})` : ""}
              </span>
              <button
                className={`ops-chip subtle ${attentionOnly ? "on" : ""}`}
                onClick={() => setAttentionOnly((current) => !current)}
              >
                {attentionOnly ? "On" : "Off"}
              </button>
            </div>

            {hasActiveFilters && (
              <button className="ops-filters-clear" onClick={clearAll}>
                Clear all
              </button>
            )}
          </div>
        )}
      </div>

      {hasActiveFilters && (
        <div className="ops-count">{filteredRows.length} shown</div>
      )}
    </div>
  );
}
