import { useState } from "react";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";

import { LayerDialog } from "./LayerDialog";
import { useMapDataStore } from "@/entities/map/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LayerSidebar() {
  const { layers, activeLayerId, setActiveLayer, removeLayer } =
    useMapDataStore();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);

  return (
    <>
      <div
        className={cn(
          "absolute top-[48px] left-0 border-r h-full w-64 bg-background/80 z-[1000] p-4 flex flex-col shadow-lg backdrop-blur-sm transition-transform duration-300 ease-in-out",
          isCollapsed && "-translate-x-full",
        )}
      >
        <div className='flex justify-between items-center mb-4'>
          <h2 className='text-lg font-semibold'>Layers</h2>
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
                  "p-2 rounded-md cursor-pointer hover:bg-muted flex justify-between items-center",
                  activeLayerId === layer.id && "bg-muted",
                )}
              >
                <span className='truncate'>{layer.name}</span>
                <div className='flex items-center'>
                  <LayerDialog layer={layer}>
                    <Button
                      variant='ghost'
                      size='icon'
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Pencil className='h-4 w-4' />
                    </Button>
                  </LayerDialog>
                  <Button
                    variant='ghost'
                    size='icon'
                    onClick={(e) => {
                      e.stopPropagation();
                      removeLayer(layer.id);
                    }}
                  >
                    <Trash2 className='h-4 w-4 text-destructive' />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {isCollapsed && (
        <Button
          variant='outline'
          size='icon'
          onClick={toggleSidebar}
          className='absolute top-[56px] left-2 z-[1001] bg-background/80 backdrop-blur-sm'
        >
          <ChevronRight className='h-5 w-5' />
        </Button>
      )}
    </>
  );
}
