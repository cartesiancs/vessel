import { Button } from "@/components/ui/button";
import { useMapDataStore, useMapInteractionStore } from "@/entities/map/store";
import { MapPin, Milestone, Squircle, Check, X } from "lucide-react";

export function MapToolbar() {
  const { addFeature } = useMapDataStore();
  const { drawingMode, setDrawingMode, currentVertices, clearDrawing } =
    useMapInteractionStore();
  const activeLayerId = useMapDataStore((state) => state.layer?.id);

  const handleFinishDrawing = () => {
    if (!activeLayerId || !drawingMode || currentVertices.length < 1) return;
    if (drawingMode !== "POINT" && currentVertices.length < 2) return;

    addFeature({
      layer_id: activeLayerId,
      feature_type: drawingMode,
      vertices: currentVertices.map((v) => ({
        latitude: v.lat,
        longitude: v.lng,
      })),
    });
    clearDrawing();
  };

  return (
    <div className='absolute top-14 right-4 z-[1000] flex flex-col gap-2 p-2 bg-background/80 rounded-md shadow-lg backdrop-blur-sm'>
      <Button
        onClick={() => setDrawingMode("POINT")}
        size='icon'
        variant={drawingMode === "POINT" ? "secondary" : "outline"}
        disabled={!activeLayerId}
      >
        <MapPin className='h-4 w-4' />
      </Button>
      <Button
        onClick={() => setDrawingMode("LINE")}
        size='icon'
        variant={drawingMode === "LINE" ? "secondary" : "outline"}
        disabled={!activeLayerId}
      >
        <Milestone className='h-4 w-4' />
      </Button>
      <Button
        onClick={() => setDrawingMode("POLYGON")}
        size='icon'
        variant={drawingMode === "POLYGON" ? "secondary" : "outline"}
        disabled={!activeLayerId}
      >
        <Squircle className='h-4 w-4' />
      </Button>

      {currentVertices.length > 0 &&
        (drawingMode === "LINE" || drawingMode === "POLYGON") && (
          <div className='flex flex-col gap-2 pt-2 mt-2 border-t'>
            <Button onClick={handleFinishDrawing} size='icon' variant='default'>
              <Check className='h-4 w-4' />
            </Button>
            <Button onClick={clearDrawing} size='icon' variant='ghost'>
              <X className='h-4 w-4' />
            </Button>
          </div>
        )}
    </div>
  );
}
