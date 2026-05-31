import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Badge } from "@/shared/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { useMapDataStore, useMapInteractionStore } from "@/entities/map";
import { FeatureRenderer } from "@/features/map-draw";
import { DashboardItemDataMap } from "@/entities/dynamic-dashboard";

type MapPanelProps = {
  data?: DashboardItemDataMap["map"];
  onLayerChange?: (layerId?: number) => void;
};

const FALLBACK_CENTER: [number, number] = [37.5665, 126.978];
const FALLBACK_ZOOM = 5;

export function MapPanel({ data, onLayerChange }: MapPanelProps) {
  const { layers, layer, activeLayerId, fetchAllLayers, setActiveLayer } =
    useMapDataStore();
  const clearSelection = useMapInteractionStore(
    (state) => state.setSelectedFeature,
  );
  const [localLayerId, setLocalLayerId] = useState<number | undefined>(
    data?.layerId,
  );

  useEffect(() => {
    fetchAllLayers().catch((err) => {
      console.error("Failed to fetch layers for map panel", err);
    });
  }, [fetchAllLayers]);

  useEffect(() => {
    if (typeof data?.layerId === "number") {
      setLocalLayerId(data.layerId);
    }
  }, [data?.layerId]);

  useEffect(() => {
    if (typeof localLayerId !== "number" || activeLayerId === localLayerId) {
      return;
    }

    setActiveLayer(localLayerId).catch((err) => {
      console.error("Failed to activate layer in map panel", err);
    });
    clearSelection(null);
  }, [activeLayerId, clearSelection, localLayerId, setActiveLayer]);

  const viewCenter = useMemo<[number, number]>(() => {
    if (data?.center) return data.center;
    const positions =
      layer?.features.flatMap((feature) =>
        feature.vertices.map(
          (v) => [v.latitude, v.longitude] as [number, number],
        ),
      ) || [];

    if (positions.length === 0) {
      return FALLBACK_CENTER;
    }

    const [latSum, lngSum] = positions.reduce(
      (acc, [lat, lng]) => [acc[0] + lat, acc[1] + lng],
      [0, 0],
    );
    return [latSum / positions.length, lngSum / positions.length];
  }, [data?.center, layer?.features]);

  const zoom = data?.zoom ?? FALLBACK_ZOOM;

  const handleLayerChange = (value: string) => {
    const nextId = Number(value);
    const validId = Number.isFinite(nextId) ? nextId : undefined;
    setLocalLayerId(validId);
    onLayerChange?.(validId);
  };

  return (
    <div className='flex h-full w-full flex-col gap-2'>
      <div className='flex items-center justify-between gap-2 text-xs'>
        <Select
          value={
            typeof localLayerId === "number" ? String(localLayerId) : undefined
          }
          onValueChange={handleLayerChange}
        >
          <SelectTrigger className='h-8 w-[180px]'>
            <SelectValue placeholder='Select layer' />
          </SelectTrigger>
          <SelectContent>
            {layers.map((l) => (
              <SelectItem key={l.id} value={String(l.id)}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant='outline'>{layer?.features.length ?? 0} features</Badge>
      </div>
      <div className='relative h-full w-full overflow-hidden bg-muted/50'>
        {typeof localLayerId !== "number" ? (
          <div className='flex h-full items-center justify-center text-xs text-muted-foreground'>
            Select a layer to preview the map.
          </div>
        ) : (
          <MapContainer
            center={viewCenter}
            zoom={zoom}
            maxZoom={22}
            scrollWheelZoom
            zoomControl={false}
            className='h-full w-full'
          >
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url='https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
              maxNativeZoom={20}
              maxZoom={22}
            />
            {layer?.features.map((feature) => (
              <FeatureRenderer
                key={`feature-${feature.id}`}
                feature={feature}
              />
            ))}
            <ResizeInvalidator />
          </MapContainer>
        )}
      </div>
    </div>
  );
}

function ResizeInvalidator() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const handle = () => map.invalidateSize();
    handle();

    const observer = new ResizeObserver(() => handle());
    observer.observe(container);

    return () => observer.disconnect();
  }, [map]);

  return null;
}
