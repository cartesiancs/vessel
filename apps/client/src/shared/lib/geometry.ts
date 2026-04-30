import { FeatureWithVertices } from "@/entities/map/types";

interface GeometryProperties {
  location?: string;
  length?: string;
  area?: string;
}

const EARTH_RADIUS_KM = 6371;

const degToRad = (degrees: number): number => {
  return degrees * (Math.PI / 180);
};

const haversineDistance = (
  p1: { lat: number; lon: number },
  p2: { lat: number; lon: number },
): number => {
  const dLat = degToRad(p2.lat - p1.lat);
  const dLon = degToRad(p2.lon - p1.lon);

  const lat1 = degToRad(p1.lat);
  const lat2 = degToRad(p2.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
};

const formatNumber = (num: number, digits: number = 2): string => {
  return num.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

export function calculateFeatureGeometry(
  feature: FeatureWithVertices,
): GeometryProperties {
  const vertices = feature.vertices
    .sort((a, b) => a.sequence - b.sequence)
    .map((v) => ({ lat: v.latitude, lon: v.longitude }));

  switch (feature.feature_type) {
    case "POINT": {
      if (vertices.length === 0) return {};
      const { lat, lon } = vertices[0];
      return {
        location: `${lat.toFixed(6)}, ${lon.toFixed(6)}`,
      };
    }

    case "LINE": {
      if (vertices.length < 2) return {};
      let totalLengthKm = 0;
      for (let i = 0; i < vertices.length - 1; i++) {
        totalLengthKm += haversineDistance(vertices[i], vertices[i + 1]);
      }

      if (totalLengthKm < 1) {
        return { length: `${formatNumber(totalLengthKm * 1000, 1)} m` };
      }
      return { length: `${formatNumber(totalLengthKm, 2)} km` };
    }

    case "POLYGON": {
      if (vertices.length < 3) return {};

      const earthRadiusM = EARTH_RADIUS_KM * 1000;
      let area = 0;
      const closedVertices = [...vertices, vertices[0]];

      for (let i = 0; i < vertices.length; i++) {
        const p1 = closedVertices[i];
        const p2 = closedVertices[i + 1];

        const x1 = degToRad(p1.lon) * earthRadiusM * Math.cos(degToRad(p1.lat));
        const y1 = degToRad(p1.lat) * earthRadiusM;
        const x2 = degToRad(p2.lon) * earthRadiusM * Math.cos(degToRad(p2.lat));
        const y2 = degToRad(p2.lat) * earthRadiusM;

        area += x1 * y2 - x2 * y1;
      }

      const areaInSqMeters = Math.abs(area / 2);

      if (areaInSqMeters < 10000) {
        return { area: `${formatNumber(areaInSqMeters, 1)} m²` };
      }
      return { area: `${formatNumber(areaInSqMeters / 1_000_000, 3)} km²` };
    }

    default:
      return {};
  }
}
