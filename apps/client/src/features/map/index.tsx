import { useState, useEffect, useCallback } from "react";
import { Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
import "./style.css";
import { useMapDataStore, useMapInteractionStore } from "@/entities/map/store";
import { TILE_MAPS } from "@/entities/map/types";

import { MapEntityRender } from "../map-entity/render";
import { FeatureDetailsPanel } from "../map-draw/FeatureDetailsPanel";
import { DrawingPreview } from "../map-draw/FeatureDrawingPreview";
import { FeatureEditor } from "../map-draw/FeatureEditor";
import { FeatureRenderer } from "../map-draw/FeatureRenderer";
import { MapEvents } from "../map-draw/MapEvents";
import { EntityDetailsPanel } from "../map-entity/EntityDetailsPanel";
import { useMapEntityStore } from "../map-entity/store";
import { cn } from "@/lib/utils";
import { MapLastViewTracker, getStoredMapView } from "./MapViewPersistence";
import { CurrentLocationMarker } from "./CurrentLocationMarker";

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

function CustomZoomControl() {
  const map = useMap();

  return (
    <div className='absolute bottom-14 right-4 z-[1000] flex flex-col gap-1 bg-background/80 rounded-md shadow-lg backdrop-blur-sm'>
      <Button
        size='icon'
        variant='ghost'
        className='h-8 w-8 border-1'
        onClick={() => map.zoomIn()}
      >
        <Plus className='h-4 w-4' />
      </Button>
      <Button
        size='icon'
        variant='ghost'
        className='h-8 w-8 border-1'
        onClick={() => map.zoomOut()}
      >
        <Minus className='h-4 w-4' />
      </Button>
    </div>
  );
}

function CustomScaleControl() {
  const map = useMap();
  const [scale, setScale] = useState({ value: 0, unit: "m" });

  const updateScale = useCallback(() => {
    const y = map.getSize().y / 2;
    const leftPoint = map.containerPointToLatLng([0, y]);
    const rightPoint = map.containerPointToLatLng([100, y]);
    const distance = leftPoint.distanceTo(rightPoint);

    let value: number;
    let unit: string;

    if (distance >= 1000) {
      value = Math.round((distance / 1000) * 10) / 10;
      unit = "km";
    } else {
      value = Math.round(distance);
      unit = "m";
    }

    setScale({ value, unit });
  }, [map]);

  useEffect(() => {
    updateScale();
    map.on("zoomend", updateScale);
    map.on("moveend", updateScale);

    return () => {
      map.off("zoomend", updateScale);
      map.off("moveend", updateScale);
    };
  }, [map, updateScale]);

  return (
    <div className='absolute bottom-4 right-4 z-[1000] bg-background/80 rounded-md shadow-lg backdrop-blur-sm px-2 py-1'>
      <div className='flex items-center gap-2 text-xs'>
        <div className='w-[100px] h-1 bg-foreground/70 relative'>
          <div className='absolute left-0 top-[-3px] w-[1px] h-[7px] bg-foreground/70' />
          <div className='absolute right-0 top-[-3px] w-[1px] h-[7px] bg-foreground/70' />
        </div>
        <span className='text-foreground/70 font-mono'>
          {scale.value} {scale.unit}
        </span>
      </div>
    </div>
  );
}

export function MapView({
  isSidebarCollapsed,
}: {
  isSidebarCollapsed: boolean;
}) {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [initialZoom, setInitialZoom] = useState(13);
  const { layer, fetchAllLayers } = useMapDataStore();
  const { selectedFeature, tileMapType } = useMapInteractionStore();
  const currentTileMap = TILE_MAPS[tileMapType];
  const { selectedEntity } = useMapEntityStore();

  const [isFeaturePanelCollapsed, setFeaturePanelCollapsed] = useState(false);
  const [isEntityPanelCollapsed, setEntityPanelCollapsed] = useState(false);

  useEffect(() => {
    fetchAllLayers();
  }, [fetchAllLayers]);

  useEffect(() => {
    const storedView = getStoredMapView();

    if (storedView) {
      setPosition([storedView.lat, storedView.lng]);
      if (typeof storedView.zoom === "number") {
        setInitialZoom(storedView.zoom);
      }
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setPosition((prev) => prev ?? [latitude, longitude]);
      },
      (err) => {
        console.log("Error getting location:", err);
        setPosition((prev) => prev ?? (failedPosition as [number, number]));
      },
      {
        enableHighAccuracy: true,
        timeout: 2000,
        maximumAge: 0,
      },
    );
  }, []);

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
          zoom={initialZoom}
          maxZoom={23}
          scrollWheelZoom={true}
          zoomControl={false}
          className='h-full w-full'
        >
          <TileLayer
            key={tileMapType}
            attribution={currentTileMap.attribution}
            url={currentTileMap.url}
            maxNativeZoom={currentTileMap.maxNativeZoom}
            maxZoom={23}
          />
          {layer?.features.map((feature) => (
            <FeatureRenderer key={`feature-${feature.id}`} feature={feature} />
          ))}
          <MapEvents />
          <DrawingPreview />
          <FeatureEditor />
          <MapEntityRender />
          <CurrentLocationMarker />
          <MapLastViewTracker />
          <MapResizer isSidebarCollapsed={isSidebarCollapsed} />
          <CustomZoomControl />
          <CustomScaleControl />
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
