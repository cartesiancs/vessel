import { FeatureWithVertices } from "@/entities/map/types";

interface GeometryProperties {
  location?: string;
  length?: string;
  area?: string;
}

const WGS84 = {
  a: 6378137,
  b: 6356752.314245,
  f: 1 / 298.257223563,
};

const formatNumber = (num: number, digits: number = 2): string => {
  return num.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const degToRad = (degrees: number): number => {
  return degrees * (Math.PI / 180);
};

function vincentyDistance(
  p1: { lat: number; lon: number },
  p2: { lat: number; lon: number },
): number {
  const { a, b, f } = WGS84;
  const L = degToRad(p2.lon - p1.lon);
  const U1 = Math.atan((1 - f) * Math.tan(degToRad(p1.lat)));
  const U2 = Math.atan((1 - f) * Math.tan(degToRad(p2.lat)));
  const sinU1 = Math.sin(U1),
    cosU1 = Math.cos(U1);
  const sinU2 = Math.sin(U2),
    cosU2 = Math.cos(U2);

  let lambda = L,
    lambdaP,
    iterLimit = 100;
  let cosSqAlpha, sinSigma, cosSigma, cos2SigmaM, sigma;

  do {
    const sinLambda = Math.sin(lambda),
      cosLambda = Math.cos(lambda);
    sinSigma = Math.sqrt(
      cosU2 * sinLambda * (cosU2 * sinLambda) +
        (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) *
          (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda),
    );
    if (sinSigma === 0) return 0;

    cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
    sigma = Math.atan2(sinSigma, cosSigma);
    const sinAlpha = (cosU1 * cosU2 * sinLambda) / sinSigma;
    cosSqAlpha = 1 - sinAlpha * sinAlpha;
    cos2SigmaM =
      cosSqAlpha === 0 ? 0 : cosSigma - (2 * sinU1 * sinU2) / cosSqAlpha;

    const C = (f / 16) * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));
    lambdaP = lambda;
    lambda =
      L +
      (1 - C) *
        f *
        sinAlpha *
        (sigma +
          C *
            sinSigma *
            (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));
  } while (Math.abs(lambda - lambdaP) > 1e-12 && --iterLimit > 0);

  if (iterLimit === 0) return NaN;

  const uSq = (cosSqAlpha * (a * a - b * b)) / (b * b);
  const A = 1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const B = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
  const deltaSigma =
    B *
    sinSigma *
    (cos2SigmaM +
      (B / 4) *
        (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
          (B / 6) *
            cos2SigmaM *
            (-3 + 4 * sinSigma * sinSigma) *
            (-3 + 4 * cos2SigmaM * cos2SigmaM)));

  return b * A * (sigma - deltaSigma);
}

function sphericalTriangleArea(
  a: number,
  b: number,
  c: number,
  r: number,
): number {
  if (a <= 0 || b <= 0 || c <= 0) return 0;
  const s = (a + b + c) / 2;

  if (s <= a || s <= b || s <= c) return 0;

  const E =
    4 *
    Math.atan(
      Math.sqrt(
        Math.tan(s / (2 * r)) *
          Math.tan((s - a) / (2 * r)) *
          Math.tan((s - b) / (2 * r)) *
          Math.tan((s - c) / (2 * r)),
      ),
    );

  return E * r * r;
}

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
      return { location: `${lat.toFixed(6)}, ${lon.toFixed(6)}` };
    }

    case "LINE": {
      if (vertices.length < 2) return {};
      let totalLengthMeters = 0;
      for (let i = 0; i < vertices.length - 1; i++) {
        totalLengthMeters += vincentyDistance(vertices[i], vertices[i + 1]);
      }

      if (totalLengthMeters < 1000) {
        return { length: `${formatNumber(totalLengthMeters, 1)} m` };
      }
      return { length: `${formatNumber(totalLengthMeters / 1000, 3)} km` };
    }

    case "POLYGON": {
      if (vertices.length < 3) return {};

      let totalAreaSqMeters = 0;
      const origin = vertices[0];
      const meanRadius = (WGS84.a + WGS84.b) / 2;

      for (let i = 1; i < vertices.length - 1; i++) {
        const p1 = vertices[i];
        const p2 = vertices[i + 1];

        const sideA = vincentyDistance(origin, p1);
        const sideB = vincentyDistance(p1, p2);
        const sideC = vincentyDistance(p2, origin);

        totalAreaSqMeters += sphericalTriangleArea(
          sideA,
          sideB,
          sideC,
          meanRadius,
        );
      }

      if (totalAreaSqMeters < 10000) {
        return { area: `${formatNumber(totalAreaSqMeters, 1)} m²` };
      }
      return { area: `${formatNumber(totalAreaSqMeters / 1_000_000, 3)} km²` };
    }

    default:
      return {};
  }
}
