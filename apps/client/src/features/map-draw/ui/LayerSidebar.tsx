import { useState } from "react";
import { Plus, ChevronLeft, MoreHorizontal } from "lucide-react";

import { LayerDialog } from "./LayerDialog";
import { useMapDataStore } from "@/entities/map";
import { MapLayer } from "@/entities/map";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

type LayerDialogState =
  | { kind: "closed" }
  | { kind: "add" }
  | { kind: "edit"; layer: MapLayer };

export function LayerSidebar() {
  const { layers, activeLayerId, setActiveLayer, removeLayer } =
    useMapDataStore();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [layerToDelete, setLayerToDelete] = useState<number | null>(null);
  const [layerDialog, setLayerDialog] = useState<LayerDialogState>({
    kind: "closed",
  });

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);

  const handleDeleteConfirm = () => {
    if (layerToDelete) {
      removeLayer(layerToDelete);
      setLayerToDelete(null);
    }
  };

  const selectedLayerName =
    layers.find((l) => l.id === layerToDelete)?.name || "";

  const layerDialogOpen = layerDialog.kind !== "closed";
  const layerDialogLayer =
    layerDialog.kind === "edit" ? layerDialog.layer : undefined;

  return (
    <>
      <div
        className={cn(
          "absolute top-[48px] left-0 border-r h-[calc(100%-48px)] w-64 bg-background/80 z-[999] p-4 flex flex-col shadow-lg backdrop-blur-sm transition-all duration-300 ease-in-out overflow-hidden",
          isCollapsed && "w-0 p-0 border-none",
        )}
      >
        <div className='flex justify-between items-center mb-4'>
          <h2 className='text-md font-semibold'>Layers</h2>
          <div className='flex items-center'>
            <LayerDialog>
              <Button variant='ghost' size='icon'>
                <Plus className='h-4 w-4' />
              </Button>
            </LayerDialog>
            <Button variant='ghost' size='icon' onClick={toggleSidebar}>
              <ChevronLeft className='h-5 w-5' />
            </Button>
          </div>
        </div>
        <div className='flex-grow overflow-y-auto'>
          <ul className='space-y-2'>
            {layers.map((layer) => (
              <li
                key={layer.id}
                onClick={() => setActiveLayer(layer.id)}
                className={cn(
                  "px-2 py-1 cursor-pointer hover:bg-muted flex justify-between items-center gap-2",
                  activeLayerId === layer.id && "bg-muted",
                )}
              >
                <span className='truncate text-sm min-w-0'>{layer.name}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='shrink-0'
                      aria-label={`Options for ${layer.name}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className='h-4 w-4' />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='end' className='z-[1002]'>
                    <DropdownMenuItem
                      onSelect={() => setLayerDialog({ kind: "edit", layer })}
                    >
                      Edit layer
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant='destructive'
                      onSelect={() => setLayerToDelete(layer.id)}
                    >
                      Delete layer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <LayerDialog
        layer={layerDialogLayer}
        open={layerDialogOpen}
        onOpenChange={(open) => {
          if (!open) setLayerDialog({ kind: "closed" });
        }}
      />

      {isCollapsed && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant='outline'
              size='icon'
              className='absolute top-[56px] left-2 z-[1001] bg-background/80 backdrop-blur-sm'
              aria-label='Collapsed sidebar options'
            >
              <MoreHorizontal className='h-5 w-5' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='start' className='z-[1002]'>
            <DropdownMenuItem onSelect={() => toggleSidebar()}>
              Expand sidebar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <AlertDialog
        open={!!layerToDelete}
        onOpenChange={() => setLayerToDelete(null)}
      >
        <AlertDialogContent className='z-[999999]'>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the '
              {selectedLayerName}' layer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
