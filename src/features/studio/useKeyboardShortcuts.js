import { useEffect } from "react";

/**
 * Keyboard shortcuts for the Studio app.
 * @param {object} opts
 * @param {Function} opts.add         — add a new post for the current month
 * @param {Function} opts.setView     — switch the active view
 * @param {Function} opts.getModals   — returns { composer, story, addPostDraft, publishConfirm }
 * @param {Function} opts.closeModal  — called with the name of the topmost open modal to close it
 */
export function useKeyboardShortcuts({ add, setView, getModals, closeModal }) {
  useEffect(() => {
    const handleKeyboard = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.contentEditable === "true") return;

      // N = new post
      if (e.key === "n" || e.key === "N") { e.preventDefault(); add(); }
      // / = focus search
      if (e.key === "/") { e.preventDefault(); document.querySelector(".ops-search")?.focus(); }
      // 1-4 = switch views
      if (e.key === "1") { e.preventDefault(); setView("list"); }
      if (e.key === "2") { e.preventDefault(); setView("calendar"); }
      if (e.key === "3") { e.preventDefault(); setView("grid"); }
      if (e.key === "4") { e.preventDefault(); setView("analytics"); }
      // Escape = close modals
      if (e.key === "Escape") {
        const m = getModals();
        if (m.composer) closeModal("composer");
        else if (m.story) closeModal("story");
        else if (m.addPostDraft) closeModal("addPostDraft");
        else if (m.publishConfirm) closeModal("publishConfirm");
      }
    };
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [add, setView, getModals, closeModal]);
}
