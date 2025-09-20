import React from "react";
import { useWebSocket } from "./WebSocketProvider";

function Offline() {
  return (
    <span className='flex flex-row text-gray-600 justify-center text-xs items-center gap-1 font-light h-[16px]'>
      <span className='w-2 h-2 bg-gray-600 rounded'></span> Offline
    </span>
  );
}

function Online() {
  return (
    <span className='flex flex-row text-emerald-500 justify-center text-xs items-center gap-1 font-light h-[16px]'>
      <span className='w-2 h-2 bg-emerald-600 rounded'></span> Connented
    </span>
  );
}

export function WebSocketStatusIndicator() {
  const { isConnected } = useWebSocket();

  if (isConnected) {
    return <Online />;
  } else {
    return <Offline />;
  }
}
