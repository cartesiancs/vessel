import { Link } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";

export function Ros2Dashboard() {
  return (
    <div className='flex flex-1 flex-col gap-4'>
      <Card>
        <CardHeader>
          <CardTitle>ROS2</CardTitle>
          <CardDescription>
            rosbridge WebSocket is connected. Use the flow editor to wire ROS2 events and
            commands, or adjust the bridge URL in integrations.
          </CardDescription>
        </CardHeader>
        <CardContent className='flex flex-wrap gap-2'>
          <Button asChild variant='default'>
            <Link to='/flow'>Open flow</Link>
          </Button>
          <Button asChild variant='outline'>
            <Link to='/settings/integration'>Integrations</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
