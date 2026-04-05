import React, { useState } from "react";
import { Search } from "lucide-react";
import { useStudio } from "../StudioContext.jsx";
import { FilterMenu } from "./FilterMenu.jsx";

export function Toolbar() {
  const {
    view, query, setQuery,
    statusFilter, setStatusFilter,
    platformFilter, setPlatformFilter,
    attentionOnly, setAttentionOnly,
    attentionCount, filteredRows,
  } = useStudio();

  const [searchExpanded, setSearchExpanded] = useState(false);

  if (view === "analytics") return null;

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
      <FilterMenu
        label="Status"
        value={statusFilter}
        onChange={setStatusFilter}
        options={[
          { value: "all", label: "All statuses" },
          { value: "needs_review", label: "Needs review" },
          { value: "ready", label: "Ready" },
          { value: "approved", label: "Approved" },
          { value: "scheduled", label: "Scheduled" },
          { value: "posted", label: "Posted" },
        ]}
      />
      <FilterMenu
        label="Channel"
        value={platformFilter}
        onChange={setPlatformFilter}
        options={[
          { value: "all", label: "All channels" },
          { value: "instagram", label: "Instagram" },
          { value: "tiktok", label: "TikTok" },
          { value: "facebook", label: "Facebook" },
          { value: "linkedin", label: "LinkedIn" },
        ]}
      />
      <button className={`ops-chip subtle ${attentionOnly ? "on" : ""}`} onClick={() => setAttentionOnly((current) => !current)} title="Posts missing captions, media, owners, or approvals">
        Needs attention {attentionCount > 0 ? `(${attentionCount})` : ""}
      </button>
      {(query || statusFilter !== "all" || platformFilter !== "all" || attentionOnly) && (
        <button className="ops-clear" onClick={() => { setQuery(""); setStatusFilter("all"); setPlatformFilter("all"); setAttentionOnly(false); }}>
          Reset
        </button>
      )}
      <div className="ops-count">{filteredRows.length} shown</div>
    </div>
  );
}
