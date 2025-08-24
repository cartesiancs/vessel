import { Marker, Polygon, Polyline } from "react-leaflet";
import { LatLngExpression } from "leaflet";
import { FeatureWithVertices } from "@/entities/map/types";

interface FeatureRendererProps {
  feature: FeatureWithVertices;
}

export function FeatureRenderer({ feature }: FeatureRendererProps) {
  const positions = feature.vertices
    .sort((a, b) => a.sequence - b.sequence)
    .map((v) => [v.latitude, v.longitude] as LatLngExpression);

  if (positions.length === 0) {
    return null;
  }

  switch (feature.feature_type) {
    case "POINT":
      return <Marker position={positions[0]} />;

    case "LINE":
      return <Polyline positions={positions} pathOptions={{ color: "lime" }} />;

    case "POLYGON":
      return (
        <Polygon positions={positions} pathOptions={{ color: "purple" }} />
      );

    default:
      return null;
  }
}
