import { useState, useEffect } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
import "./style.css";
import { useMapDataStore } from "@/entities/map/store";

import { MapEntityRender } from "../map-entity/render";
import { FeatureDetailsPanel } from "../map-draw/FeatureDetailsPanel";
import { DrawingPreview } from "../map-draw/FeatureDrawingPreview";
import { FeatureEditor } from "../map-draw/FeatureEditor";
import { FeatureRenderer } from "../map-draw/FeatureRenderer";
import { MapEvents } from "../map-draw/MapEvents";

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const failedPosition = [39.8283, -98.5795];

L.Marker.prototype.options.icon = DefaultIcon;

export function MapView() {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const { layer, fetchAllLayers } = useMapDataStore();

  useEffect(() => {
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
        timeout: 2000,
        maximumAge: 0,
      },
    );
  }, [setPosition, fetchAllLayers]);

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

          <MapEntityRender />
        </MapContainer>
      )}
    </>
  );
}
