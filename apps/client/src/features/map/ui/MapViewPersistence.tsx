import { useEffect } from "react";
import { useMapEvents } from "react-leaflet";

const MAP_VIEW_STORAGE_KEY = "map:last-view";

export type StoredMapView = {
  lat: number;
  lng: number;
  zoom?: number;
};

export function getStoredMapView(): StoredMapView | null {
  try {
    const storedValue = localStorage.getItem(MAP_VIEW_STORAGE_KEY);
    if (!storedValue) return null;

    const parsed = JSON.parse(storedValue);
    if (typeof parsed?.lat !== "number" || typeof parsed?.lng !== "number") {
      return null;
    }

    const zoom = typeof parsed.zoom === "number" ? parsed.zoom : undefined;

    return { lat: parsed.lat, lng: parsed.lng, zoom };
  } catch {
    return null;
  }
}

function persistMapView(center: { lat: number; lng: number }, zoom: number) {
  try {
    localStorage.setItem(
      MAP_VIEW_STORAGE_KEY,
      JSON.stringify({ lat: center.lat, lng: center.lng, zoom }),
    );
  } catch {
    // ignore write errors
  }
}

export function MapLastViewTracker() {
  const map = useMapEvents({
    moveend() {
      persistMapView(map.getCenter(), map.getZoom());
    },
  });

  useEffect(() => {
    persistMapView(map.getCenter(), map.getZoom());
  }, [map]);

  return null;
}
