import { Fragment, useEffect, useState } from "react";
import * as api from "../../entities/entity/api";
import { EntityAll } from "@/entities/entity/types";
import {
  Card,
  CardHeader,
  CardDescription,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { StreamReceiver } from "../rtc/video";
import { AudioStreamReceiver } from "../rtc/audio";

export function AllEntities() {
  const [entities, setEntities] = useState<EntityAll[]>([]);

  const getAllEntities = async () => {
    try {
      const response = await api.getAllEntities();
      setEntities(response.data);
    } catch (error) {
      console.error("Failed to fetch all entities:", error);
    }
  };

  useEffect(() => {
    getAllEntities();
  }, []);

  const getCard = (item: EntityAll) => {
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
                <AudioStreamReceiver
                  topic={item.configuration.state_topic as string}
                  streamType='audio'
                />
              )}
            </CardTitle>
          </CardHeader>
          <CardFooter className='flex-col items-start gap-1 px-4 text-sm'>
            <div className='font-medium'>{item.platform}</div>
            <div className='text-muted-foreground'>
              {item.state?.last_updated}
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
              {item.state?.last_updated}
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
            {item.state?.last_updated}
          </div>
        </CardFooter>
      </Card>
    );
  };

  return (
    <>
      <div className='grid grid-cols-1 gap-4 px-0 sm:grid-cols-2 lg:grid-cols-4 lg:px-6'>
        {entities.map((item) => (
          <Fragment key={item.id}>{getCard(item)}</Fragment>
        ))}
      </div>
    </>
  );
}
