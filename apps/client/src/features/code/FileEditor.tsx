import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useIdeStore } from "@/entities/file/store";

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
      <div className='flex items-center justify-center h-full text-muted-foreground'>
        Select a file to begin editing.
      </div>
    );
  }

  return (
    <div className='flex flex-col h-full'>
      <div className='flex items-center justify-between p-2 border-b'>
        <h2 className='text-sm font-medium'>
          {activeFilePath} {isDirty && "*"}
        </h2>
        <Button
          onClick={saveActiveFile}
          disabled={!isDirty || isLoading}
          size='sm'
        >
          {isLoading ? "Saving..." : "Save"}
        </Button>
      </div>
      <Textarea
        value={activeFileContent}
        onChange={(e) => updateActiveFileContent(e.target.value)}
        className='flex-grow w-full h-full p-4 font-mono text-sm border-0 rounded-none resize-none focus-visible:ring-0'
        placeholder='Start typing...'
      />
    </div>
  );
};
