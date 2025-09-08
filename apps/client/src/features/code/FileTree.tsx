import React, { useState, useEffect } from "react";
import { ChevronRight, Folder, File as FileIcon, Loader2 } from "lucide-react";
import { getDirectoryListing } from "@/entities/file/api";
import { toast } from "sonner";
import { useIdeStore } from "@/entities/file/store";
import { DirEntry } from "@/entities/file/types";

interface TreeNodeProps {
  entry: DirEntry;
}

const TreeNode: React.FC<TreeNodeProps> = ({ entry }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState<DirEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const openFile = useIdeStore((state) => state.openFile);

  const handleToggle = async () => {
    if (!entry.isDir) {
      openFile(entry.path);
      return;
    }

    if (isOpen) {
      setIsOpen(false);
    } else {
      setIsLoading(true);
      try {
        const childEntries = await getDirectoryListing(entry.path);
        setChildren(childEntries);
        setIsOpen(true);
      } catch (error) {
        toast.error("Failed to load directory." + error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const Icon = entry.isDir ? Folder : FileIcon;

  return (
    <div className='text-sm'>
      <div
        className='flex items-center p-1 rounded-md cursor-pointer hover:bg-muted'
        onClick={handleToggle}
      >
        {entry.isDir ? (
          <ChevronRight
            className={`w-4 h-4 mr-1 transition-transform ${
              isOpen ? "rotate-90" : ""
            }`}
          />
        ) : (
          <div className='w-4 mr-1' />
        )}
        <Icon className='w-4 h-4 mr-2' />
        <span>{entry.name}</span>
        {isLoading && <Loader2 className='w-4 h-4 ml-auto animate-spin' />}
      </div>
      {isOpen && (
        <div className='pl-4 border-l border-muted-foreground/20'>
          {children.map((child) => (
            <TreeNode key={child.path} entry={child} />
          ))}
        </div>
      )}
    </div>
  );
};

export const FileTree = () => {
  const [rootEntries, setRootEntries] = useState<DirEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRoot = async () => {
      try {
        const entries = await getDirectoryListing(".");
        setRootEntries(entries);
      } catch (error) {
        toast.error("Failed to load root directory." + error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRoot();
  }, []);

  if (isLoading) {
    return <div className='p-4 text-sm'>Loading project...</div>;
  }

  return (
    <div className='p-2'>
      {rootEntries.map((entry) => (
        <TreeNode key={entry.path} entry={entry} />
      ))}
    </div>
  );
};
