import { Marker } from "react-leaflet";
import L from "leaflet";
import { useMapInteractionStore } from "@/entities/map/store";
import { useMapDataStore } from "@/entities/map/store";
import { LatLng } from "leaflet";

const DraggableIcon = L.divIcon({
  html: `<div class="w-4 h-4 bg-background border-2 border-blue-100 rounded-full cursor-move shadow-md"></div>`,
  className: "",
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export function FeatureEditor() {
  const { selectedFeature } = useMapInteractionStore();
  const { updateFeature } = useMapDataStore();

  if (!selectedFeature) {
    return null;
  }

  const handleDragEnd = (index: number, newPosition: LatLng) => {
    if (!selectedFeature) return;

    const updatedVertices = selectedFeature.vertices.map((vertex, i) =>
      i === index
        ? { ...vertex, latitude: newPosition.lat, longitude: newPosition.lng }
        : vertex,
    );

    const payload = {
      vertices: updatedVertices.map((v) => ({
        latitude: v.latitude,
        longitude: v.longitude,
      })),
    };

    updateFeature(selectedFeature.id, payload);
  };

  return (
    <>
      {selectedFeature.vertices.map((vertex, index) => (
        <Marker
          key={`edit-vertex-${selectedFeature.id}-${vertex.id || index}`}
          position={[vertex.latitude, vertex.longitude]}
          icon={DraggableIcon}
          draggable={true}
          eventHandlers={{
            dragend: (e) => {
              handleDragEnd(index, e.target.getLatLng());
            },
          }}
        />
      ))}
    </>
  );
}
