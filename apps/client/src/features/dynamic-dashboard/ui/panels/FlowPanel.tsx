import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { useFlowStore } from "@/entities/flow";
import {
  useWebSocket,
  useWebSocketMessage,
} from "@/features/ws";
import { getFlowRunSessionId, WebSocketMessage } from "@/features/ws";
import { DashboardItemDataMap } from "@/entities/dynamic-dashboard";
import { Play, Square } from "lucide-react";

type FlowPanelProps = {
  data?: DashboardItemDataMap["flow"];
  onFlowChange?: (flowId?: number) => void;
};

type FlowStatusPayload = {
  id: number;
  name: string;
  is_running: boolean;
}[];

export function FlowPanel({ data, onFlowChange }: FlowPanelProps) {
  const { flows, fetchFlows } = useFlowStore();
  const { wsManager } = useWebSocket();
  const [selectedFlowId, setSelectedFlowId] = useState<number | undefined>(
    data?.flowId,
  );
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    fetchFlows().catch((err) => {
      console.error("Failed to fetch flows for flow panel", err);
    });
  }, [fetchFlows]);

  useEffect(() => {
    if (typeof data?.flowId === "number") {
      setSelectedFlowId(data.flowId);
    }
    setIsRunning(data?.autoRun ?? false);
  }, [data?.autoRun, data?.flowId]);

  const selectedFlowName = useMemo(() => {
    if (typeof selectedFlowId !== "number") return "No flow selected";
    return flows.find((f) => f.id === selectedFlowId)?.name ?? "Unknown flow";
  }, [flows, selectedFlowId]);

  const requestStatus = (flowId?: number) => {
    if (!wsManager || typeof flowId !== "number") {
      return;
    }
    wsManager.send({
      type: "get_all_flows",
      payload: {},
    });
  };

  useWebSocketMessage((msg: WebSocketMessage) => {
    if (msg.type !== "get_all_flows_response" || !msg.payload) return;
    const payload = msg.payload as FlowStatusPayload;
    if (!Array.isArray(payload)) return;

    const match = payload.find((flow) => flow.id === selectedFlowId);
    if (match) {
      setIsRunning(Boolean(match.is_running));
    }
  });

  useEffect(() => {
    requestStatus(selectedFlowId);
  }, [selectedFlowId]);

  const handleSelect = (value: string) => {
    const nextId = Number(value);
    const validId = Number.isFinite(nextId) ? nextId : undefined;
    setSelectedFlowId(validId);
    onFlowChange?.(validId);
    requestStatus(validId);
  };

  const handleRun = () => {
    if (!wsManager || typeof selectedFlowId !== "number") {
      return;
    }
    wsManager.send({
      type: "compute_flow",
      payload: {
        flow_id: selectedFlowId,
        run_context: { session_id: getFlowRunSessionId() },
      },
    });
    requestStatus(selectedFlowId);
  };

  const handleStop = () => {
    if (!wsManager || typeof selectedFlowId !== "number") {
      return;
    }
    wsManager.send({
      type: "stop_flow",
      payload: { flow_id: selectedFlowId },
    });
    requestStatus(selectedFlowId);
  };

  return (
    <div className='flex h-full w-full flex-col gap-3'>
      <div className='flex items-center justify-between gap-2 text-xs'>
        <Select
          value={
            typeof selectedFlowId === "number"
              ? String(selectedFlowId)
              : undefined
          }
          onValueChange={handleSelect}
        >
          <SelectTrigger className='h-8 w-[180px]'>
            <SelectValue placeholder='Select flow' />
          </SelectTrigger>
          <SelectContent>
            {flows.map((flow) => (
              <SelectItem key={flow.id} value={String(flow.id)}>
                {flow.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant={isRunning ? "default" : "outline"}>
          {isRunning ? "Running" : "Stopped"}
        </Badge>
      </div>
      <div className='flex flex-1 flex-col justify-between border border-dashed p-3 text-sm'>
        <div className='space-y-1'>
          <p className='text-xs text-muted-foreground'>Selected flow</p>
          <p className='font-semibold'>{selectedFlowName}</p>
        </div>
        <div className='flex items-center justify-end gap-2'>
          <Button
            size='sm'
            variant='outline'
            onClick={handleStop}
            disabled={!selectedFlowId}
          >
            <Square className='mr-1 h-3 w-3' />
            Stop
          </Button>
          <Button size='sm' onClick={handleRun} disabled={!selectedFlowId}>
            <Play className='mr-1 h-3 w-3' />
            Run
          </Button>
        </div>
      </div>
    </div>
  );
}
