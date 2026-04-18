import { useEffect } from "react";

/**
 * Close a popover/menu when the user clicks outside of it.
 * Pass the ref of the element that should count as "inside" — typically
 * the wrapping container, not the trigger.
 *
 * No-op when `isOpen` is false so listeners aren't attached when idle.
 */
export function useOutsideClick(ref, isOpen, onOutside) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const handle = (event) => {
      if (ref.current && !ref.current.contains(event.target)) onOutside();
    };
    document.addEventListener("pointerdown", handle);
    return () => document.removeEventListener("pointerdown", handle);
  }, [isOpen, ref, onOutside]);
}
