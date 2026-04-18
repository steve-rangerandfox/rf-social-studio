# rf-social-studio — Design Audit (Static Source)

**Date:** 2026-04-18
**Branch:** `main` (commit `bcf526a`)
**Scope:** Design quality. Explicitly **skips** anything already covered in `AUDIT-REPORT.md` — a11y focus-visible, component hygiene, error-boundary recovery, state-mgmt bloat, etc. This report covers design tokens, typography, color system, component composition, responsive, IA, microcopy, and benchmark.

## What this audit is — and is not

**Source-grounded:** token scale extraction, class inventory, media-query enumeration, JSX string extraction, component composition review. Every finding cites `file:line`.

**Not in this pass (needs live pixels):** rendered visual hierarchy, actual contrast ratios of real overlapping layers, content-density at realistic data volumes, motion perception, interaction timing feel, mobile touch ergonomics at scale, real-world usage hotspots. A follow-up live pass with a working browser MCP would tighten these.

**Attempted but blocked:** the claude-flow `browser_open` tool returned `spawnSync agent-browser ENOENT`; no screenshots taken. Dev server (`npm run dev`) was booted and verified reachable, then killed.

**Scope mismatch to flag:** the original prompt asked for `dashboard, project, artist, calendar, 2 modals` — **this app has no `project` or `artist` concept.** It is a single-document content planner: one studio doc per user, containing a flat list of rows (posts) with platform/status/scheduledAt/caption. The 4 views are **List, Calendar, Grid (IG), Analytics**. Those are audited here; project/artist are not applicable.

---

## 1. Executive summary

| Severity | Count | Theme |
|----------|-------|-------|
| Critical | 2 | Legacy/misnamed color tokens (`mint`/`pink`/`purple` aren't what they claim); missing spacing/shadow/duration scales — every layout reimplements from scratch |
| High | 9 | CSS ↔ JS token drift; ~7 responsive breakpoints with no tier; inline-styled public pages; unused semantic `--t-success`; ambiguous success-toast color; StoryDesigner magic numbers; `ready` filter value not in `STATUSES`; 3 duplicate outside-click handlers per Row; no stacking Toast |
| Medium | 16 | ASCII vs Unicode ellipsis mix; duplicate toast copy ("Post removed"); Assets button `✕`-as-state is non-obvious; public pages have no back-nav or brand-mark; Analytics page width capped 880px (will look lost on ultrawide); 3 near-duplicate slide-panels; sidebar `24` hex-alpha magic; redundant tokens (`mint-fog`/`ink-fog`); numbered-section motif only partial; CommandPalette no recents/pinning; DataDeletion instructs "open DevTools F12"; Row uses 3 dropdowns → "sticky modal" feel; no `--text-3xl`/`--text-4xl`; hero titles at 29/32/36/42/48/78px all inline; skeleton dims hardcoded; Topbar "Cal" vs Sidebar "Calendar" label inconsistency |
| Low | 10+ | Lowercase placeholder ellipses, lots of title-only tooltips (no visible hint), minor hex-literal inconsistencies |

**Headline:** the design is cohesive at the level of *aesthetic* (warm paper, editorial type, gradient primary, ink-black text) but soft at the level of *system*. Color is named by intent in some places (`text-sub`, `border2`) and by legacy metaphor in others (`mint`, `pink`, `purple`) — the latter no longer match their values. Spacing, shadow, and motion are not tokenized at all. Public pages drift from the main stack. Two legitimate standouts: the **status-description microcopy** (`shared.js:44-74`) and the **editorial numbered sidebar** (`Sidebar.jsx:59,91,107`).

---

## 2. Design tokens — source-grounded

### 2.1 Color (from `studio.css:4-64`, `shared.js:1-28`)

Tokens are declared in two places — CSS variables in `:root` and a JS object `T` in `shared.js`. Both are used; both drift.

| Token (CSS var / JS key) | Value | Usage read | Verdict |
|--------------------------|-------|------------|---------|
| `--t-bg` / `bg` | `#F3EEE5` | App background | ✓ paper-warm, consistent |
| `--t-surface` / `surface` | `#FEFCF8` | Cards, modals | ✓ |
| `--t-s2`, `--t-s3` | `#F7F1E8`, `#ECE1D3` | Surface tiers | ✓ |
| `--t-border`, `--t-border2` | `#D8CABA`, `#BAAA96` | Borders | ✓ |
| `--t-ink` / `ink` | `#181714` | Primary text/black | ✓ |
| **`--t-mint` / `mint`** | **`#181714`** | Called `mint` throughout code, but it's **ink-black**. Also duplicates `--t-ink`. | ❌ legacy naming |
| **`--t-mint-dim`** | **`#11100E`** | Unused "dim mint" (blacker than ink) | ❌ dead code |
| **`--t-mint-fog`** | `rgba(24,23,20,0.05)` | Exact duplicate of `--t-ink-fog` | ❌ redundant |
| `--t-text` / `text` | `#181714` | Same as ink | ⚠ duplicate |
| `--t-text-sub` / `textSub` | `#4E473E` | | ✓ |
| `--t-text-dim` / **`textDim`** | CSS: `#5E574C`; **JS: `#746B5E`** | **drift** between CSS vs JS | ❌ two truths |
| `--t-success` | `#10B981` | **Declared but not used** — toasts use `T.mint` for success | ❌ semantic miss |
| `--t-red` / `red` | `#DC2626` | Destructive, error | ✓ |
| `--t-amber` / `amber` | `#C96A12` | Warn/near-limit | ✓ |
| **`--t-pink`** / `pink` | `#6D5C55` | Named "pink", is **brown/taupe**. Used for `.analytics-chart-bar-ig` | ❌ legacy naming |
| **`--t-purple`** / `purple` | `#5E554E` | Named "purple", is **brown**. | ❌ legacy naming |
| `--t-blue` | `#3F5963` | Muted slate, used for IG bar LinkedIn chart | ⚠ muted — not a real blue |
| `--t-orange`, `--t-orange-bright`, `--t-gold` | warm brand trio used in primary CTA gradient | ✓ coherent |
| `--t-lilac`, `--t-cyan` | `#D99BFF`, `#82C7FF` | Used only in `--t-poster-grad` | ⚠ only appear inside gradients, never exposed as standalone tones |
| `--t-poster-grad` | 4-stop warm→cool gradient | Used for `.btn-primary` background | ✓ signature |
| `--t-accent-gold` | `#D3B986` | `::selection` highlight | ✓ |
| `--t-amber-dark`, `--t-amber-darker` | `#7A3200`, `#5D2400` | Used only in `.btn-ai` | ⚠ single-use, could inline |

**Semantic status colors are NOT in the token scale** — `shared.js:42-73` defines 6 status `dot` colors inline (`#B5ADA0`, `#5B7FA6`, `#E56A0B`, `#3D8C5C`, `#5BA8B5`, `#181714`). Likewise **platform colors** (`shared.js:30-37`) — all 6 platforms have inline `color`/`bg` hex. These should be tokenised as `--status-{idea|draft|…}` and `--platform-{ig|li|…}`.

**Team colors random-picked from `createTeamMember` (`shared.js:103`):** `["#0369A1","#BE185D","#7C3AED","#059669","#D97706","#DC2626"]` — none in the token scale.

| Severity | File:Line | Issue | Fix | Effort |
|----------|-----------|-------|-----|--------|
| **Critical** | `studio.css:13-15` + `shared.js:10-12` | `--t-mint` / `--t-mint-dim` / `--t-mint-fog` are misnamed legacy tokens that resolve to ink-black; `--t-pink` and `--t-purple` are browns | Rename per semantic intent (`--t-success`, `--t-neutral-warm`, `--t-neutral-brown`) or delete the dead duplicates. Introduce a deprecation pass with find-and-replace. | M |
| High | `shared.js:15` vs `studio.css:18` | `textDim` = `#746B5E` in JS, `#5E574C` in CSS — two different colors for the same semantic name | Pick one (CSS source of truth) and generate `shared.js` from it, or delete `T` object entirely and have components read CSS vars via `getComputedStyle`/`style=var(--x)` | M |
| High | `studio.css:19` | `--t-success: #10B981` declared, never used. Success toasts set `T.mint` (ink-black) so the only color feedback distinguishing success from neutral is… none. `T.red` vs `T.mint` is the only live semantic contrast in Toast. | Route success toasts through a `variant="success"` that uses `--t-success` with a minty-green dot, not ink. Or remove `--t-success` and accept that neutral ink = all non-error confirmations. Either way, stop declaring it if unused. | S |
| High | `studio.css` `:root` | No platform-color or status-color tokens — each of 12+ semantic colors lives inline in `shared.js` | Add `--platform-{ig,li,fb,tt}` and `--status-{idea,draft,needs-review,approved,scheduled,posted}` tokens. Reference them from `shared.js` via CSS vars at consumption sites instead of hex literals. | M |
| Medium | `studio.css:27-28` | `--t-lilac` / `--t-cyan` only ever appear inside gradient stops; they are not usable as standalone swatches | Either expose as standalone accents (with usage guidelines) or demote to gradient-stop-only constants named `--grad-stop-*` | S |

### 2.2 Radius (`studio.css:34-38`)
```
--radius-sm:  6px
--radius-md:  12px
--radius-lg:  20px
--radius-xl:  28px
--radius-pill: 999px
```
Clean 5-step scale. Small wart: radius `7px`, `8px`, `14px`, `16px`, `18px`, `24px`, `26px`, `30px` still appear literal throughout (`.plat-tabs:336`, `.sd-text-align:1353`, `.li-card`, `.bulk` pill at `999px` when `--radius-pill` exists, auth `borderRadius: "18px"`, Clerk appearance `borderRadius: "26px"` and `"16px"`, inline `border-radius: 16px` in mobile `.bulk`, etc.). **~20 hex-level radius values outside the scale.**

### 2.3 Type scale (`studio.css:41-47`)
```
--text-xs:   11px
--text-sm:   12px
--text-base: 14px
--text-md:   16px
--text-lg:   19px
--text-xl:   23px
--text-2xl:  29px
```

| Step | Ratio to prev | Comment |
|------|---------------|---------|
| 11→12 | 1.09 | Very small jump |
| 12→14 | 1.17 | |
| 14→16 | 1.14 | |
| 16→19 | 1.19 | |
| 19→23 | 1.21 | |
| 23→29 | 1.26 | Widest jump |

Ratios are not a clean musical/modular scale (1.125, 1.2, 1.25, 1.333). The low end (11/12/14/16) is crowded and hard to use meaningfully — 11 vs 12 is barely perceptible. Reasonable 5-step scale would be 12/14/16/20/24 or 13/16/20/25/31. **Missing `--text-3xl` and `--text-4xl`:** hero titles are hardcoded at `.analytics-hero-title: 36px` (`studio.css:279`), `.list-month-title: 42px` (`studio.css:1313`), `.stage-summary-title: var(--text-2xl)`=29px (`studio.css:455`), AuthGate title `clamp(48px, 6vw, 78px)` (`AuthGate.jsx:116`), PrivacyPolicy/Terms `32px` h1 and `18px` h2 — **none** of those are in the scale.

| Severity | File:Line | Issue | Fix | Effort |
|----------|-----------|-------|-----|--------|
| Medium | `studio.css:41-47` | Scale has 7 steps with uneven ratios and no `3xl`/`4xl`; 5+ display sizes live inline (32, 36, 38, 42, 48, 78px). | Consolidate to a 7-step 1.2 ratio scale: `xs 12 / sm 14 / base 16 / md 18 / lg 22 / xl 26 / 2xl 32 / 3xl 40 / 4xl 52`. Map every literal font-size to the nearest step. | M |
| Low | `studio.css:44`, `studio.css:45` | `--text-base: 14px` is small for an *app* default (Notion uses 15, Linear 14 density, Asana 14 default). | Validate with live pass — 14px default may be fine at this density, but the current UI stacks 11/12/14 for stats/meta/body which creates visual noise. | S |

### 2.4 Spacing — **NO TOKENS**

Grep confirms: zero `--space-*` or `--s-*` spacing variables. Hardcoded values appear throughout in this distribution (sampled across `studio.css` and 10 components):

`2, 4, 6, 7, 8, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 42, 48, 56, 72, 80, 90, 96, 120, 200, 248, 268, 340, 460, 480, 560, 960...`

Most fit a 4px grid but many don't (7, 10, 11, 14, 18, 22, 28, 42 — all off-grid at 4px, though on-grid at 2px). No discipline enforced.

| Severity | File:Line | Issue | Fix | Effort |
|----------|-----------|-------|-----|--------|
| **Critical** | `studio.css` (repo-wide) | No spacing scale; every component picks its own gap/padding | Introduce `--space-{0,1,2,3,4,5,6,8,10,12}` on a 4px base (0,4,8,12,16,20,24,32,40,48). Migrate highest-impact files first: `Row.jsx`, `StudioApp.jsx`, `AuthGate.jsx`. Lint with stylelint-declaration-strict-value. | L |

### 2.5 Shadow — **NO TOKENS**

Shadows inlined at every `.btn-ghost`, `.btn-primary`, `.modal`, `.bulk`, `.toast`, `.detail-panel`, `.cmd-palette`, `.dp-published-icon`, etc. Sampled distinct shadows:

```
0 10px 24px rgba(24,23,20,0.04)        /* t-head */
0 10px 24px rgba(24,23,20,0.14)        /* logo-mark */
0 8px 24px rgba(24,23,20,0.05)         /* btn-ghost */
0 14px 30px rgba(229,106,11,0.18)      /* btn-primary */
0 18px 36px rgba(229,106,11,0.22)      /* btn-primary:hover */
0 12px 28px rgba(229,106,11,0.24)      /* btn-now */
0 16px 34px rgba(229,106,11,0.28)      /* btn-now:hover */
0 16px 48px rgba(24,23,20,0.08)        /* dt-popup */
0 18px 50px rgba(24,23,20,0.08)        /* bulk */
0 18px 50px rgba(24,23,20,0.12)        /* popover, undo-toast */
0 18px 50px rgba(24,23,20,0.16)        /* cmd-palette */
0 20px 50px rgba(24,23,20,0.08)        /* toast */
0 24px 80px rgba(24,23,20,0.2)         /* canvas-wrap */
0 32px 80px rgba(24,23,20,0.12)        /* modal */
-20px 0 60px rgba(24,23,20,0.08)       /* detail-panel */
```

**~15 distinct shadows**, clearly growing out of ad-hoc tuning rather than an elevation system.

| Severity | File:Line | Issue | Fix | Effort |
|----------|-----------|-------|-----|--------|
| **Critical** | `studio.css` (repo-wide) | No shadow scale; every surface defines its own | Introduce 5-step elevation: `--shadow-xs` (subtle hairline), `--shadow-sm` (hover lift), `--shadow-md` (popover), `--shadow-lg` (modal/panel), `--shadow-xl` (focused canvas). Map primary-button glow separately (`--shadow-primary`) since it's colored. | M |

### 2.6 Motion — **NO TOKENS**

Sampled transition durations: `0.08s, 0.1s, 0.12s, 0.15s, 0.18s, 0.2s, 0.22s`. Keyframe durations add `0.15s, 0.18s, 0.2s`.

Easing curves inlined: `cubic-bezier(0.34,1.2,0.64,1)` (toast, modal, bulk, drawer — 4 callsites), `cubic-bezier(0.34,1.1,0.64,1)` (detail-panel — 1 callsite, inconsistent overshoot), `cubic-bezier(0.34,1.3,0.64,1)` (popIn, inline-create — 2 callsites), `cubic-bezier(0.4,0,0.2,1)` (canvas-wrap transform — 1 callsite, totally different curve).

| Severity | File:Line | Issue | Fix | Effort |
|----------|-----------|-------|-----|--------|
| High | `studio.css` (repo-wide) | 7 durations and 4 near-identical spring curves, none tokenised | Add `--duration-{fast:100ms,base:150ms,slow:200ms,panel:220ms}` and `--ease-{out, overshoot-sm, overshoot-md}`. Consolidate the three 0.34/1.x/0.64/1 curves into one. | S |

### 2.7 Z-index (`studio.css:50-55`) — clean scale
```
--z-content:  0
--z-sticky:  10
--z-dropdown:20
--z-panel:   30
--z-modal:   40
--z-toast:   50
```
Violations: `Row.jsx:93` sets `zIndex: 20` inline (matches `--z-dropdown` numerically but not by reference); `studio.css:1343` sets `z-index: 10` literal for `.layer-drop-indicator`.

---

## 3. Typography

### 3.1 Font stack
1. **`Bricolage Grotesque`** — display; `opsz 12..96` variable with weights 500/600/700/800 (`studio.css:1`). Used on month titles, modal titles, analytics hero, detail-panel titles, `.tb-month`/`.tb-year`, auth hero.
2. **`Switzer`** — body; weights 300/400/500/600/700 (`studio.css:2`). Default for `html/body` (`studio.css:71`).
3. **`JetBrains Mono`** — mono; weights 400/500 (`studio.css:1`). Used on badges, labels, section kickers, counters, rate-limit badge, char counters.
4. **`Plaak Ney`** — display heavy; weight 900, local `.otf` file (`studio.css:69`). **Not referenced in any component JSX** based on grep — appears to be defined-but-unused (or only used dynamically through StoryDesigner's font picker — StoryDesigner has custom-font system, so this may be the seed font).
5. **System sans** `-apple-system, system-ui, sans-serif` — used **only** inside `.li-card` (LinkedIn preview mockup, `studio.css:495`). Correct — the mockup mimics LinkedIn.

**3 active + 1 zombie font**. `Plaak Ney` costs a local font download (`/fonts/Plaak - 56-Ney-Heavy-205TF.otf`) and a `@font-face` rule with no apparent consumer. Confirm with live pass or delete.

### 3.2 Type-style count (distinct combinations found)

Body/UI combinations (font-family × size × weight × letter-spacing × line-height):

- **Display:** Bricolage 42/0.95/800/-0.06em (list-month), Bricolage 36/1.1/700/-0.04em (analytics-hero), Bricolage 29/0.96/700/-0.06em (stage-summary), Bricolage 29/0.95/600/-0.05em (tb-month), Bricolage 23/0.9/600/-0.05em (dt-badge-day), Bricolage 19/1.1/700/-0.04em (detail-panel title, asset title), Bricolage 18/-/700/-0.02em (PrivacyPolicy h2), Bricolage 32/-/800/-0.04em (PrivacyPolicy h1), Bricolage **clamp(48…78px)/0.92/800/-0.065em** (auth-title) → **9 display styles**
- **Body:** Switzer 17/1.7/400 (auth-body), Switzer 16/1.65/400 (txa), Switzer 16/1.5/400 (inp/note-in/stage-txa), Switzer 15/1.7/400 (public pages body), Switzer 15/1.6/400 (auth-features li), Switzer 14/1.4-1.5/500 (m-item, btn-sm, cap-preview, many), Switzer 14/-/600 (stats-compact, buttons), Switzer 13/1.6/400 (Clerk subtitle), Switzer 12/1.2-1.6 (various small), Switzer 11/1.4 (xs) → **10+ body styles**
- **Mono:** JBM 11/0.12em-tracked uppercase (labels, kickers), JBM 12/0.04em (tags, counters), JBM 13/0.12em (analytics meta), JBM 10/0.12em (Clerk divider), JBM 11/0.1em (auth-kicker, form-field-label), etc. → **6+ mono styles**

**Rough total: ~25 distinct type styles in active use.** Linear, for comparison, publishes a 14-style system. Notion uses ~12. This is significantly over-differentiated, largely because hero/display sizes are one-off inline instead of stepped.

| Severity | File:Line | Issue | Fix | Effort |
|----------|-----------|-------|-----|--------|
| High | Repo-wide | ~25 distinct type styles for an app this scope | Consolidate to 12-14 named roles: `display-{xxl,xl,lg,md}`, `title-{lg,md,sm}`, `body-{lg,md,sm}`, `mono-{md,sm,xs}`, `label-{md,sm}`. Express each as a composite (size + weight + line-height + letter-spacing + font-family). | M |
| Medium | `studio.css:69` | `Plaak Ney` @font-face declared, no usage found in grepped JSX | Verify StoryDesigner font picker uses it; if not, delete the @font-face + font file (saves bundle + network) | S |

### 3.3 Editorial numbering motif

`Sidebar.jsx:59,91,107` labels sections `01 /`, `02 /`, `03 /`. `Topbar.jsx:29-31` labels views `01`, `02`, `03`, `04`. `CommandPalette.jsx:21-24` gives single-digit shortcuts `1,2,3,4`. `AuthGate.jsx:99-104` "kicker" uses the same editorial-mono vocabulary. **Good:** this is a coherent motif that signals "editorial tool, not dashboard toy" across chrome. **Gap:** doesn't carry into DetailPanel, Composer, or public pages — feels abandoned past the first screens.

---

## 4. Color system — coherence & semantics

### 4.1 Palette coherence
Warm paper-neutral base (`#F3EEE5` → `#FEFCF8` → warm greys via `s2`/`s3`) + ink-black (`#181714`) + 1 warm brand gradient (orange/gold/lilac/cyan) + 2 semantic (red `#DC2626`, amber `#C96A12`). **Coherent and distinctive.** Much more visual character than Linear/Asana/Monday — closer to a specialty editorial/magazine feel. This is a deliberate choice that mostly works.

### 4.2 Semantic assignment issues

- **Success:** `--t-success: #10B981` defined, **never used**. Toasts get `T.mint` (ink-black) for success. The only color-coding in Toast is red-vs-ink, which reads as "bad-vs-neutral" not "bad-vs-good". (`StudioApp.jsx:81,148,171,182,209,223,225`, `StudioContext.jsx:320,345,419,809`)
- **Error/destructive:** `T.red` (`#DC2626`) consistently used — good.
- **Warning:** `--t-amber` (`#C96A12`) for over-limit / near-limit / needs-attention. Consistent.
- **Info:** no dedicated token. SaveStatusBadge uses an orange border (`rgba(201,106,18,0.18)` — amber family) for `offline` state (`studio.css:1334`).
- **Status dots** (`shared.js:42-73`): 6 custom colors, none tokenised, none match semantic palette. `approved` is `#3D8C5C` (a green) — if you had a `--t-success`, that's where it would live, but `#3D8C5C` doesn't match `#10B981`. Status-green and success-green are two different greens.

| Severity | File:Line | Issue | Fix | Effort |
|----------|-----------|-------|-----|--------|
| High | `StudioApp.jsx` + `shared.js:42-73` + `studio.css:19` | Three greens floating around: `--t-success` (#10B981, unused), `approved` dot (#3D8C5C, used), `.dp-published-icon` background (#3D8C5C, matches `approved`). Success is semantically split across three colors and one of them is dead code. | Pick one green for both semantic "good" and status "approved/published". Route toasts to it. Remove the unused one. | S |

### 4.3 Contrast (static — where computable)

Text over `--t-bg` (`#F3EEE5`):
- `--t-text` `#181714` on `#F3EEE5` → ratio **~14.6:1** ✓ AAA
- `--t-text-sub` `#4E473E` on `#F3EEE5` → ratio **~8.2:1** ✓ AAA
- `--t-text-dim` `#5E574C` on `#F3EEE5` → ratio **~6.4:1** ✓ AAA
- `--t-text-dim` (JS `#746B5E`, drift) on `#F3EEE5` → ratio **~4.4:1** ≈ AA (edge)

Pill/dot states:
- `.asset-name` white on `rgba(24,23,20,0.78)` gradient — fine.
- `.ig-cell-post-kicker` `rgba(255,255,255,0.45)` on black — ratio ~7:1 (but small 6px text; borderline WCAG for readability, but this is decorative kicker).
- `.ig-cell-watermark` `rgba(255,255,255,0.18)` — intentional watermark, fine.

Over warm `--t-s2` / `--t-s3`:
- `.cap-empty` `color: var(--t-text-dim)` + `font-style: italic` on `s3` — ratio falls to ~5.5:1 depending on which text-dim you pick (CSS = 5.9, JS = 4.1). The italic-dim empty-caption pattern is the most contrast-sensitive spot in the product.

Over primary button gradient:
- `.btn-primary` uses `color: var(--t-ink)` (#181714) on a light-saturated gradient — ratio is roughly 4.5:1 at the darkest gradient stop (orange-bright) and higher elsewhere. Lives on AA edge.

| Severity | File:Line | Issue | Fix | Effort |
|----------|-----------|-------|-----|--------|
| Medium | `shared.js:15` (JS textDim `#746B5E`) | Drift from CSS produces a textDim that's at AA edge (~4.4:1) on background — any component importing `T.textDim` rather than the CSS var is less legible than the CSS-driven equivalent | Unify, then re-check the italic cap-empty styling which compounds dim + italic | S |

---

## 5. Spacing / layout / rhythm

### 5.1 Grid discipline
Base grid is implied 4px. Violations found at 2px (`.cal-wd-cell padding`, `.cb :checked::after`), 7px (`.stage-dual`-era items), 10px (`.ig-cell-post-bg padding-top`), 11px (`.ig-cell-post-bg padding-top`), 14px (`.t-row padding: 14px 16px` mobile — not in 4-grid; more readably 16/16), 22px (`.auth-title margin-top`), 42px (`auth-panel padding`, `.auth-stage padding`). Not catastrophic but visible when you scan the whole file.

### 5.2 Vertical rhythm
Most vertical gaps are 4/8/12/16/20/24. List-view `.t-row` uses `min-height:78px` + `margin-bottom:8px` gap + `border-radius:20px` — gives the card-in-list feel. **Very differentiated from Linear's dense flat rows** — more magazine-like.

### 5.3 Component widths (all inline, un-tokenised)
`sidebar: 248px`, `sidebar at tablet: 64px`, `topbar height: 86px`, `topbar mobile: min-height 72/56px`, `asset-drawer: 340px`, `detail-panel: 420px`, `settings-panel: 480px`, `connection-panel: 460px`, `modal default: 560px`, `s-modal (StoryDesigner): 960px × 90vh`, `add-post-modal: 460px`, `cmd-palette: 480px × 400px`, `cal-shell second column: 280px`, `s-bar (inspector): 268px`, `StoryDesigner canvas: 290×515px (9:16)`, `analytics-area max-width: 880px`.

| Severity | File:Line | Issue | Fix | Effort |
|----------|-----------|-------|-----|--------|
| Medium | Repo-wide | 15+ magic width values, no tokens | Introduce `--width-{sidebar, sidebar-collapsed, panel-sm, panel-md, panel-lg, modal-sm, modal-md, modal-lg}`. Current values bucketise cleanly into 7 sizes. | S |
| Medium | `studio.css:277` | `.analytics-area max-width: 880px` means Analytics page looks centered+narrow on wide displays — can feel lost on 27" screens | Either widen to `max-width: 1160px` with better data density (charts currently waste space), or intentionally anchor to a reading column and add a decorative rail on the right | M |

### 5.4 Responsive system

**Breakpoints in use** (grep of `@media (max-width`):
- `640px` (AuthGate only — inline)
- `768px` (studio.css)
- `900px` (studio.css)
- `980px` (AuthGate only — inline)
- `1024px` (studio.css)
- `1060px` (studio.css)
- `1200px` (studio.css)

**7 breakpoints, 2 of which only appear in AuthGate's inline stylesheet.** There is no 3-tier system (mobile/tablet/desktop); breakpoints accrete per-feature (`1060` for calendar panel, `1200` for calendar shell, `900` for story designer grid). Worse, `900` and `1024` are only 124px apart and do different, overlapping things.

| Severity | File:Line | Issue | Fix | Effort |
|----------|-----------|-------|-----|--------|
| High | Repo-wide | 7 breakpoints, no tier system, overlapping behaviors | Standardize on 3-4: `--bp-sm:640`, `--bp-md:900`, `--bp-lg:1200`, optional `--bp-xl:1600`. Retire `768/980/1024/1060`; fold their rules into the nearest kept breakpoint. | M |

### 5.5 Touch targets on mobile

At `@media (max-width:768px)` (`studio.css:1132`):
- `.t-row { padding: 14px 16px }` — good: row tap-target is the whole card, comfortably >44px.
- `.modal { max-width: 100vw; border-radius: 0; height: 100vh }` — goes fullscreen. Correct mobile pattern.
- `.t-row .cb, .drag-handle { display: none }` — checkbox and drag handle removed on mobile. Smart; those don't fit touch.
- `.bulk { bottom: 14px; border-radius: 16px }` — bulk action bar pinned bottom, touch-friendly.
- `.ig-grid { grid-template-columns: repeat(2, 1fr) }` — IG grid halves from 3 to 2 columns. ✓

Missing at mobile:
- No mobile nav replacement for `.sidebar { display: none }` (`studio.css:1136`). **Once the sidebar hides, there is no way on mobile to change month, see connections, access Team, or open Settings except via Command Palette or the Topbar view-toggle.** The Topbar does have a ⌘K button that opens CommandPalette — but the "⌘" glyph is not a mobile-friendly affordance. Mobile users lose access to 60% of the sidebar's functionality.
- `.view-toggle` at mobile still renders 4 pill buttons horizontally; they will reflow under 400px viewport because topbar `flex-wrap:wrap` kicks in, but nothing sets min-width or compacts labels.
- No bottom-tab nav or hamburger — the app just silently drops the sidebar.

| Severity | File:Line | Issue | Fix | Effort |
|----------|-----------|-------|-----|--------|
| **Critical** | `studio.css:1136` | On mobile, `.sidebar { display: none }` removes month jump, team, connections, settings with no replacement. Primary mobile navigation is effectively Command Palette via a tiny ⌘K button. | Add a slide-in drawer that surfaces sidebar content from a hamburger, OR add a bottom-tab nav with [List | Calendar | Grid | More], OR at minimum a visible "☰ Menu" affordance on mobile topbar. Live pass needed to pick the right pattern. | M |

---

## 6. Component composition — 10 samples

### 6.1 `Sidebar.jsx`
- Clean: editorial numbered sections, collapsible, persisted via localStorage (`loadSidebarState`/`saveSidebarState`).
- **Mixed icon library:** Uses `lucide-react` ChevronDown for section toggles, but the Settings icon at `Sidebar.jsx:131-134` is **hand-rolled inline SVG** (a gear). `lucide-react` ships `Settings` — the inline SVG is inconsistent.
- **Team online-dot** uses `T.mint` for online (which is ink-black, looks indistinguishable from an offline gray): `Sidebar.jsx:98` `background: t.id === "stephen" ? T.mint : T.textDim`. **Online = black, offline = gray** — a green online dot would be the industry convention.
- Add-post button uses `btn-primary` with 4-stop gradient — a heavy visual anchor at the top of the sidebar. Loud.
- Hardcoded `t.color + "22"` at line 96 — 22 is alpha hex = 13%. Magic number.

| Severity | Finding | Fix | Effort |
|----------|---------|-----|--------|
| High | Online status uses ink-black dot (looks identical to offline gray at a glance) | Use `--t-success` green for online (and finally give it something to do) | S |
| Medium | Inline SVG Settings icon inconsistent with lucide icon set elsewhere | Swap to `<Settings size={13} />` from lucide-react | S |

### 6.2 `Topbar.jsx`
- Shows `{Month} {Year}` in Bricolage 29px, big and editorial-magazine.
- View toggle uses numbered prefix `01 List / 02 Cal / 03 Grid / 04 Stats`. "Cal" is abbreviated only in this toggle — Sidebar and CommandPalette use "Calendar". **Label drift.**
- Assets button shows `"Assets"` when closed, `"Assets ✕"` when open (`Topbar.jsx:42`). Using `✕` as an "active state" signal is unusual — conventional pattern is button pressed-state (darker bg / filled fill) OR "✕ Close Assets".

| Severity | Finding | Fix | Effort |
|----------|---------|-----|--------|
| Medium | "Cal" only in view-toggle; other UIs say "Calendar" | Pick one; either "Calendar" everywhere (safer) or commit to "Cal" with all IA | S |
| Medium | `Assets ✕` uses × as a toggle affordance | Use standard pressed-state or relabel "Close Assets" when open | S |

### 6.3 `Toolbar.jsx`
- Good: collapsed search → expanded input, filter popover w/ active count badge, results-count chip when filters active.
- **Bug:** `STATUS_OPTIONS` at `Toolbar.jsx:8` contains `{ value: "ready", label: "Ready" }`, but `shared.js:39-75` STATUSES doesn't have a `ready` key (closest match is `approved`). Clicking "Ready" in the filter likely filters to zero rows. Either the filter logic special-cases `ready` somewhere upstream or this is dead/broken copy.
- "Needs attention" chip displays `"On" / "Off"` as text values — unusual; a pressed-state toggle with just the label would read more cleanly.

| Severity | Finding | Fix | Effort |
|----------|---------|-----|--------|
| High | `"ready"` filter value doesn't exist in STATUSES; selecting the filter may return empty or stay stuck | Verify in live pass. Either (a) remove "Ready" option, (b) add it as a composite filter (`approved` OR `scheduled`) in code | S |
| Medium | `"On" / "Off"` literal text on attention chip | Use a single-state toggle visual (pressed/unpressed) with just `"Needs attention (3)"` as the full label | S |

### 6.4 `Row.jsx`
- Complex component: 3 independent dropdowns (platform / status / row-menu) each with its own `useState` + `useEffect` outside-click handler. **Three near-identical `useEffect` blocks** at lines 34-41, 43-50, 52-59.
- Good: React.memo with explicit shallow-compare (`Row.jsx:224-233`) — appropriate for a hot list item.
- Shows AlertTriangle icon from `lucide-react` when row `needsAttention`. Good signaling.
- Inline magic `zIndex: 20` at line 93 — matches `--z-dropdown` numerically but not by reference.
- Row card styling (`studio.css:132`): gradient background, 20px radius, 8px margin-bottom. **Very card-like for a list row** — closer to Monday's card-rows than Linear's dense-lines. Feels editorial but costs vertical density (each row ~86px tall incl. margin). Live pass to judge if density is right.

| Severity | Finding | Fix | Effort |
|----------|---------|-----|--------|
| High | 3 duplicate outside-click handlers — same pattern, triplicated | Extract `useOutsideClick(ref, isOpen, setClosed)` hook | S |
| Medium | Row card is visually heavy (gradient bg, 20px radius, card-per-row) — may limit achievable density | Compare to Linear/Notion/Asana densities in a live pass; consider a `density="compact"` mode that flattens to 48-56px rows for power users | M |

### 6.5 `CommandPalette.jsx`
- Solid keyboard nav, grouped-by-section, sections preserved in insertion order.
- Fuzzy filter is word-by-word `.includes()`, not real fuzzy — typos won't match.
- Placeholder `"Type a command..."` with ASCII `...`.
- **No recents.** No pinning. ~28 commands always shown when palette is empty — Linear and Notion both surface "recently used" on empty input.
- Fixed `480×400px` — doesn't scale with viewport; on wide monitors it's a small box in the middle.
- **No inline result counts** next to filter commands (e.g., "Filter: Instagram Post — 12").

| Severity | Finding | Fix | Effort |
|----------|---------|-----|--------|
| Medium | No recent-commands memory | LRU of last 5 command IDs in localStorage → render at top when query empty | S |
| Medium | Word-`includes` isn't really fuzzy | Plug in `fuse.js` or a small hand-rolled fuzzy scorer (threshold 0.4); 30 lines | S |
| Low | Fixed 480px width | `width: min(92vw, 560px)` | S |

### 6.6 `EmptyState.jsx`
- Uses a custom inline SVG illustration (`EmptyState.jsx:7-12`) — dashed document with lines inside. **One of the stronger design moments in the app** — better than emoji-as-illustration. Respects `--t-border2`.
- Clean API: `{ title, subtitle, actionLabel, onAction }`.
- Used in ListView twice (`ListView.jsx:144,218`) with copy "Start building your queue for this month." — consistent.
- Only one illustration; every empty state uses the same graphic. Linear/Notion vary illustration by context (empty inbox vs empty search vs empty archive). Fine at this scope; something to watch as the app grows.

### 6.7 `SkeletonRows.jsx`
- Good: shimmer animation defined in CSS (`studio.css:1054-1057`), component renders N skeleton rows (default 5).
- **Hardcoded skeleton dims** at lines 14, 19, 23, 29 (`48×52`, `70%`, `40%`, `28×28` circle, `80×24` pill). If the real `.t-row` grid changes, skeletons won't match.
- No skeleton for grid view, calendar view, analytics, detail panel, composer — **only list-row skeleton exists**. Live pass would need to judge whether that's a gap.

### 6.8 `Toast.jsx`
- 6 lines of code. Single dot + message. Auto-dismiss after `3200ms`.
- **No close button.** **No stacking** — toasts replace one another (StudioApp uses `setToast(null)`). **No variants** — caller passes `color` prop (via `T.mint`/`T.red`), so the same "success" look = ink-black dot.
- Duration `3200ms` — slightly long for short messages, short for long ones.
- Kills itself with `setTimeout`; no hover-to-pause.

Compare to Linear: toasts stack bottom-right, have explicit variants (`success`, `error`, `info`, `warning`), pause on hover, include an × close, and live ~5s for short, ~7-10s for long.

| Severity | Finding | Fix | Effort |
|----------|---------|-----|--------|
| High | Toast has no stacking, no variant, no close, no pause-on-hover — only a color prop the caller hand-picks | Rewrite as `<Toaster />` with a queue, add `variant="success"|"error"|"info"|"warning"` and route callers to variants instead of colors. Add × button. Pause timer on hover. | M |

### 6.9 Public pages — `PrivacyPolicy.jsx`, `TermsOfService.jsx`, `DataDeletion.jsx`

Three files, near-identical layout, all using **inline styles**, each with its own locally-scoped `Section` helper component. Hex colors inlined:`#181714`, `#746B5E` (mismatches `--t-text-dim` in CSS), `#E56A0B`, `#D8CABA`. No brand mark. No back-to-app nav. No header/footer navigation. No responsive adjustments.

`DataDeletion.jsx:30-34` instructs users to:
> 1. Open your browser's developer tools (F12)
> 2. Go to the Application tab
> 3. Click "Clear site data"

That's developer guidance; non-technical users will be lost.

| Severity | Finding | Fix | Effort |
|----------|---------|-----|--------|
| Medium | 3 public pages are inline-styled, missing brand, missing nav, instructing users to open DevTools | Create `<PublicLayout>` component that wraps all 3 with shared header (RF logo, link to app), a container using studio.css tokens, and a footer. Replace F12 instructions with an in-app "Clear all my data" button in Settings | M |

### 6.10 Slide-in panels — `DetailPanel`, `SettingsPanel`, `ConnectionPanel`
Three distinct right-side panels (`.detail-panel:420px`, `.settings-panel:480px`, `.connection-panel:460px`) with near-identical styles — only widths and content differ. Each has its own CSS class tree (`detail-panel-*`, `settings-panel-*`, `connection-panel-*`), each re-declares `backdrop`, `header`, `body`, `footer`, and the slide-in keyframes.

| Severity | Finding | Fix | Effort |
|----------|---------|-----|--------|
| Medium | 3 near-duplicate panel implementations (~90 lines of CSS triplicated) | Create one `<SlideOverPanel>` component with `width` + `title` + `sub` props; consolidate CSS under `.slide-panel.*` | M |

---

## 7. Microcopy

### 7.1 Tone (strong point)
Brand voice is **editorial, warm, confident, understated**. Standout moments:

- `AuthGate.jsx:403` — *"Calm operations for a sharper content system."*
- `AuthGate.jsx:410-412` — *"One workspace. Calendar, grid, story design, asset library." / "Low-noise UX. Editorial rhythm — calm by default, dense when you need it." / "Team ready. Comments, approval flow, ownership tracking."*
- `shared.js:44` — *"A spark — captured but not yet developed. Move to Draft when you start writing."* (idea status description)
- `shared.js:74` — *"Live on the platform. Done."* (posted status description)
- `StudioApp.jsx:94` — Document title easter egg: *"← still here when you're ready"* when tabbed away.

This voice is significantly more distinctive than the app's peers. Keep it.

### 7.2 Consistency issues

**Ellipsis style mixing** (ASCII `...` vs Unicode `…`):

| Location | Character |
|----------|-----------|
| `Row.jsx:116` `"Post title..."` | ASCII |
| `DetailPanel.jsx:249` `"Post title..."` | ASCII |
| `DetailPanel.jsx:488` `"Add a comment..."` | ASCII |
| `CommandPalette.jsx:131` `"Type a command..."` | ASCII |
| `AICaptionAssist.jsx:46` `"Describe what to write..."` | ASCII |
| `StoryDesigner.jsx:1079` `"Name..."` | ASCII |
| `StudioContext.jsx:259` `"Your changes conflict with a newer version. Refreshing..."` | ASCII |
| `CaptionEditor.jsx:26` `"Write your caption… use @ to tag"` | **Unicode** |
| `AICaptionAssist.jsx:69` `"Describe what you\u2019re posting\u2026"` | **Unicode** |

**Ratio 7 ASCII : 2 Unicode.** Given the editorial brand voice, Unicode `…` should be the standard.

**Duplicated toast string:**
- `"Post removed"` at both `ListView.jsx:108` and `DetailPanel.jsx:210` — identical copy, two callsites. If someone decides to rephrase "Removed" or add undo hint, they have to change it in two places.

**Label drift:**
- "Calendar" in `Sidebar.jsx:59` and `CommandPalette.jsx:22`, but "Cal" in `Topbar.jsx:33` view-toggle. Not fatal, but editorial brands obsess over this.
- "Stats" in Topbar (`Topbar.jsx:29`), "Analytics" in CommandPalette (`CommandPalette.jsx:24`), `Analytics.jsx` as component name. Three names for one view.

**Confirmation-of-nothing toasts:**
- `StudioApp.jsx:81` — `onSavePressed` toasts `"Already saved · changes auto-sync"` when user hits ⌘S. Good — anticipates a common learned behavior. Keep.

### 7.3 Error messages

`StudioContext.jsx:259` — *"Your changes conflict with a newer version. Refreshing..."* — clear cause, action being taken, user doesn't have to do anything. Good.

`StudioContext.jsx:421` — *"Token refresh failed — please reconnect Instagram"* — clear cause, specific remediation. Good.

No `try/catch` user-facing errors for network failures in the API client layer surfaced through this grep; need live pass to audit failure modes.

---

## 8. Information architecture

### 8.1 Nav structure (from `StudioApp.jsx`, `Sidebar.jsx`, `Topbar.jsx`)

```
App
├── Sidebar
│   ├── Brand (RF logo + "Ranger & Fox / Social Studio")
│   ├── + Add post (primary CTA)
│   ├── 01 / Calendar → [Month | Year] time-scale + 12 month rows with counts
│   ├── 02 / Team → 3 members with online-dots
│   └── 03 / Connections → Instagram / TikTok / Facebook / LinkedIn
│       + Settings button (inline)
│
├── Main
│   ├── Topbar → Month Year / Save status / ⌘K / [01 List | 02 Cal | 03 Grid | 04 Stats] / Assets toggle
│   ├── StatsBar (compact row count / attention count)
│   ├── Toolbar (search + filters popover + count)
│   └── <one of>
│       ├── ListView (default)
│       ├── CalendarView (month grid)
│       ├── IGGridView (3-column grid preview)
│       └── Analytics (charts + top posts)
│
├── Slide-in panels (right side, mutually exclusive)
│   ├── DetailPanel (when a row is selected)
│   ├── ConnectionPanel
│   ├── SettingsPanel
│   └── AssetLibrary (drawer)
│
├── Modals (centered)
│   ├── Composer
│   ├── AddPostModal
│   ├── StoryDesigner (lazy)
│   ├── PublishConfirmModal
│   └── CommandPalette
│
└── Toasts / notifications
    ├── Toast (generic)
    ├── UndoDeleteToast
    ├── UndoToast
    ├── TokenExpiryBanner
    └── FirstRunHint
```

### 8.2 Findability

- **Primary nav (4 views)** is in 2 places: Topbar view-toggle + CommandPalette. Clear.
- **Month jump** is in Sidebar + CommandPalette. Clear.
- **Settings, Connections, Assets** are in Sidebar + CommandPalette. Clear.
- **Team** only in Sidebar; no corresponding command. Minor asymmetry.
- **Filter, Search** only in Toolbar. Not in CommandPalette as command shortcuts (you can filter by status/platform via CP, but the text-search is only via Toolbar or `/` hotkey).

### 8.3 Scope mismatch with your prompt

The prompt asked for "dashboard, project list, project detail, artist detail". These do not exist:
- No **dashboard**: the List view IS the dashboard.
- No **projects**: every user has one studio document.
- No **artists**: Team members exist (Stephen / Allyson / Jared, `shared.js:79-81`) but there's no detail page for them.
- Closest equivalents: List → Row → DetailPanel.

If the product roadmap intends to add multi-project or multi-client support, the IA will need a new top-level: `Sidebar > Workspaces > Projects > Rows`, which would fundamentally restructure the sidebar.

---

## 9. Interaction patterns — state coverage (source-derived)

| State | Coverage |
|-------|----------|
| Hover | Good. Rows, pills, buttons all have hover rules. |
| Active/pressed | Mostly missing. Only `:active` on drag handle (`studio.css:137`) and rotation handle. Most buttons just lift on hover. |
| Focus-visible | Missing across the board (already flagged in AUDIT-REPORT.md — skipping). |
| Disabled | Single rule: `.btn:disabled { opacity: 0.38; cursor: not-allowed }` (`studio.css:243`). Works for all buttons; minimalist. StoryDesigner uses inline `opacity: 0.35` for disabled state (`StoryDesigner.jsx:1336`) — drift. |
| Loading | SkeletonRows for ListView only. No calendar/grid/analytics skeleton. StoryDesigner Suspense has `fallback={null}` (flagged in AUDIT-REPORT.md). |
| Empty | `<EmptyState>` component — good, with custom SVG. Used in ListView (2 places). |
| Error | `<ErrorBoundary>` at app root (already flagged). No per-view boundaries. |
| Success feedback | Toasts (no variants, see §6.8). |

---

## 10. Benchmark — Linear / Notion / Asana

### 10.1 vs Linear
- **Typography:** Linear uses a 14-style tight system, Inter variable. rf-social-studio uses ~25 type styles with 3 font families. RF has more visual character; Linear has more consistency.
- **Color:** Linear runs cool neutral (#fcfcfd/#f7f8f9) + electric blue + semantic status palette. RF runs warm paper + warm-gradient primary + ink-black. Very different moods. Warm paper is a distinctive choice.
- **Density:** Linear's list rows are ~32-40px tall (flat, dense). RF rows are 78-86px (card-like, editorial). Different use cases — RF is for curating 30 posts/month, Linear is for 500 tickets.
- **Commands:** Both have ⌘K. Linear shows recents + context-aware at top; RF shows all ~28 commands alphabetically-by-section every time.
- **Statuses:** Linear's statuses have dot + label + description on hover + visible-in-row progress. RF does all of that (`Row.jsx:172` tooltip uses the description).

**Where RF wins:** brand voice, aesthetic differentiation, status descriptions.
**Where Linear wins:** type-system discipline, density, command-palette recents.

### 10.2 vs Notion
- **Typography:** Notion is heavily reliant on `Inter` + `SF Pro` + custom heading scale. RF uses 4 families. Both are opinionated.
- **Spacing:** Notion's 4px grid is dogmatic; RF's 4px base is aspirational (violations found at 2, 7, 10, 11, 22, 42).
- **Slash commands in-row:** Notion's `/` opens an inline menu. RF has `/` focus search, `⌘K` for commands. Different mental model — RF's is more "tool-like", Notion's is more "doc-like".
- **Empty state:** Notion varies illustration + copy per context. RF uses one illustration + similar copy everywhere.

**Where RF wins:** app-feel clarity vs Notion's doc-feel ambiguity.
**Where Notion wins:** spacing rigor, illustration variety.

### 10.3 vs Asana
- **Row pattern:** Asana's list rows are dense and flat like Linear. RF's are card-like.
- **Filter UX:** Asana's filter-chip pattern (dismiss-x on each active filter) is richer than RF's single "Filters [3]" button + popover.
- **Calendar view:** Asana renders calendar cells with colored chip per task. RF does the same (`studio.css:268`) with platform-background-tinted chips — cleaner.
- **Approval flow:** Asana has comments + approvals built into each task. RF has comments + a `needs_review → approved` status transition. Comparable; RF's status-transitions feel more editorial.

**Where RF wins:** calendar chip cleanliness, status semantics.
**Where Asana wins:** filter ergonomics, per-assignee filtering.

### 10.4 Summary of benchmark
RF's **aesthetic** beats all three. RF's **system discipline** lags all three. The aesthetic is the reason to keep using RF over a generic tool; the system gaps are the reason it will be harder to scale the design team.

---

## 11. Top 3 high-impact redesigns (Figma-style specs)

### 11.1 Consolidate & rename color tokens + introduce spacing/shadow scale

**Why it's #1:** Every other finding hinges on a real token system. The current system is 90% there on color but has dead/misnamed tokens, 0% on spacing, 0% on shadow, and 0% on motion.

**Spec:**

```css
:root {
  /* === PALETTE === */
  /* Surfaces (warm paper neutral) */
  --surface-0: #F3EEE5;   /* app bg */
  --surface-1: #F7F1E8;   /* raised */
  --surface-2: #ECE1D3;   /* depressed */
  --surface-3: #FEFCF8;   /* card */
  --border:    #D8CABA;
  --border-strong: #BAAA96;
  --divider:   rgba(24,23,20,0.08);
  --tint-ink:  rgba(24,23,20,0.05);  /* was t-ink-fog / t-mint-fog duplicate */

  /* Ink (text) */
  --ink:       #181714;
  --ink-hover: #2E2C28;
  --text:      #181714;   /* alias of --ink */
  --text-sub:  #4E473E;
  --text-dim:  #5E574C;   /* single source of truth; deprecate JS T.textDim */

  /* Semantic */
  --success:   #3D8C5C;   /* consolidate with status 'approved' dot */
  --warning:   #C96A12;
  --danger:    #DC2626;
  --info:      #5BA8B5;   /* consolidate with status 'scheduled' dot */

  /* Brand gradient (preserve) */
  --brand-0: #FF7A00;
  --brand-1: #F0B24D;
  --brand-2: #D99BFF;
  --brand-3: #82C7FF;
  --grad-primary: linear-gradient(135deg,
    var(--brand-0) 0%, var(--brand-1) 24%, var(--brand-2) 58%, var(--brand-3) 100%);

  /* Status dots (tokenised from shared.js) */
  --status-idea:         #B5ADA0;
  --status-draft:        #5B7FA6;
  --status-needs-review: #E56A0B;
  --status-approved:     #3D8C5C;   /* = --success */
  --status-scheduled:    #5BA8B5;   /* = --info */
  --status-posted:       #181714;   /* = --ink */

  /* Platform accents (tokenised from shared.js) */
  --platform-ig:  #49433B;
  --platform-fb:  #1877F2;
  --platform-li:  #4B5F66;
  --platform-tt:  #1A1A2E;

  /* === SPACING (4px base) === */
  --space-0:  0;
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-8:  32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;

  /* === TYPE SCALE (1.2 ratio, 9 steps) === */
  --text-xs:   12px;
  --text-sm:   14px;
  --text-base: 16px;
  --text-md:   18px;
  --text-lg:   22px;
  --text-xl:   26px;
  --text-2xl:  32px;
  --text-3xl:  40px;   /* NEW — replaces inline 36/38/42 */
  --text-4xl:  52px;   /* NEW — replaces inline 48/78 clamp */

  /* === RADII (keep) === */
  --radius-sm:  6px;
  --radius-md:  12px;
  --radius-lg:  20px;
  --radius-xl:  28px;
  --radius-pill: 999px;

  /* === SHADOW (NEW — 5-step elevation) === */
  --shadow-xs: 0 1px 2px rgba(24,23,20,0.04);
  --shadow-sm: 0 4px 10px rgba(24,23,20,0.06);
  --shadow-md: 0 12px 28px rgba(24,23,20,0.08);
  --shadow-lg: 0 24px 60px rgba(24,23,20,0.12);
  --shadow-xl: 0 32px 80px rgba(24,23,20,0.16);
  /* Colored brand glow */
  --shadow-brand:       0 14px 30px rgba(229,106,11,0.18);
  --shadow-brand-hover: 0 18px 36px rgba(229,106,11,0.22);

  /* === MOTION (NEW) === */
  --duration-fast:  100ms;
  --duration-base:  150ms;
  --duration-slow:  200ms;
  --duration-panel: 220ms;
  --ease-out:          cubic-bezier(0.2, 0, 0, 1);
  --ease-overshoot-sm: cubic-bezier(0.34, 1.1, 0.64, 1);   /* detail-panel-only */
  --ease-overshoot-md: cubic-bezier(0.34, 1.2, 0.64, 1);   /* modal, toast, bulk */
  --ease-overshoot-lg: cubic-bezier(0.34, 1.3, 0.64, 1);   /* popIn, inline-create */

  /* === Z-INDEX (keep) === */
  --z-content:  0;
  --z-sticky:  10;
  --z-dropdown:20;
  --z-panel:   30;
  --z-modal:   40;
  --z-toast:   50;

  /* === LAYOUT WIDTHS (NEW) === */
  --width-sidebar:           248px;
  --width-sidebar-collapsed: 64px;
  --width-panel-sm: 420px;   /* DetailPanel */
  --width-panel-md: 460px;   /* ConnectionPanel */
  --width-panel-lg: 480px;   /* SettingsPanel, CommandPalette */
  --width-modal-sm: 460px;   /* AddPostModal */
  --width-modal-md: 560px;   /* default Modal */
  --width-modal-lg: 960px;   /* StoryDesigner */
}
```

**Deprecations:** `--t-mint`, `--t-mint-dim`, `--t-mint-fog`, `--t-pink`, `--t-purple`, `--t-blue` (standalone — only used in gradients), `--t-amber-dark`, `--t-amber-darker`, `--t-lilac`, `--t-cyan` (only used in gradients).

**Migration approach:** scripted find-replace across `studio.css`, `shared.js`, and all component inline styles. Estimated files affected: ~35. Effort: **L (1 week)** but mostly mechanical; the design decisions are in the above spec.

### 11.2 Unify Toast into a proper notification system

**Why:** Toast is the primary feedback mechanism and currently has no stacking, no variant, no close, no pause. Every other system-level feedback improvement depends on a functioning toast primitive.

**Spec:**

```
<Toaster position="bottom-right" stackDirection="up" maxStack={4} />

Toast variants:
  success  → dot: var(--success), border: rgba(61,140,92,0.14), bg: rgba(61,140,92,0.04)
  error    → dot: var(--danger),  border: rgba(220,38,38,0.14), bg: rgba(220,38,38,0.04)
  warning  → dot: var(--warning), border: rgba(201,106,18,0.18), bg: rgba(201,106,18,0.04)
  info     → dot: var(--info),    border: rgba(91,168,181,0.18), bg: rgba(91,168,181,0.04)
  neutral  → dot: var(--ink),     border: var(--divider),        bg: var(--surface-3)

Layout:
  width: min(420px, calc(100vw - 32px))
  padding: var(--space-3) var(--space-4)
  border-radius: var(--radius-md)
  shadow: var(--shadow-lg)
  display: grid; grid-template-columns: 10px 1fr auto; gap: var(--space-3);

  Dot:      8×8px, border-radius: 50%, color = variant
  Message:  text-sm, ink, line-height 1.4
  Action:   optional button — text-sm, weight 600, variant-color
  Close ×:  ib-style, 24×24, text-dim on hover ink

Duration:
  success/info/neutral: 4000ms
  warning: 5500ms
  error: 7000ms (or persistent if action=true)
  Hovering pauses countdown.

Animation:
  enter: translateY(8px) + fade (var(--duration-slow) var(--ease-overshoot-md))
  exit:  translateY(-4px) + fade (var(--duration-base) var(--ease-out))
  stack shift: translateY on siblings (var(--duration-fast) var(--ease-out))

API:
  toast.success("Posted to LinkedIn")
  toast.error("Token refresh failed", { action: { label: "Reconnect", onClick: ... } })
  toast.info("Updated from another device", { duration: 6000 })
```

**Migrate callers:** 12 `showToast(msg, T.mint)` → `toast.success(msg)`; `showToast(msg, T.red)` → `toast.error(msg)`. Effort: **M (2-3 days)**.

### 11.3 Mobile nav — add a drawer or bottom tabs

**Why:** At `<768px`, the sidebar hides and there's no visible nav — mobile users can only switch views via the topbar pill-toggle and access everything else through Command Palette, which is a ⌘K button (not a mobile-friendly metaphor). Month switching, team, connections, and settings are effectively unreachable on mobile.

**Spec — Option A: slide-in drawer (safest, matches existing panel pattern)**

```
Topbar adds a leading button:
  <button class="nav-trigger" aria-label="Open navigation">
    <Menu size={18} />           /* lucide-react */
  </button>

  width: 40px; height: 40px
  border-radius: var(--radius-pill)
  background: transparent
  color: var(--text-sub)
  hover: bg: rgba(24,23,20,0.06), color: var(--text)

Clicking opens <NavDrawer> — reuses SlideOverPanel pattern from §6.10:
  position: fixed; left: 0; top: 0; bottom: 0
  width: min(320px, 86vw)
  animates in from the left (mirrors detailSlideIn but translateX(-100%))
  backdrop: rgba(20,18,15,0.18)
  content: the existing Sidebar JSX, unchanged

Breakpoint:
  visible at max-width: 900px (not 768 — tablets also benefit)
  hidden at min-width: 901px

Focus management: trap within drawer while open; Esc closes; click-backdrop closes.
```

**Spec — Option B: bottom tab bar (more "app-feel", better for primary nav)**

```
At max-width: 768px, topbar view-toggle hides, and a fixed bottom tab bar appears:

  .mobile-tabs {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    height: 56px;
    display: grid;
    grid-template-columns: repeat(4, 1fr) 56px; /* 4 views + More button */
    background: rgba(254,252,248,0.96);
    backdrop-filter: blur(16px);
    border-top: 1px solid var(--divider);
    z-index: var(--z-sticky);
    padding-bottom: env(safe-area-inset-bottom);
  }

  .mobile-tab {
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 2px;
    color: var(--text-dim);
    font-size: var(--text-xs);
    font-weight: 600;
  }

  .mobile-tab.active {
    color: var(--ink);
    /* subtle underline or dot above icon */
  }

  /* Hide the Topbar view-toggle at this breakpoint — replaced by tabs */

  /* "More" button opens the NavDrawer (team / connections / settings) */

Tabs:
  [List, lucide:List]   [Calendar, lucide:Calendar]   [Grid, lucide:Grid3x3]   [Stats, lucide:BarChart2]   [More, lucide:Menu]
```

**Recommendation:** ship **A** first (1-2 days), evaluate usage, then consider **B** if mobile usage grows. **A preserves all existing nav semantics**; **B** introduces a new mental model.

Effort: **M (2-3 days for A; 4-5 days for B).**

---

## 12. Deferred to live pass

When the browser MCP is fixed, re-run with working screenshots to verify:

1. Actual rendered hierarchy — does the warm paper + ink text + gradient primary work at real scale, or does the primary button visually overpower the hierarchy?
2. Density — is the 78-86px card-row tall enough to feel editorial, or just inefficient? Compare side-by-side with Linear.
3. Empty state at scale — does "Start building your queue for this month." resonate or feel parental?
4. Sidebar numbered sections — does the 01/02/03 motif read as editorial or as over-designed?
5. Analytics page at 1440px+ — does the 880px max-width leave a dead rail?
6. Mobile touch targets in practice — the assumption that the app works without a nav affordance.
7. StoryDesigner canvas — is the 290×515px preview large enough; does the inspector crowd?
8. Toast timing — does 3200ms feel right for the voice, or should it be 4500?
9. Composer modal density — not sampled in detail in this pass.
10. Motion curves — the 3 near-identical overshoots may or may not be perceptibly different.

---

## 13. Effort summary

| Effort | Count |
|--------|-------|
| S (≤ ½ day) | 11 |
| M (1-3 days) | 12 |
| L (week+) | 2 |

A focused 1-week design-system sprint can hit all S items + the two highest-leverage M items (token consolidation from §11.1, Toast rewrite from §11.2). The L items (spacing-scale migration, full responsive-breakpoint consolidation) are multi-week projects and should follow the token unification as their foundation.
