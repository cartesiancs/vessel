import { getLogs } from "@/entities/log/api";
import { useEffect, useState } from "react";

export function Logs() {
  const [log, setLog] = useState("");

  const handleLog = async () => {
    const logs = await getLogs();

    setLog(logs.logs);
  };

  useEffect(() => {
    handleLog();
  }, []);

  return <span className='whitespace-pre-wrap'>{log}</span>;
}
