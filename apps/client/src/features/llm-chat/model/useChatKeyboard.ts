import { useEffect } from "react";
import { useChatStore } from "./store";

const CHAT_KEYBOARD_SHORTCUT = "k";

export function useChatKeyboard() {
  const togglePanel = useChatStore((s) => s.togglePanel);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === CHAT_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        togglePanel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePanel]);
}
