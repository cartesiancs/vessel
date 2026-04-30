import { useEffect, useState, useRef, useCallback } from "react";
import { X, ChevronDown, ChevronUp, Terminal } from "lucide-react";
import { useWebSocketMessage } from "../ws/WebSocketProvider";
import { WebSocketMessage } from "../ws/ws";

export function FlowLog() {
  const [logMessages, setLogMessages] = useState<string[]>([]);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const handleMessage = useCallback((msg: WebSocketMessage) => {
    setIsPanelOpen(true);
    setIsCollapsed(false);
    try {
      if (msg.type === "log_message") {
        const timestamp = new Date().toLocaleTimeString("en-US", {
          hour12: false,
        });
        setLogMessages((prev) => [
          ...prev,
          `[${timestamp}] ${JSON.stringify(msg.payload)}`,
        ]);
      }
    } catch (err) {
      console.error("Error handling signaling message:", err);
    }
  }, []);

  useWebSocketMessage(handleMessage);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logMessages]);

  if (!isPanelOpen) {
    return null;
  }

  return (
    <div
      className={`absolute bottom-0 left-0 right-0  bg-neutral-900 text-white border-t-2 border-neutral-700 shadow-lg transition-all duration-300 ease-in-out z-10 ${
        isCollapsed ? "h-12" : "h-64"
      }`}
    >
      <div
        className='flex items-center justify-between p-3 bg-neutral-800 cursor-pointer'
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className='flex items-center gap-2'>
          <Terminal size={16} className='text-gray-400' />
          <h3 className='font-semibold text-sm tracking-wider select-none'>
            LOGS
          </h3>
        </div>
        <div className='flex items-center gap-2'>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsCollapsed(!isCollapsed);
            }}
            className='p-1 rounded hover:bg-gray-700'
            aria-label={isCollapsed ? "Expand logs" : "Collapse logs"}
          >
            {isCollapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsPanelOpen(false);
              setLogMessages([]);
            }}
            className='p-1 rounded hover:bg-gray-700'
            aria-label='Close logs'
          >
            <X size={16} />
          </button>
        </div>
      </div>
      {!isCollapsed && (
        <div
          ref={logContainerRef}
          className='h-[calc(100%-3rem)] overflow-y-auto p-4'
        >
          <pre className='text-sm font-mono whitespace-pre-wrap break-words'>
            {logMessages.map((message, index) => (
              <div key={index} className='text-gray-300'>
                {message}
              </div>
            ))}
          </pre>
        </div>
      )}
    </div>
  );
}
