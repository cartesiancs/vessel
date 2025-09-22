import { useMapInteractionStore, useMapDataStore } from "@/entities/map/store";
import { useMapEvents } from "react-leaflet";

export function MapEvents() {
  const { drawingMode, addVertex, setDrawingMode, clearDrawing } =
    useMapInteractionStore();
  const { addFeature } = useMapDataStore();
  const activeLayerId = useMapDataStore((state) => state.layer?.id);

  useMapEvents({
    click(e) {
      if (!drawingMode || !activeLayerId) return;
      if (drawingMode === "POINT") {
        addFeature({
          layer_id: activeLayerId,
          feature_type: "POINT",
          vertices: [{ latitude: e.latlng.lat, longitude: e.latlng.lng }],
        });
        setDrawingMode(null);
      } else {
        addVertex(e.latlng);
      }
    },
    keydown(e) {
      if (e.originalEvent.key === "Escape") clearDrawing();
    },
  });

  return null;
}
