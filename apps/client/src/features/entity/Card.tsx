import { EntityAll } from "@/entities/entity/types";
import {
  Card,
  CardHeader,
  CardDescription,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { formatSimpleDateTime } from "@/lib/time";
import { StreamReceiver } from "../rtc/StreamReceiver";

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
  if (
    item.platform == "UDP" &&
    item.configuration &&
    item.entity_type == "AUDIO"
  ) {
    return (
      <Card key={item.id}>
        <CardHeader className='px-4'>
          <CardDescription>Entity : {item.friendly_name}</CardDescription>
          <CardTitle className='text-2xl font-semibold tabular-nums'>
            {item.configuration && (
              <StreamReceiver
                topic={item.configuration.state_topic as string}
                streamType='audio'
              />
            )}
          </CardTitle>
        </CardHeader>
        <CardFooter className='flex-col items-start gap-1 px-4 text-sm'>
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
          <CardDescription>Entity : {item.friendly_name}</CardDescription>
          <CardTitle className='text-2xl font-semibold tabular-nums'>
            {item.configuration && (
              <StreamReceiver
                topic={item.configuration.rtsp_url as string}
                streamType='video'
              />
            )}
          </CardTitle>
        </CardHeader>
        <CardFooter className='flex-col items-start gap-1 px-4 text-sm'>
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
          <CardDescription>Entity : {item.friendly_name}</CardDescription>
          <CardTitle className='text-2xl font-semibold tabular-nums'>
            {item.configuration && (
              <StreamReceiver
                topic={item.configuration.state_topic as string}
                streamType='video'
              />
            )}
          </CardTitle>
        </CardHeader>
        <CardFooter className='flex-col items-start gap-1 px-4 text-sm'>
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
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card key={item.id}>
      <CardHeader className='px-4'>
        <CardDescription>Entity : {item.friendly_name}</CardDescription>
        <CardTitle className='text-2xl font-semibold tabular-nums truncate'>
          {item.state?.state || "N/A"}
        </CardTitle>
      </CardHeader>
      <CardFooter className='flex-col items-start gap-1 px-4 text-sm'>
        <div className='font-medium'>{item.platform}</div>
        <div className='text-muted-foreground'>
          {formatSimpleDateTime(item.state?.last_updated || "")}
        </div>
      </CardFooter>
    </Card>
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
