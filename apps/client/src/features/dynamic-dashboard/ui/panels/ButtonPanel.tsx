import { useEffect, useState } from "react";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import type { DashboardItemDataMap } from "@/entities/dynamic-dashboard";
import { isValidListenerId } from "@/entities/dynamic-dashboard";

type ButtonPanelProps = {
  data?: DashboardItemDataMap["button"];
  onDataChange?: (next: NonNullable<DashboardItemDataMap["button"]>) => void;
  disabled?: boolean;
};

export function ButtonPanel({
  data,
  onDataChange,
  disabled,
}: ButtonPanelProps) {
  const [listenerId, setListenerId] = useState(data?.listener_id ?? "");

  useEffect(() => {
    setListenerId(data?.listener_id ?? "");
  }, [data?.listener_id]);

  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      onDataChange?.({ ...data, listener_id: undefined });
      return;
    }
    if (!isValidListenerId(trimmed)) {
      return;
    }
    onDataChange?.({
      ...data,
      listener_id: trimmed,
    });
  };

  return (
    <div
      className='flex flex-col gap-2 rounded-md border border-dashed bg-muted/30 p-2 text-xs'
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className='grid gap-1'>
        <Label className='text-[10px] uppercase'>Listener id</Label>
        <Input
          className='h-8 font-mono text-xs'
          disabled={disabled}
          value={listenerId}
          placeholder='e.g. lights-toggle'
          onChange={(e) => setListenerId(e.target.value)}
          onBlur={() => commit(listenerId)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
      </div>
    </div>
  );
}
