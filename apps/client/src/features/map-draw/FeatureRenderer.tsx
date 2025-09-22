import { CircleMarker, Polygon, Polyline } from "react-leaflet";
import { LatLngExpression } from "leaflet";
import { FeatureWithVertices } from "@/entities/map/types";
import { useMapInteractionStore } from "@/entities/map/store";

interface FeatureRendererProps {
  feature: FeatureWithVertices;
}

export function FeatureRenderer({ feature }: FeatureRendererProps) {
  const setSelectedFeature = useMapInteractionStore(
    (state) => state.setSelectedFeature,
  );
  const positions = feature.vertices
    .sort((a, b) => a.sequence - b.sequence)
    .map((v) => [v.latitude, v.longitude] as LatLngExpression);

  if (positions.length === 0) {
    return null;
  }

  const eventHandlers = {
    click: () => {
      setSelectedFeature(feature);
    },
  };

  switch (feature.feature_type) {
    case "POINT":
      return (
        <CircleMarker
          center={positions[0]}
          pathOptions={{ color: "#6ec7f0" }}
          radius={6}
          eventHandlers={eventHandlers}
        />
      );

    case "LINE":
      return (
        <Polyline
          positions={positions}
          pathOptions={{ color: "#6ec7f0" }}
          eventHandlers={eventHandlers}
        />
      );

    case "POLYGON":
      return (
        <Polygon
          positions={positions}
          pathOptions={{ color: "#6ec7f0" }}
          eventHandlers={eventHandlers}
        />
      );

    default:
      return null;
  }
}
