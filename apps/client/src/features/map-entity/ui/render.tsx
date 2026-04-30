import { getAllEntitiesFilter } from "@/entities/entity";
import { EntityAll } from "@/entities/entity";
import L from "leaflet";
import { MapPin } from "lucide-react";
import { useState, useEffect, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseGpsState } from "../../gps";
import { useMapEntityStore } from "../model/store";
import { Marker } from "react-leaflet";

const MARKER_W = 32;
const MARKER_H = 36;
const MARKER_SEL_W = 40;
const MARKER_SEL_H = 44;

const PIN_SHADOW =
  "filter:drop-shadow(0 1px 2px rgba(0,0,0,0.35)) drop-shadow(0 0 1px rgba(0,0,0,0.25))";

function lucideMapPinMarkup(size: number): string {
  return renderToStaticMarkup(
    createElement(MapPin, {
      size,
      strokeWidth: 1.5,
      absoluteStrokeWidth: true,
      color: "#ffffff",
      fill: "none",
      strokeLinecap: "round",
      strokeLinejoin: "round",
    }),
  );
}

function entityMarkerHtml(selected: boolean): string {
  const w = selected ? MARKER_SEL_W : MARKER_W;
  const h = selected ? MARKER_SEL_H : MARKER_H;
  const pinSize = selected ? 28 : 22;
  return `<div style="width:${w}px;height:${h}px;display:flex;align-items:flex-end;justify-content:center;pointer-events:none;${PIN_SHADOW}">${lucideMapPinMarkup(pinSize)}</div>`;
}

const entityMarkerIconDefault = L.divIcon({
  className: "leaflet-div-icon entity-map-marker-icon",
  html: entityMarkerHtml(false),
  iconSize: [MARKER_W, MARKER_H],
  iconAnchor: [MARKER_W / 2, MARKER_H],
});

const entityMarkerIconSelected = L.divIcon({
  className: "leaflet-div-icon entity-map-marker-icon",
  html: entityMarkerHtml(true),
  iconSize: [MARKER_SEL_W, MARKER_SEL_H],
  iconAnchor: [MARKER_SEL_W / 2, MARKER_SEL_H],
});

export function MapEntityRender() {
  const [entities, setEntities] = useState<EntityAll[]>([]);
  const setSelectedEntity = useMapEntityStore(
    (state) => state.setSelectedEntity,
  );
  const selectedEntityId = useMapEntityStore(
    (state) => state.selectedEntity?.id ?? null,
  );

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
  }, []);

  return (
    <>
      {entities.map((entity) => {
        const markerPosition = parseGpsState(entity.state?.state);
        if (!markerPosition) return null;

        return (
          <Marker
            key={entity.id}
            position={markerPosition}
            icon={
              entity.id === selectedEntityId
                ? entityMarkerIconSelected
                : entityMarkerIconDefault
            }
            eventHandlers={{
              click: () => {
                setSelectedEntity(entity);
              },
            }}
          />
        );
      })}
    </>
  );
}
