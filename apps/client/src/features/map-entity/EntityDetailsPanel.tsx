import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { X, MapPin, TabletSmartphone, Server, Minus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getDeviceById } from "@/entities/device/api";
import { EntityAll } from "@/entities/entity/types";
import { EntityCard } from "../entity/Card";
import { useWebSocket, useWebSocketMessage } from "../ws/WebSocketProvider";
import { WebSocketMessage } from "../ws/ws";
import { ChangeStatePayload, StreamState } from "../entity/AllEntities";
import * as api from "../../entities/entity/api";
import { useMapEntityStore } from "./store";
import { cn } from "@/lib/utils";

interface EntityDetailsPanelProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function EntityDetailsPanel({
  isCollapsed,
  onToggleCollapse,
}: EntityDetailsPanelProps) {
  const { selectedEntity, setSelectedEntity } = useMapEntityStore();
  const [device, setDevice] = useState({
    name: "",
    model: "",
    manufacturer: "",
  });
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

  const handleClose = () => {
    setSelectedEntity(null);
  };

  const getDevice = async (device_id: number) => {
    const get = await getDeviceById(device_id);

    setDevice({
      name: get.data.name as string,
      model: get.data.model as string,
      manufacturer: get.data.manufacturer as string,
    });
    setEntities(get.data.entities);
  };

  useEffect(() => {
    if (selectedEntity) {
      getDevice(selectedEntity.device_id);
    }
  }, [selectedEntity]);

  const handleToggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleCollapse();
  };

  if (!selectedEntity) {
    return null;
  }

  return (
    <Card className='w-full flex flex-col max-h-full bg-background'>
      <CardHeader
        onClick={isCollapsed ? onToggleCollapse : undefined}
        className={cn("flex-shrink-0", isCollapsed && "cursor-pointer")}
      >
        <div className='flex justify-between items-start'>
          <div>
            <CardTitle>
              {selectedEntity.friendly_name || selectedEntity.entity_id}
            </CardTitle>
            <CardDescription>{selectedEntity.entity_id}</CardDescription>
          </div>
          <div className='flex items-center'>
            <Button variant='ghost' size='icon' onClick={handleToggleCollapse}>
              <Minus className='h-4 w-4' />
            </Button>
            <Button variant='ghost' size='icon' onClick={handleClose}>
              <X className='h-4 w-4' />
            </Button>
          </div>
        </div>
      </CardHeader>
      {!isCollapsed && (
        <CardContent className='flex-grow space-y-4 overflow-y-auto'>
          <div>
            <h4 className='font-semibold text-sm mb-2'>State</h4>
            <div className='text-sm p-3 bg-muted rounded-md overflow-scroll'>
              <p>
                <strong>State:</strong> {selectedEntity.state?.state || "N/A"}
              </p>
              <p className='text-xs text-muted-foreground'>
                <strong>Last Updated:</strong>{" "}
                {selectedEntity.state
                  ? new Date(selectedEntity.state.last_updated).toLocaleString()
                  : "N/A"}
              </p>
            </div>
          </div>

          <div>
            <h4 className='font-semibold text-sm mb-2'>Details</h4>
            <ul className='text-sm space-y-2'>
              <li className='flex items-center'>
                <MapPin className='h-4 w-4 mr-2 text-muted-foreground' />
                <strong>Type:</strong>{" "}
                <span className='ml-2'>
                  {selectedEntity.entity_type || "N/A"}
                </span>
              </li>
              <li className='flex items-center'>
                <Server className='h-4 w-4 mr-2 text-muted-foreground' />
                <strong>Platform:</strong>{" "}
                <span className='ml-2'>{selectedEntity.platform || "N/A"}</span>
              </li>
              <li className='flex items-center'>
                <TabletSmartphone className='h-4 w-4 mr-2 text-muted-foreground' />
                <strong>Device ID:</strong>{" "}
                <span className='ml-2'>
                  {selectedEntity.device_id ?? "N/A"}
                </span>
              </li>
            </ul>
          </div>

          {selectedEntity.configuration && (
            <div>
              <h4 className='font-semibold text-sm mb-2'>Configuration</h4>
              <pre className='text-xs p-3 bg-muted rounded-md overflow-auto'>
                {JSON.stringify(selectedEntity.configuration, null, 2)}
              </pre>
            </div>
          )}

          <div>
            <h4 className='font-semibold text-base mb-2'>Device</h4>
            <ul className='text-sm space-y-2'>
              <li className='flex items-center'>
                <strong>Name:</strong>{" "}
                <span className='ml-2'>{device.name || "N/A"}</span>
              </li>
              <li className='flex items-center'>
                <strong>Model:</strong>{" "}
                <span className='ml-2'>{device.model || "N/A"}</span>
              </li>
              <li className='flex items-center'>
                <strong>Manufacturer:</strong>{" "}
                <span className='ml-2'>{device.manufacturer || "N/A"}</span>
              </li>
            </ul>
          </div>

          {entities.map((item) => (
            <div key={item.entity_id}>
              <h4 className='font-semibold text-sm mb-2'>
                Entity: {item.friendly_name}
              </h4>
              <EntityCard item={item} streamsState={streamsState} />

              <pre className='text-xs p-3 bg-muted rounded-md overflow-auto mt-2'>
                {JSON.stringify(item, null, 2)}
              </pre>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
