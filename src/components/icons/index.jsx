import React from "react";
import {
  AlignCenterHorizontallyIcon,
  AlignLeftIcon as RxAlignLeftIcon,
  AlignRightIcon as RxAlignRightIcon,
  CalendarIcon as RxCalendarIcon,
  ChatBubbleIcon,
  CheckCircledIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ClockIcon,
  CopyIcon,
  Cross2Icon,
  DownloadIcon,
  DragHandleDots2Icon,
  ExclamationTriangleIcon,
  FontBoldIcon,
  FontItalicIcon,
  FontSizeIcon,
  GridIcon,
  HamburgerMenuIcon,
  HeartIcon,
  GlobeIcon,
  ImageIcon as RxImageIcon,
  KeyboardIcon,
  LayersIcon,
  LayoutIcon,
  LoopIcon,
  MagnifyingGlassIcon,
  MinusIcon,
  MixerHorizontalIcon,
  PaperPlaneIcon,
  PauseIcon,
  PersonIcon,
  PinLeftIcon,
  PlayIcon,
  PlusIcon,
  ReloadIcon,
  ResetIcon,
  Share2Icon,
  SpeakerLoudIcon,
  SpeakerOffIcon,
  StackIcon,
  StrikethroughIcon,
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
  TextIcon,
  TrashIcon,
  UnderlineIcon,
  UploadIcon,
  VideoIcon,
} from "@radix-ui/react-icons";

// Icon system: Radix Icons (@radix-ui/react-icons) behind the studio's
// lucide-style API. Radix is drawn on a 15px grid with ~1px flat-capped
// strokes — the same modernist design-tool language as Figma's UI, with
// professional optical corrections a hand-drawn set can't match.
//
// Exports keep their historical names so call sites never change. A few
// glyphs Radix doesn't ship (brand AI mark, wallpaper, thumbs-up,
// undo/redo arrows) stay bespoke, drawn to blend with Radix's weight.

// Minimum icon size floor. Canva / Figma / Linear all land in the
// 18-24px range for UI affordance icons — below 16px an icon reads
// as decorative noise, not a control.
const MIN_ICON_SIZE = 16;

// Adapt our { size, color, className, style } API to Radix's props.
// (Each export below is a plain function component — the repo honors
// react-refresh/only-export-components, so no component factories.)
function radixProps({ size = 18, color, className, style, ...rest }) {
  const s = Math.max(size, MIN_ICON_SIZE);
  return { width: s, height: s, color: color || "currentColor", className, style, "aria-hidden": "true", ...rest };
}

// Props for the bespoke stroke glyphs below — matched to Radix's optical
// weight: ~1px visual stroke, flat caps, miter joins.
function asProps({ size = 18, color, className, style, ...rest }) {
  const s = Math.max(size, MIN_ICON_SIZE);
  return {
    width: s,
    height: s,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: color || "currentColor",
    strokeWidth: 16 / s,
    strokeLinecap: "butt",
    strokeLinejoin: "miter",
    className,
    style,
    "aria-hidden": "true",
    ...rest,
  };
}

// ─── Chrome ────────────────────────────────────────────────────────

export function Close(props) { return <Cross2Icon {...radixProps(props)} />; }
export function Check(props) { return <CheckIcon {...radixProps(props)} />; }
export function CheckCircle(props) { return <CheckCircledIcon {...radixProps(props)} />; }
export function Plus(props) { return <PlusIcon {...radixProps(props)} />; }
export function Minus(props) { return <MinusIcon {...radixProps(props)} />; }
export function ChevronDown(props) { return <ChevronDownIcon {...radixProps(props)} />; }
export function ChevronUp(props) { return <ChevronUpIcon {...radixProps(props)} />; }
export function ChevronLeft(props) { return <ChevronLeftIcon {...radixProps(props)} />; }
export function ChevronRight(props) { return <ChevronRightIcon {...radixProps(props)} />; }
export function Search(props) { return <MagnifyingGlassIcon {...radixProps(props)} />; }
export function Menu(props) { return <HamburgerMenuIcon {...radixProps(props)} />; }

// Editorial AI mark — brand glyph, not part of any library. Filled
// diamond inside a hairline circle: "considered, marked-up", not
// "magic dust."
export function AIMark(props) {
  const p = { ...asProps(props), strokeWidth: 1 };
  return (
    <svg {...p}>
      <circle cx="8" cy="8" r="6.5" />
      <rect x="5" y="5" width="6" height="6" transform="rotate(45 8 8)" fill={p.stroke} stroke="none" />
    </svg>
  );
}

// ─── Status / informational ────────────────────────────────────────

export function AlertTriangle(props) { return <ExclamationTriangleIcon {...radixProps(props)} />; }
export function Clock(props) { return <ClockIcon {...radixProps(props)} />; }
export function CalendarIcon(props) { return <RxCalendarIcon {...radixProps(props)} />; }

// ─── Verbs / actions ───────────────────────────────────────────────

export function Upload(props) { return <UploadIcon {...radixProps(props)} />; }
export function Download(props) { return <DownloadIcon {...radixProps(props)} />; }
export function Send(props) { return <PaperPlaneIcon {...radixProps(props)} />; }
export function Share(props) { return <Share2Icon {...radixProps(props)} />; }
export function Copy(props) { return <CopyIcon {...radixProps(props)} />; }
export function Trash(props) { return <TrashIcon {...radixProps(props)} />; }
export function RotateCcw(props) { return <ResetIcon {...radixProps(props)} />; }
export function RotateCw(props) { return <ReloadIcon {...radixProps(props)} />; }
export function Repeat(props) { return <LoopIcon {...radixProps(props)} />; }

// Undo / redo — Radix has no curved undo arrows; bespoke, weight-matched.
export function Undo(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <path d="M2.5 6.5 L5 4 L7.5 6.5" />
      <path d="M5 4 H10 A3.5 3.5 0 1 1 10 11" />
    </svg>
  );
}

export function Redo(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <path d="M13.5 6.5 L11 4 L8.5 6.5" />
      <path d="M11 4 H6 A3.5 3.5 0 1 0 6 11" />
    </svg>
  );
}

// ─── Landing / marketing surfaces ──────────────────────────────────

export function Keyboard(props) { return <KeyboardIcon {...radixProps(props)} />; }
export function Person(props) { return <PersonIcon {...radixProps(props)} />; }
export function Stack(props) { return <StackIcon {...radixProps(props)} />; }
export function Globe(props) { return <GlobeIcon {...radixProps(props)} />; }

// ─── Drag handle ───────────────────────────────────────────────────

export function GripVertical(props) { return <DragHandleDots2Icon {...radixProps(props)} />; }

// ─── Social / engagement glyphs (LinkedIn preview) ────────────────

// Radix has no thumbs-up; bespoke, weight-matched.
export function ThumbsUp(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <path d="M5 13 V7 L8 3 L8 7 H12.5 L11 13 H5 Z" />
      <path d="M2.5 13 V7 H5" />
    </svg>
  );
}

export function Heart(props) { return <HeartIcon {...radixProps(props)} />; }
export function MessageSquare(props) { return <ChatBubbleIcon {...radixProps(props)} />; }

// ─── Media controls ────────────────────────────────────────────────

export function Play(props) { return <PlayIcon {...radixProps(props)} />; }
export function Pause(props) { return <PauseIcon {...radixProps(props)} />; }
export function Volume(props) { return <SpeakerLoudIcon {...radixProps(props)} />; }
export function VolumeMute(props) { return <SpeakerOffIcon {...radixProps(props)} />; }

// ─── StoryDesigner editor toolbar ─────────────────────────────────

export function Bold(props) { return <FontBoldIcon {...radixProps(props)} />; }
export function Italic(props) { return <FontItalicIcon {...radixProps(props)} />; }
export function Underline(props) { return <UnderlineIcon {...radixProps(props)} />; }
export function Strikethrough(props) { return <StrikethroughIcon {...radixProps(props)} />; }
export function TypeIcon(props) { return <TextIcon {...radixProps(props)} />; }
export function AArrowDown(props) { return <FontSizeIcon {...radixProps(props)} />; }
export function ImageIcon(props) { return <RxImageIcon {...radixProps(props)} />; }
export function Film(props) { return <VideoIcon {...radixProps(props)} />; }
export function Layers(props) { return <LayersIcon {...radixProps(props)} />; }
export function LayoutTemplate(props) { return <LayoutIcon {...radixProps(props)} />; }
export function PanelLeftClose(props) { return <PinLeftIcon {...radixProps(props)} />; }
export function Sliders(props) { return <MixerHorizontalIcon {...radixProps(props)} />; }
export function Grid3(props) { return <GridIcon {...radixProps(props)} />; }

// Background layer — Radix has no wallpaper glyph; bespoke, weight-matched.
export function Wallpaper(props) {
  const p = asProps(props);
  return (
    <svg {...p}>
      <rect x="2.5" y="2.5" width="11" height="11" />
      <circle cx="6" cy="6" r="1" />
      <path d="M3 12 L6.5 8.5 L10 11 L13 8" />
    </svg>
  );
}

// Text alignment
export function AlignLeft(props) { return <TextAlignLeftIcon {...radixProps(props)} />; }
export function AlignCenter(props) { return <TextAlignCenterIcon {...radixProps(props)} />; }
export function AlignRight(props) { return <TextAlignRightIcon {...radixProps(props)} />; }

// Object alignment (Figma-style)
export function AlignStartVertical(props) { return <RxAlignLeftIcon {...radixProps(props)} />; }
export function AlignCenterVertical(props) { return <AlignCenterHorizontallyIcon {...radixProps(props)} />; }
export function AlignEndVertical(props) { return <RxAlignRightIcon {...radixProps(props)} />; }
