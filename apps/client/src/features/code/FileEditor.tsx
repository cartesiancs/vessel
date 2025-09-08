import { Button } from "@/components/ui/button";
import { useIdeStore } from "@/entities/file/store";
import Editor from "@monaco-editor/react";
import { Loader2 } from "lucide-react";

const getLanguageFromPath = (path: string) => {
  const extension = path.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "js":
      return "javascript";
    case "ts":
      return "typescript";
    case "json":
      return "json";
    case "css":
      return "css";
    case "html":
      return "html";
    case "md":
      return "markdown";
    case "py":
      return "python";
    case "rs":
      return "rust";
    case "go":
      return "go";
    case "java":
      return "java";
    default:
      return "plaintext";
  }
};

export const FileEditor = () => {
  const {
    activeFilePath,
    activeFileContent,
    updateActiveFileContent,
    saveActiveFile,
    isDirty,
    isLoading,
  } = useIdeStore();

  if (!activeFilePath) {
    return (
      <div className='flex items-center justify-center h-full bg-[#1e1e1e] text-muted-foreground'>
        Select a file to begin editing.
      </div>
    );
  }

  const handleEditorChange = (value: string | undefined) => {
    updateActiveFileContent(value || "");
  };

  return (
    <div className='flex flex-col h-full bg-[#1e1e1e]'>
      <div className='flex items-center justify-between p-2 border-b border-neutral-700 bg-[#252526]'>
        <h2 className='text-sm font-medium text-gray-300'>
          {activeFilePath}{" "}
          {isDirty && <span className='text-yellow-400'>*</span>}
        </h2>
        <Button
          onClick={saveActiveFile}
          disabled={!isDirty || isLoading}
          size='sm'
        >
          {isLoading ? "Saving..." : "Save"}
        </Button>
      </div>
      <div className='flex-grow w-full h-full'>
        <Editor
          path={activeFilePath}
          language={getLanguageFromPath(activeFilePath)}
          value={activeFileContent}
          onChange={handleEditorChange}
          theme='vs-dark'
          loading={<Loader2 className='w-8 h-8 mx-auto mt-10 animate-spin' />}
          options={{
            minimap: { enabled: true },
            fontSize: 14,
            wordWrap: "on",
            scrollBeyondLastLine: false,
          }}
        />
      </div>
    </div>
  );
};
