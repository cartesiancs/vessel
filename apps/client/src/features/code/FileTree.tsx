import React, { useState, useEffect } from "react";
import {
  ChevronRight,
  Folder,
  File as FileIcon,
  Loader2,
  FolderPlus,
  FilePlus,
} from "lucide-react";
import {
  getDirectoryListing,
  createNewFile,
  createNewFolder,
} from "@/entities/file/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useFileTreeStore, useIdeStore } from "@/entities/file/store";
import { DirEntry } from "@/entities/file/types";
import { CreateItemDialog } from "./CreateItemDialog";

interface TreeNodeProps {
  entry: DirEntry;
}

const TreeNode: React.FC<TreeNodeProps> = ({ entry }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState<DirEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const openFile = useIdeStore((state) => state.openFile);
  //const refreshFileTree = useFileTreeStore((state) => state.refreshFileTree);
  const treeVersion = useFileTreeStore((state) => state.treeVersion);

  const fetchChildren = async () => {
    setIsLoading(true);
    try {
      const childEntries = await getDirectoryListing(entry.path);
      setChildren(childEntries);
    } catch {
      toast.error(`Failed to load directory: ${entry.name}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async () => {
    if (!entry.isDir) {
      openFile(entry.path);
      return;
    }

    if (isOpen) {
      setIsOpen(false);
    } else {
      setIsOpen(true);
      if (children.length === 0) {
        await fetchChildren();
      }
    }
  };

  useEffect(() => {
    if (isOpen && entry.isDir) {
      fetchChildren();
    }
  }, [treeVersion, isOpen, entry.isDir, entry.path]);

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
  const [dialogOpen, setDialogOpen] = useState<"file" | "folder" | null>(null);

  const { treeVersion, refreshFileTree } = useFileTreeStore();

  const fetchRoot = async () => {
    setIsLoading(true);
    try {
      const entries = await getDirectoryListing("");
      setRootEntries(entries);
    } catch {
      toast.error("Failed to load root directory.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRoot();
  }, [treeVersion]);

  const handleCreate = async (name: string, type: "file" | "folder") => {
    try {
      if (type === "file") {
        await createNewFile(name);
      } else {
        await createNewFolder(name);
      }
      toast.success(`${type} '${name}' created successfully.`);
      refreshFileTree();
    } catch {
      toast.error(`Failed to create ${type}.`);
    }
  };

  return (
    <div className='p-2'>
      <div className='flex items-center justify-between mb-2'>
        <p className='font-bold text-sm'>Project</p>
        <div className='flex items-center gap-1'>
          <Button
            variant='ghost'
            size='icon'
            onClick={() => setDialogOpen("folder")}
          >
            <FolderPlus className='w-4 h-4' />
          </Button>
          <Button
            variant='ghost'
            size='icon'
            onClick={() => setDialogOpen("file")}
          >
            <FilePlus className='w-4 h-4' />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className='p-4 text-sm'>Loading project...</div>
      ) : (
        rootEntries.map((entry) => <TreeNode key={entry.path} entry={entry} />)
      )}

      <CreateItemDialog
        isOpen={dialogOpen !== null}
        onClose={() => setDialogOpen(null)}
        itemType={dialogOpen || "file"}
        onCreate={(name) => handleCreate(name, dialogOpen!)}
      />
    </div>
  );
};
