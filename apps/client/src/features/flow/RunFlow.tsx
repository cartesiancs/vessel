import { Button } from "@/components/ui/button";
import { useFlowStore } from "@/entities/flow/store";
import { Play } from "lucide-react";
import { toast } from "sonner";
import { useWebSocket } from "../ws/WebSocketProvider";

export function RunFlowButton() {
  const { isConnected, sendMessage } = useWebSocket();
  const { currentFlowId } = useFlowStore();

  const handleSend = () => {
    if (!isConnected || !currentFlowId) {
      toast.error("WebSocket is not connected or no flow is selected.");
      return;
    }

    if (currentFlowId) {
      sendMessage({
        type: "compute_flow",
        payload: {
          flow_id: currentFlowId,
        },
      });
    }
  };

  return (
    <Button onClick={handleSend} size={"sm"} variant={"outline"}>
      <Play />
    </Button>
  );
}
