import { useEffect, useMemo, useRef, useState } from "react";
import { scaleTime } from "d3-scale";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/sheet";
import { ScrollArea } from "@/shared/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import { Skeleton } from "@/shared/ui/skeleton";
import { formatSimpleDateTime } from "@/shared/lib/time";
import * as api from "@/entities/entity";
import type { State } from "@/entities/entity";

type Props = {
  entityId: string;
  entityName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const STRIP_WIDTH = 360;
const STRIP_HEIGHT = 80;
const STRIP_PADDING_X = 16;
const AXIS_Y = STRIP_HEIGHT - 24;

export function StateHistorySheet({
  entityId,
  entityName,
  open,
  onOpenChange,
}: Props) {
  const [history, setHistory] = useState<State[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());
  const requestId = useRef(0);

  useEffect(() => {
    if (!open) {
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    setNow(new Date());

    api
      .getEntityHistory(entityId)
      .then((res) => {
        if (id !== requestId.current) return;
        setHistory(res.data);
        setLoading(false);
      })
      .catch((err) => {
        if (id !== requestId.current) return;
        console.error("Failed to fetch entity history:", err);
        setError("Failed to load history.");
        setLoading(false);
      });
  }, [open, entityId]);

  const sortedAsc = useMemo(() => {
    if (!history) return [];
    return [...history].sort(
      (a, b) =>
        new Date(a.last_updated).getTime() -
        new Date(b.last_updated).getTime(),
    );
  }, [history]);

  const sortedDesc = useMemo(() => [...sortedAsc].reverse(), [sortedAsc]);

  const firstRecord = sortedAsc[0];
  const lastRecord = sortedAsc[sortedAsc.length - 1];

  const xScale = useMemo(() => {
    if (!firstRecord) return null;
    const start = new Date(firstRecord.last_updated);
    const end = now > new Date(lastRecord.last_updated) ? now : new Date(lastRecord.last_updated);
    return scaleTime()
      .domain([start, end])
      .range([STRIP_PADDING_X, STRIP_WIDTH - STRIP_PADDING_X]);
  }, [firstRecord, lastRecord, now]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side='right' className='w-full sm:max-w-md flex flex-col'>
        <SheetHeader>
          <SheetTitle className='truncate'>{entityName || entityId}</SheetTitle>
          <SheetDescription className='truncate'>
            <span className='font-mono text-xs'>{entityId}</span>
          </SheetDescription>
        </SheetHeader>

        <div className='flex flex-col gap-4 px-4 pb-4 flex-1 min-h-0'>
          {loading && (
            <div className='flex flex-col gap-2'>
              <Skeleton className='h-20 w-full' />
              <Skeleton className='h-6 w-full' />
              <Skeleton className='h-6 w-full' />
              <Skeleton className='h-6 w-full' />
            </div>
          )}

          {!loading && error && (
            <div className='text-sm text-destructive'>{error}</div>
          )}

          {!loading && !error && sortedAsc.length === 0 && (
            <div className='text-sm text-muted-foreground'>
              No state history recorded yet.
            </div>
          )}

          {!loading && !error && sortedAsc.length > 0 && xScale && (
            <>
              <div className='grid grid-cols-3 gap-2 text-xs'>
                <SummaryCell
                  label='First'
                  value={formatSimpleDateTime(firstRecord!.last_updated)}
                />
                <SummaryCell
                  label='Last'
                  value={formatSimpleDateTime(lastRecord!.last_updated)}
                />
                <SummaryCell
                  label='Changes'
                  value={`${sortedAsc.length}`}
                />
              </div>

              <TooltipProvider delayDuration={100}>
                <svg
                  width='100%'
                  viewBox={`0 0 ${STRIP_WIDTH} ${STRIP_HEIGHT}`}
                  className='border rounded bg-muted/30'
                >
                  <line
                    x1={STRIP_PADDING_X}
                    x2={STRIP_WIDTH - STRIP_PADDING_X}
                    y1={AXIS_Y}
                    y2={AXIS_Y}
                    className='stroke-muted-foreground/40'
                    strokeWidth={1}
                  />
                  <text
                    x={STRIP_PADDING_X}
                    y={AXIS_Y + 16}
                    className='fill-muted-foreground'
                    fontSize={10}
                  >
                    first
                  </text>
                  <text
                    x={STRIP_WIDTH - STRIP_PADDING_X}
                    y={AXIS_Y + 16}
                    textAnchor='end'
                    className='fill-muted-foreground'
                    fontSize={10}
                  >
                    now
                  </text>
                  {sortedAsc.map((record) => {
                    const cx = xScale(new Date(record.last_updated));
                    return (
                      <Tooltip key={record.state_id}>
                        <TooltipTrigger asChild>
                          <circle
                            cx={cx}
                            cy={AXIS_Y}
                            r={4}
                            className='fill-primary cursor-pointer hover:r-6'
                          />
                        </TooltipTrigger>
                        <TooltipContent side='top' className='z-1000'>
                          <div className='text-xs'>
                            <div className='font-mono'>
                              {formatSimpleDateTime(record.last_updated)}
                            </div>
                            <div className='font-semibold'>
                              {record.state ?? "—"}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                  {(() => {
                    const lastX = xScale(new Date(lastRecord!.last_updated));
                    const nowX = xScale(now);
                    if (nowX > lastX + 6) {
                      return (
                        <circle
                          cx={nowX}
                          cy={AXIS_Y}
                          r={3}
                          className='fill-muted-foreground/60'
                        />
                      );
                    }
                    return null;
                  })()}
                </svg>
              </TooltipProvider>

              <ScrollArea className='flex-1 min-h-0 border rounded'>
                <ul className='divide-y'>
                  {sortedDesc.map((record) => (
                    <li
                      key={record.state_id}
                      className='flex items-center justify-between gap-3 px-3 py-2 text-sm'
                    >
                      <span className='text-muted-foreground font-mono text-xs whitespace-nowrap'>
                        {formatSimpleDateTime(record.last_updated)}
                      </span>
                      <span className='font-mono font-medium truncate text-right'>
                        {record.state ?? "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex flex-col gap-0.5 rounded border px-2 py-1.5'>
      <span className='text-[10px] uppercase tracking-wide text-muted-foreground'>
        {label}
      </span>
      <span className='font-mono text-xs truncate'>{value}</span>
    </div>
  );
}
