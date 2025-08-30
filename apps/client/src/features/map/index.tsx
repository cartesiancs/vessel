import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { getAllEntitiesFilter } from "@/entities/entity/api";
import { EntityAll } from "@/entities/entity/types";

import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
import { useMapStore } from "./store";
import "./style.css";
import { useMapDataStore } from "@/entities/map/store";
import { MapEvents } from "./MapEvents";
import { DrawingPreview } from "./FeatureDrawingPreview";
import { FeatureRenderer } from "./FeatureRenderer";
import { FeatureEditor } from "./FeatureEditor";
import { FeatureDetailsPanel } from "./FeatureDetailsPanel";

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const failedPosition = [39.8283, -98.5795];

L.Marker.prototype.options.icon = DefaultIcon;

const parseGpsState = (
  state: string | null | undefined,
): [number, number] | null => {
  if (!state) return null;

  const latMatch = state.match(/lat=([-\d.]+)/);
  const lngMatch = state.match(/lng=([-\d.]+)/);

  if (latMatch && lngMatch && latMatch[1] && lngMatch[1]) {
    const lat = parseFloat(latMatch[1]);
    const lng = parseFloat(lngMatch[1]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return [lat, lng];
    }
  }
  return null;
};

export function MapView() {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [entities, setEntities] = useState<EntityAll[]>([]);
  const setSelectedEntity = useMapStore((state) => state.setSelectedEntity);
  const { layer, fetchAllLayers } = useMapDataStore();

  const fetchEntities = async () => {
    try {
      const response = await getAllEntitiesFilter("GPS");
      setEntities(response.data);
    } catch (error) {
      console.error("Failed to fetch entities:", error);
    }
  };

  useEffect(() => {
    fetchEntities();
    fetchAllLayers();

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setPosition([latitude, longitude]);
      },
      (err) => {
        console.log("Error getting location:", err);
        setPosition(failedPosition as [number, number]);
      },
      {
        enableHighAccuracy: true,
      },
    );
  }, []);

  return (
    <>
      <FeatureDetailsPanel />
      {!position ? (
        <div className='flex items-center justify-center h-full'>
          <span>Loading Map...</span>
        </div>
      ) : (
        <MapContainer
          center={position}
          zoom={13}
          scrollWheelZoom={true}
          zoomControl={false}
          className='h-full w-full'
        >
          <TileLayer
            attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
            url='https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
          />

          {layer?.features.map((feature) => (
            <FeatureRenderer key={`feature-${feature.id}`} feature={feature} />
          ))}
          <MapEvents />
          <DrawingPreview />
          <FeatureEditor />

          {entities.map((entity) => {
            const markerPosition = parseGpsState(entity.state?.state);
            if (!markerPosition) return null;

            return (
              <Marker
                key={entity.id}
                position={markerPosition}
                eventHandlers={{
                  click: () => {
                    setSelectedEntity(entity);
                  },
                }}
              ></Marker>
            );
          })}
        </MapContainer>
      )}
    </>
  );
}
