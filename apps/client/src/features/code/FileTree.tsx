import React, { useState, useEffect, useRef } from "react";
import {
  ChevronRight,
  Folder,
  File as FileIcon,
  Loader2,
  FolderPlus,
  FilePlus,
  Trash2,
  FilePenLine,
} from "lucide-react";
import {
  getDirectoryListing,
  createNewFile,
  createNewFolder,
  renameEntry,
  deleteEntry,
} from "@/entities/file/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useFileTreeStore, useIdeStore } from "@/entities/file/store";
import { DirEntry } from "@/entities/file/types";
import { CreateItemDialog } from "./CreateItemDialog";

interface TreeNodeProps {
  entry: DirEntry;
  onDeleteRequest: (entry: DirEntry) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({ entry, onDeleteRequest }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState<DirEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(entry.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const openFile = useIdeStore((state) => state.openFile);
  const { treeVersion, refreshFileTree } = useFileTreeStore();

  useEffect(() => {
    if (isRenaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isRenaming]);

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
    if (isRenaming) return;
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

  const handleRename = async () => {
    if (newName === entry.name || !newName.trim()) {
      setIsRenaming(false);
      setNewName(entry.name);
      return;
    }
    try {
      const parentPath = entry.path.substring(
        0,
        entry.path.lastIndexOf("/") + 1,
      );
      const newPath = `${parentPath}${newName}`;
      await renameEntry(entry.path, newPath);
      toast.success(`Renamed to '${newName}'`);
      refreshFileTree();
    } catch (error) {
      toast.error(`Failed to rename: ${error}`);
      setNewName(entry.name);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleRename();
    } else if (e.key === "Escape") {
      setIsRenaming(false);
      setNewName(entry.name);
    }
  };

  const Icon = entry.isDir ? Folder : FileIcon;

  return (
    <div className='text-sm'>
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            className='flex items-center p-1 rounded-md cursor-pointer hover:bg-muted'
            onClick={handleToggle}
          >
            {entry.isDir ? (
              <ChevronRight
                className={`w-4 h-4 mr-0 transition-transform ${
                  isOpen ? "rotate-90" : ""
                }`}
              />
            ) : (
              <div className='w-4 mr-1' />
            )}
            <Icon className='w-4 h-4 mr-2' />
            {isRenaming ? (
              <Input
                ref={inputRef}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={handleKeyDown}
                className='h-6 px-1 text-sm'
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span>{entry.name}</span>
            )}
            {isLoading && <Loader2 className='w-4 h-4 ml-auto animate-spin' />}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => setIsRenaming(true)}>
            <FilePenLine className='w-4 h-4 mr-2' />
            Rename
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => onDeleteRequest(entry)}
            className='text-red-500 focus:text-red-500'
          >
            <Trash2 className='w-4 h-4 mr-2' />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {isOpen && (
        <div className='pl-4 border-l border-muted-foreground/20'>
          {children.map((child) => (
            <TreeNode
              key={child.path}
              entry={child}
              onDeleteRequest={onDeleteRequest}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface ConfirmDeleteDialogProps {
  item: DirEntry | null;
  onClose: () => void;
  onConfirm: (item: DirEntry) => Promise<void>;
}

const ConfirmDeleteDialog: React.FC<ConfirmDeleteDialogProps> = ({
  item,
  onClose,
  onConfirm,
}) => {
  if (!item) return null;

  return (
    <AlertDialog open={!!item} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the{" "}
            {item.isDir ? "folder" : "file"}
            <strong className='mx-1'>{item.name}</strong>
            and all its contents.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(item)}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export const FileTree = () => {
  const [rootEntries, setRootEntries] = useState<DirEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState<"file" | "folder" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DirEntry | null>(null);

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

  const handleDelete = async (item: DirEntry) => {
    try {
      await deleteEntry(item.path);
      toast.success(`'${item.name}' deleted successfully.`);
      refreshFileTree();
    } catch (error) {
      toast.error(`Failed to delete '${item.name}': ${error}`);
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className='p-2'>
      <div className='flex items-center justify-between mb-2'>
        <p className='font-bold text-sm ps-2'>Project</p>
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
        rootEntries.map((entry) => (
          <TreeNode
            key={entry.path}
            entry={entry}
            onDeleteRequest={setDeleteTarget}
          />
        ))
      )}

      <CreateItemDialog
        isOpen={dialogOpen !== null}
        onClose={() => setDialogOpen(null)}
        itemType={dialogOpen || "file"}
        onCreate={(name) => handleCreate(name, dialogOpen!)}
      />

      <ConfirmDeleteDialog
        item={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
};
