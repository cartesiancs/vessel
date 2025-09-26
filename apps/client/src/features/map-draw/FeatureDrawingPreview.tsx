import { useMapInteractionStore } from "@/entities/map/store";
import { Polyline, Polygon } from "react-leaflet";

export function DrawingPreview() {
  const { drawingMode, currentVertices } = useMapInteractionStore();

  if (currentVertices.length === 0) return null;

  if (drawingMode === "LINE") {
    return (
      <Polyline positions={currentVertices} color='yellow' dashArray='5, 10' />
    );
  }

  if (drawingMode === "POLYGON") {
    return (
      <Polygon positions={currentVertices} color='yellow' fillOpacity={0.2} />
    );
  }

  return null;
}
