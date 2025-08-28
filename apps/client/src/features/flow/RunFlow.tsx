import { Button } from "@/components/ui/button";
import { useFlowStore } from "@/entities/flow/store";
import { Play, Square } from "lucide-react";
import { toast } from "sonner";
import { useWebSocket, useWebSocketMessage } from "../ws/WebSocketProvider";
import { useCallback, useEffect, useState } from "react";
import { WebSocketMessage } from "../ws/ws";

export function RunFlowButton() {
  const { wsManager } = useWebSocket();

  const { currentFlowId, saveGraph } = useFlowStore();

  const [isRun, setIsRun] = useState(false);

  const handleSend = async () => {
    if (!currentFlowId || !wsManager) {
      toast.error("WebSocket is not connected or no flow is selected.");
      return;
    }

    if (currentFlowId && wsManager) {
      await saveGraph();
      wsManager.send({
        type: "compute_flow",
        payload: {
          flow_id: currentFlowId,
        },
      });

      setTimeout(() => {
        wsManager.send({
          type: "get_all_flows",
          payload: {},
        });
      }, 500);
    }
  };

  const handleSendStop = async () => {
    if (!currentFlowId || !wsManager) {
      toast.error("WebSocket is not connected or no flow is selected.");
      return;
    }

    if (currentFlowId && wsManager) {
      await saveGraph();
      wsManager.send({
        type: "stop_flow",
        payload: {
          flow_id: currentFlowId,
        },
      });

      setTimeout(() => {
        wsManager.send({
          type: "get_all_flows",
          payload: {},
        });
      }, 500);
      setIsRun(false);
    }
  };

  const handleMessage = useCallback(
    (msg: WebSocketMessage) => {
      try {
        if (msg.type === "get_all_flows_response") {
          const loads = msg.payload as {
            id: number;
            name: string;
            is_running: boolean;
          }[];
          const index = loads.findIndex((item) => {
            return item.id == currentFlowId;
          });

          if (index != -1) {
            setIsRun(!loads[index].is_running);
          }
        }
      } catch (err) {
        console.error("Error handling signaling message:", err);
      }
    },
    [currentFlowId],
  );

  useEffect(() => {
    if (currentFlowId && wsManager) {
      wsManager.send({
        type: "get_all_flows",
        payload: {},
      });
    }
  }, [currentFlowId, wsManager]);

  useWebSocketMessage(handleMessage);

  return (
    <>
      {isRun ? (
        <Button onClick={handleSend} size={"icon"} variant={"outline"}>
          <Play />
        </Button>
      ) : (
        <Button onClick={handleSendStop} size={"icon"} variant={"destructive"}>
          <Square />
        </Button>
      )}
    </>
  );
}
