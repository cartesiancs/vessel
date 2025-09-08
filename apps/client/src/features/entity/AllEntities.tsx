import { Fragment, useCallback, useEffect, useState } from "react";
import * as api from "../../entities/entity/api";
import { EntityAll, State } from "@/entities/entity/types";
import { useWebSocket, useWebSocketMessage } from "../ws/WebSocketProvider";
import { WebSocketMessage } from "../ws/ws";
import { EntityCard } from "./Card";

export type StreamState = {
  topic: string;
  is_online: boolean;
};

export type ChangeStatePayload = {
  entity_id: string;
  state: State;
};

export function AllEntities() {
  const [entities, setEntities] = useState<EntityAll[]>([]);
  const [streamsState, setStreamsState] = useState<StreamState[]>([]);
  const { wsManager, isConnected } = useWebSocket();

  const getAllEntities = async () => {
    try {
      const response = await api.getAllEntities();
      setEntities(response.data);
    } catch (error) {
      console.error("Failed to fetch all entities:", error);
    }
  };

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

      setInterval(() => {
        wsManager.send({
          type: "get_all_stream_state",
          payload: {},
        });
      }, 5000);
    }
  }, [wsManager, isConnected]);

  useWebSocketMessage(handleMessage);

  useEffect(() => {
    getAllEntities();
  }, []);

  return (
    <>
      <div className='grid grid-cols-1 gap-4 px-0 sm:grid-cols-2 lg:grid-cols-4 lg:px-6'>
        {entities.map((item) => (
          <Fragment key={item.id}>
            <EntityCard item={item} streamsState={streamsState} />
          </Fragment>
        ))}
      </div>
    </>
  );
}
