import { CircleMarker, Polygon, Polyline } from "react-leaflet";
import { LatLngExpression } from "leaflet";
import { FeatureWithVertices } from "@/entities/map/types";
import { useMapInteractionStore } from "@/entities/map/store";
import { useMemo } from "react";

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

  const featureColor = useMemo(() => {
    try {
      if (feature.style_properties) {
        const styles = JSON.parse(feature.style_properties);
        return styles.color || "#6ec7f0";
      }
    } catch (e) {
      console.error("Failed to parse style_properties", e);
    }
    return "#6ec7f0";
  }, [feature.style_properties]);

  if (positions.length === 0) {
    return null;
  }

  const eventHandlers = {
    click: () => {
      setSelectedFeature(feature);
    },
  };

  const pathOptions = { color: featureColor };

  switch (feature.feature_type) {
    case "POINT":
      return (
        <CircleMarker
          center={positions[0]}
          pathOptions={pathOptions}
          radius={6}
          eventHandlers={eventHandlers}
        />
      );

    case "LINE":
      return (
        <Polyline
          positions={positions}
          pathOptions={pathOptions}
          eventHandlers={eventHandlers}
        />
      );

    case "POLYGON":
      return (
        <Polygon
          positions={positions}
          pathOptions={pathOptions}
          eventHandlers={eventHandlers}
        />
      );

    default:
      return null;
  }
}
