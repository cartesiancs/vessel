import { useCallback, useEffect, useState } from "react";
import * as api from "@/entities/entity/api";
import { EntityAll, State } from "@/entities/entity/types";
import { useWebSocket, useWebSocketMessage } from "../ws/WebSocketProvider";
import { WebSocketMessage } from "../ws/ws";

export type StreamState = {
  topic: string;
  is_online: boolean;
};

export type ChangeStatePayload = {
  entity_id: string;
  state: State;
};

export function useEntitiesData() {
  const [entities, setEntities] = useState<EntityAll[]>([]);
  const [streamsState, setStreamsState] = useState<StreamState[]>([]);
  const { wsManager, isConnected } = useWebSocket();

  const getAllEntities = useCallback(async () => {
    try {
      const response = await api.getAllEntities();
      setEntities(response.data);
    } catch (error) {
      console.error("Failed to fetch all entities:", error);
    }
  }, []);

  const handleMessage = useCallback(
    (msg: WebSocketMessage) => {
      try {
        if (msg.type === "stream_state") {
          const loads = msg.payload as StreamState[];
          setStreamsState(loads);
        }

        if (msg.type == "change_state") {
          const index = entities.findIndex((item) => {
            return (
              item.entity_id == (msg.payload as ChangeStatePayload).entity_id
            );
          });

          if (index == -1) {
            return false;
          }

          if (entities[index].state) {
            entities[index].state = (msg.payload as ChangeStatePayload).state;

            setEntities([...entities]);
          }
        }
      } catch (err) {
        console.error("Error handling signaling message:", err);
      }
    },
    [entities],
  );

  useEffect(() => {
    if (wsManager && isConnected) {
      wsManager.send({
        type: "get_all_stream_state",
        payload: {},
      });

      const interval = setInterval(() => {
        wsManager.send({
          type: "get_all_stream_state",
          payload: {},
        });
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [wsManager, isConnected]);

  useWebSocketMessage(handleMessage);

  useEffect(() => {
    getAllEntities();
  }, [getAllEntities]);

  return { entities, streamsState, refresh: getAllEntities };
}
