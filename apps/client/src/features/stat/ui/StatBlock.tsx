import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useStatStore } from "@/entities/stat/store";
import { useEffect } from "react";

export default function StatBlock() {
  const { stat, fetchStat } = useStatStore();

  useEffect(() => {
    fetchStat();
  }, [fetchStat]);

  return (
    <>
      <Card className='@container/card'>
        <CardHeader>
          <CardDescription>Devices</CardDescription>
          <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
            {stat.count.devices}
          </CardTitle>
        </CardHeader>
        <CardFooter className='flex-col items-start gap-1.5 text-sm'>
          <div className='line-clamp-1 flex gap-2 font-medium'>Active</div>
          <div className='text-muted-foreground'>
            Total devices in the system
          </div>
        </CardFooter>
      </Card>
      <Card className='@container/card'>
        <CardHeader>
          <CardDescription>Entities</CardDescription>
          <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
            {stat.count.entities}
          </CardTitle>
        </CardHeader>
        <CardFooter className='flex-col items-start gap-1.5 text-sm'>
          <div className='line-clamp-1 flex gap-2 font-medium'>Active</div>
          <div className='text-muted-foreground'>
            Total entities across all devices
          </div>
        </CardFooter>
      </Card>
    </>
  );
}
