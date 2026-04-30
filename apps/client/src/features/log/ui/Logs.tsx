import {
  getLatestLog,
  getLogFileList,
  getLogByFilename,
} from "@/entities/log";
import { useEffect, useState } from "react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/shared/ui/resizable";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Terminal } from "lucide-react";

export function Logs() {
  const [logContent, setLogContent] = useState("");
  const [logFiles, setLogFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setError(null);
        setIsLoading(true);

        const [latestLogData, fileListData] = await Promise.all([
          getLatestLog(),
          getLogFileList(),
        ]);

        setLogContent(latestLogData.logs);
        setSelectedFile(latestLogData.filename);
        setLogFiles(fileListData.files);
      } catch (err) {
        setError("Failed.");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  const handleFileSelect = async (filename: string) => {
    if (filename === selectedFile || isLoading) return;

    try {
      setError(null);
      setIsLoading(true);
      const data = await getLogByFilename(filename);
      setLogContent(data.logs);
      setSelectedFile(data.filename);
    } catch (err) {
      setError(`Failed: ${filename}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ResizablePanelGroup
      direction='horizontal'
      className='w-full h-[85vh] border'
    >
      <ResizablePanel defaultSize={20} minSize={15}>
        <div className='flex h-full flex-col p-4'>
          <h2 className='text-lg font-semibold mb-4'>Logs</h2>
          <ScrollArea className='flex-grow'>
            <div className='space-y-1'>
              {logFiles.map((file) => (
                <Button
                  key={file}
                  variant={selectedFile === file ? "secondary" : "ghost"}
                  className='w-full justify-start'
                  onClick={() => handleFileSelect(file)}
                  disabled={isLoading}
                >
                  {file}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={80}>
        <Card className='h-full w-full border-0 rounded-none flex flex-col'>
          <CardHeader>
            <CardTitle>{selectedFile || "Select a log."}</CardTitle>
          </CardHeader>
          <CardContent className='flex-grow overflow-hidden p-4'>
            <ScrollArea className='h-full bg-muted/30 dark:bg-muted/50 rounded-md'>
              <div className='p-4 font-mono text-sm'>
                {isLoading && (
                  <div className='space-y-2'>
                    <Skeleton className='h-4 w-full' />
                    <Skeleton className='h-4 w-full' />
                    <Skeleton className='h-4 w-[75%]' />
                    <Skeleton className='h-4 w-full' />
                    <Skeleton className='h-4 w-[80%]' />
                    <Skeleton className='h-4 w-full' />
                  </div>
                )}
                {error && (
                  <Alert variant='destructive'>
                    <Terminal className='h-4 w-4' />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                {!isLoading && !error && (
                  <pre className='whitespace-pre-wrap'>{logContent}</pre>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
