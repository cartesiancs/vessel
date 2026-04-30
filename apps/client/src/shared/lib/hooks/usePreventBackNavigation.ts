import { useEffect } from "react";

import { isTauri } from "@/shared/lib/desktop";

const isBackspaceAllowed = (event: KeyboardEvent) => {
  const path = event.composedPath();

  for (const el of path) {
    if (!(el instanceof HTMLElement)) continue;

    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable) {
      return true;
    }

    if (el.dataset?.allowBackspace === "true") {
      return true;
    }
  }

  return false;
};

export const usePreventBackNavigation = () => {
  useEffect(() => {
    if (!isTauri()) return;

    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Backspace") return;
      if (isBackspaceAllowed(event)) return;
      // Block browser navigation only when not focused on editable/allowed elements.
      event.preventDefault();
    };

    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, []);
};
