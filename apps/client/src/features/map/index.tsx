import { useState, useEffect } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
import "./style.css";
import { useMapDataStore, useMapInteractionStore } from "@/entities/map/store";

import { MapEntityRender } from "../map-entity/render";
import { FeatureDetailsPanel } from "../map-draw/FeatureDetailsPanel";
import { DrawingPreview } from "../map-draw/FeatureDrawingPreview";
import { FeatureEditor } from "../map-draw/FeatureEditor";
import { FeatureRenderer } from "../map-draw/FeatureRenderer";
import { MapEvents } from "../map-draw/MapEvents";
import { EntityDetailsPanel } from "../map-entity/EntityDetailsPanel";
import { useMapEntityStore } from "../map-entity/store";
import { cn } from "@/lib/utils";

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const failedPosition = [39.8283, -98.5795];

L.Marker.prototype.options.icon = DefaultIcon;

function MapResizer({ isSidebarCollapsed }: { isSidebarCollapsed: boolean }) {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 310);

    return () => {
      clearTimeout(timer);
    };
  }, [isSidebarCollapsed, map]);

  return null;
}

export function MapView({
  isSidebarCollapsed,
}: {
  isSidebarCollapsed: boolean;
}) {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const { layer, fetchAllLayers } = useMapDataStore();
  const { selectedFeature } = useMapInteractionStore();
  const { selectedEntity } = useMapEntityStore();

  const [isFeaturePanelCollapsed, setFeaturePanelCollapsed] = useState(false);
  const [isEntityPanelCollapsed, setEntityPanelCollapsed] = useState(false);

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

  const showPanelContainer = selectedFeature || selectedEntity;

  return (
    <div className='relative h-full w-full overflow-hidden'>
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
          <MapResizer isSidebarCollapsed={isSidebarCollapsed} />
        </MapContainer>
      )}

      <div
        className={cn(
          "absolute top-[48px] right-0 h-[calc(100%-48px)] p-4 w-[400px] z-[1001]",
          "flex flex-col gap-4 overflow-y-auto transition-transform duration-300 ease-in-out",
          "pointer-events-none",
          showPanelContainer ? "translate-x-0" : "translate-x-full",
        )}
      >
        {selectedFeature && (
          <div className='pointer-events-auto'>
            <FeatureDetailsPanel
              isCollapsed={isFeaturePanelCollapsed}
              onToggleCollapse={() => setFeaturePanelCollapsed((prev) => !prev)}
            />
          </div>
        )}
        {selectedEntity && (
          <div className='pointer-events-auto'>
            <EntityDetailsPanel
              isCollapsed={isEntityPanelCollapsed}
              onToggleCollapse={() => setEntityPanelCollapsed((prev) => !prev)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
