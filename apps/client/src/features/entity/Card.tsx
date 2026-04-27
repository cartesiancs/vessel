import { useState } from "react";
import { EntityAll } from "@/entities/entity/types";
import {
  Card,
  CardHeader,
  CardDescription,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical } from "lucide-react";
import { formatSimpleDateTime } from "@/lib/time";
import { StreamReceiver } from "../rtc/StreamReceiver";
import { RecordingMenuItem } from "../recording/RecordingButton";
import { AnalyzeMenuItem } from "./AnalyzeMenuItem";
import { StateHistorySheet } from "./StateHistorySheet";
import { useNavigate } from "react-router";

type StreamState = {
  topic: string;
  is_online: boolean;
};

const isEnabledStream = (topic: string, streams?: StreamState[]) => {
  if (!streams) {
    return false;
  }

  const index = streams.findIndex((item) => item.topic == topic);
  if (index == -1) {
    return false;
  }

  return streams[index].is_online;
};

export function EntityCard({
  item,
  streamsState,
}: {
  item: EntityAll;
  streamsState?: StreamState[];
}) {
  const navigate = useNavigate();

  if (item.platform === "sdr") {
    return (
      <Card key={item.id}>
        <CardHeader className='px-4'>
          <CardDescription>{item.friendly_name}</CardDescription>
          <CardTitle className='text-2xl font-semibold tabular-nums'>
            RTL-SDR
          </CardTitle>
        </CardHeader>
        <CardFooter className='flex-row items-center justify-between px-4 text-sm'>
          <Button
            size='sm'
            variant='outline'
            className='w-full'
            onClick={() => navigate("/dashboard?view=sdr")}
          >
            Open Panel
          </Button>
        </CardFooter>
      </Card>
    );
  }
  if (
    item.platform == "UDP" &&
    item.configuration &&
    item.entity_type == "AUDIO"
  ) {
    return (
      <Card key={item.id}>
        <CardHeader className='px-4'>
          <CardDescription>{item.friendly_name}</CardDescription>
          <CardTitle className='text-2xl font-semibold tabular-nums'>
            {item.configuration && (
              <StreamReceiver
                topic={item.configuration.state_topic as string}
                streamType='audio'
              />
            )}
          </CardTitle>
        </CardHeader>
        <CardFooter className='flex-row items-center justify-between px-4 text-sm'>
          <div className='flex flex-col gap-1'>
            <div className='font-medium'>{item.platform}</div>
            <div className='text-muted-foreground'>
              {isEnabledStream(
                item.configuration.state_topic as string,
                streamsState,
              ) ? (
                <Online />
              ) : (
                <Offline />
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' size='icon' className='h-8 w-8'>
                <MoreVertical className='h-4 w-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <RecordingMenuItem
                topic={item.configuration.state_topic as string}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </CardFooter>
      </Card>
    );
  }

  if (
    item.platform == "RTSP" &&
    item.configuration &&
    item.entity_type == "VIDEO"
  ) {
    return (
      <Card key={item.id}>
        <CardHeader className='px-4'>
          <CardDescription>{item.friendly_name}</CardDescription>
          <CardTitle className='text-2xl font-semibold tabular-nums'>
            {item.configuration && (
              <StreamReceiver
                topic={item.configuration.rtsp_url as string}
                streamType='video'
              />
            )}
          </CardTitle>
        </CardHeader>
        <CardFooter className='flex-row items-center justify-between px-4 text-sm'>
          <div className='flex flex-col gap-1'>
            <div className='font-medium'>{item.platform}</div>
            <div className='text-muted-foreground'>
              {isEnabledStream(
                item.configuration.rtsp_url as string,
                streamsState,
              ) ? (
                <Online />
              ) : (
                <Offline />
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' size='icon' className='h-8 w-8'>
                <MoreVertical className='h-4 w-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <RecordingMenuItem
                topic={item.configuration.rtsp_url as string}
              />
              <AnalyzeMenuItem topic={item.configuration.rtsp_url as string} />
            </DropdownMenuContent>
          </DropdownMenu>
        </CardFooter>
      </Card>
    );
  }

  if (
    item.platform == "UDP" &&
    item.configuration &&
    item.entity_type == "VIDEO"
  ) {
    return (
      <Card key={item.id}>
        <CardHeader className='px-4'>
          <CardDescription>{item.friendly_name}</CardDescription>
          <CardTitle className='text-2xl font-semibold tabular-nums'>
            {item.configuration && (
              <StreamReceiver
                topic={item.configuration.state_topic as string}
                streamType='video'
              />
            )}
          </CardTitle>
        </CardHeader>
        <CardFooter className='flex-row items-center justify-between px-4 text-sm'>
          <div className='flex flex-col gap-1'>
            <div className='font-medium'>{item.platform}</div>
            <div className='text-muted-foreground'>
              {isEnabledStream(
                item.configuration.state_topic as string,
                streamsState,
              ) ? (
                <Online />
              ) : (
                <Offline />
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' size='icon' className='h-8 w-8'>
                <MoreVertical className='h-4 w-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <RecordingMenuItem
                topic={item.configuration.state_topic as string}
              />
              <AnalyzeMenuItem
                topic={item.configuration.state_topic as string}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </CardFooter>
      </Card>
    );
  }

  return <DefaultEntityCard item={item} />;
}

function DefaultEntityCard({ item }: { item: EntityAll }) {
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <>
      <Card key={item.id}>
        <CardHeader className='px-4'>
          <CardDescription>{item.friendly_name}</CardDescription>
          <button
            type='button'
            onClick={() => setHistoryOpen(true)}
            className='block w-full min-w-0 max-w-full text-left cursor-pointer hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded'
          >
            <CardTitle className='text-2xl font-semibold font-mono tabular-nums truncate'>
              {item.state?.state || "N/A"}
            </CardTitle>
          </button>
        </CardHeader>
        <CardFooter className='flex-col items-start gap-1 px-4 text-sm'>
          <div className='font-medium'>{item.platform}</div>
          <div className='text-muted-foreground'>
            {formatSimpleDateTime(item.state?.last_updated || "")}
          </div>
        </CardFooter>
      </Card>
      <StateHistorySheet
        entityId={item.entity_id}
        entityName={item.friendly_name}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
    </>
  );
}

function Dot({ color }: { color: string }) {
  return <span className={`w-2 h-2 ${color} rounded`}></span>;
}

function Offline() {
  return (
    <span className='flex flex-row text-gray-600 justify-center items-center gap-1'>
      <Dot color='bg-gray-600' /> Offline
    </span>
  );
}

function Online() {
  return (
    <span className='flex flex-row text-emerald-500 justify-center items-center gap-1 '>
      <Dot color='bg-emerald-500' /> Online
    </span>
  );
}
