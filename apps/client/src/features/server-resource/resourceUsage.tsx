import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useCallback, useEffect, useState } from "react";
import { useWebSocket, useWebSocketMessage } from "../ws/WebSocketProvider";
import { WebSocketMessage } from "../ws/ws";

export default function ResourceUsage() {
  const { wsManager } = useWebSocket();
  const [info, setInfo] = useState({
    cpu_usage: 0,
    memory_usage: 0,
  });

  useEffect(() => {
    if (wsManager) {
      wsManager.send({
        type: "get_server",
        payload: {},
      });

      setInterval(() => {
        wsManager.send({
          type: "get_server",
          payload: {},
        });
      }, 2000);
    }
  }, [wsManager]);

  const handleMessage = useCallback((msg: WebSocketMessage) => {
    try {
      if (msg.type === "get_server") {
        setInfo({
          ...(msg.payload as { cpu_usage: number; memory_usage: number }),
        });
      }
    } catch (err) {
      console.error("Error handling signaling message:", err);
    }
  }, []);

  useWebSocketMessage(handleMessage);

  return (
    <>
      <Card className='@container/card'>
        <CardHeader>
          <CardDescription>CPU</CardDescription>
          <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
            {info.cpu_usage.toFixed(2)}%
          </CardTitle>
        </CardHeader>
        <CardFooter className='flex-col items-start gap-1.5 text-sm'>
          <div className='line-clamp-1 flex gap-2 font-medium'>Active</div>
          <div className='text-muted-foreground'>Server CPU Usage %</div>
        </CardFooter>
      </Card>
      <Card className='@container/card'>
        <CardHeader>
          <CardDescription>Memory</CardDescription>
          <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
            {info.memory_usage.toFixed(2)}%
          </CardTitle>
        </CardHeader>
        <CardFooter className='flex-col items-start gap-1.5 text-sm'>
          <div className='line-clamp-1 flex gap-2 font-medium'>Active</div>
          <div className='text-muted-foreground'>Server Memory Usage %</div>
        </CardFooter>
      </Card>
    </>
  );
}
