export interface DirEntry {
  name: string;
  isDir: boolean;
  path: string;
}

export interface IdeState {
  activeFilePath: string | null;
  activeFileContent: string;
  isDirty: boolean;
  isLoading: boolean;
  error: string | null;
  openFile: (path: string) => Promise<void>;
  updateActiveFileContent: (content: string) => void;
  saveActiveFile: () => Promise<void>;
  closeFile: () => void;
}
