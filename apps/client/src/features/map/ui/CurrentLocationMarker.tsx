import { useEffect, useRef, useState } from "react";
import { Circle, CircleMarker } from "react-leaflet";

type Props = {
  onLocationUpdate?: (coords: [number, number]) => void;
};

export function CurrentLocationMarker({ onLocationUpdate }: Props) {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const hasReportedInitialPosition = useRef(false);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords: [number, number] = [
          pos.coords.latitude,
          pos.coords.longitude,
        ];

        setPosition(coords);
        setAccuracy(
          typeof pos.coords.accuracy === "number" ? pos.coords.accuracy : null,
        );

        if (!hasReportedInitialPosition.current && onLocationUpdate) {
          onLocationUpdate(coords);
          hasReportedInitialPosition.current = true;
        }
      },
      (err) => {
        console.log("Error watching location:", err);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 5000,
      },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [onLocationUpdate]);

  const baseRadius = Math.max(accuracy ?? 0, 10);
  const rippleRadius = baseRadius + 24;

  if (!position) return null;

  return (
    <>
      <Circle
        center={position}
        radius={rippleRadius}
        pathOptions={{
          className: "current-location-ripple",
          color: "#22c55e",
          fillColor: "#22c55e",
          fillOpacity: 0.2,
          weight: 1,
          opacity: 0.2,
        }}
      />
      <Circle
        center={position}
        radius={baseRadius}
        pathOptions={{
          color: "#22c55e",
          fillColor: "#22c55e",
          fillOpacity: 0.12,
          weight: 1,
        }}
      />
      <CircleMarker
        center={position}
        radius={6}
        pathOptions={{
          color: "#15803d",
          fillColor: "#22c55e",
          fillOpacity: 0.92,
          weight: 2,
        }}
      />
    </>
  );
}
