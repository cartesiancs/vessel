import { getAllEntitiesFilter } from "@/entities/entity/api";
import { EntityAll } from "@/entities/entity/types";
import { useState, useEffect } from "react";
import { parseGpsState } from "../gps/parseGps";
import { useMapEntityStore } from "./store";
import { Marker } from "react-leaflet";

export function MapEntityRender() {
  const [entities, setEntities] = useState<EntityAll[]>([]);
  const setSelectedEntity = useMapEntityStore(
    (state) => state.setSelectedEntity,
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
            eventHandlers={{
              click: () => {
                setSelectedEntity(entity);
              },
            }}
          ></Marker>
        );
      })}
    </>
  );
}
