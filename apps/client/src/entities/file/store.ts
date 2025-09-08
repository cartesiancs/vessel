import { create } from "zustand";
import { IdeState } from "./types";
import { getFileContent, updateFileContent } from "./api";
import { toast } from "sonner";

export const useIdeStore = create<IdeState>((set, get) => ({
  activeFilePath: null,
  activeFileContent: "",
  isDirty: false,
  isLoading: false,
  error: null,

  openFile: async (path) => {
    if (get().isDirty) {
      if (
        !window.confirm(
          "You have unsaved changes. Are you sure you want to open a new file?",
        )
      ) {
        return;
      }
    }
    set({ isLoading: true, error: null });
    try {
      const content = await getFileContent(path);
      set({
        activeFilePath: path,
        activeFileContent: content,
        isDirty: false,
        isLoading: false,
      });
    } catch (err) {
      const errorMsg = "Failed to load file content." + err;
      set({ error: errorMsg, isLoading: false });
      toast.error(errorMsg);
    }
  },

  updateActiveFileContent: (content) => {
    set({ activeFileContent: content, isDirty: true });
  },

  saveActiveFile: async () => {
    const { activeFilePath, activeFileContent } = get();
    if (!activeFilePath) return;

    set({ isLoading: true });
    try {
      await updateFileContent(activeFilePath, activeFileContent);
      set({ isDirty: false, isLoading: false });
      toast.success("File saved successfully!");
    } catch (err) {
      const errorMsg = "Failed to save file." + err;
      set({ error: errorMsg, isLoading: false });
      toast.error(errorMsg);
    }
  },

  closeFile: () => {
    if (get().isDirty) {
      if (
        !window.confirm(
          "You have unsaved changes. Are you sure you want to close?",
        )
      ) {
        return;
      }
    }
    set({ activeFilePath: null, activeFileContent: "", isDirty: false });
  },
}));
