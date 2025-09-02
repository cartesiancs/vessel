import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HaState } from "@/entities/ha/types";
import { Lightbulb, Power, Router, Thermometer } from "lucide-react";
import React, { useMemo } from "react";

interface HaStatBlockProps {
  states: HaState[];
}

const StatCard = ({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
}) => (
  <Card>
    <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
      <CardTitle className='text-sm font-medium'>{title}</CardTitle>
      <Icon className='h-4 w-4 text-muted-foreground' />
    </CardHeader>
    <CardContent>
      <div className='text-2xl font-bold'>{value}</div>
    </CardContent>
  </Card>
);

export const HaStatBlock: React.FC<HaStatBlockProps> = ({ states }) => {
  const stats = useMemo(() => {
    const totalEntities = states.length;
    const lightsOn = states.filter(
      (s) => s.entity_id.startsWith("light.") && s.state === "on",
    ).length;
    const switchesOn = states.filter(
      (s) => s.entity_id.startsWith("switch.") && s.state === "on",
    ).length;
    const availableSensors = states.filter(
      (s) => s.entity_id.startsWith("sensor.") && s.state !== "unavailable",
    ).length;

    return { totalEntities, lightsOn, switchesOn, availableSensors };
  }, [states]);

  return (
    <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4'>
      <StatCard
        title='Total Entities'
        value={stats.totalEntities}
        icon={Router}
      />
      <StatCard title='Lights On' value={stats.lightsOn} icon={Lightbulb} />
      <StatCard title='Switches On' value={stats.switchesOn} icon={Power} />
      <StatCard
        title='Available Sensors'
        value={stats.availableSensors}
        icon={Thermometer}
      />
    </div>
  );
};
