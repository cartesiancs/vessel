import React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { StepComponentProps } from "./types";

export const ROS2_Step1_Bridge: React.FC = () => (
  <div className='py-4 text-center'>
    <h4 className='font-semibold'>ROS2 Bridge Server</h4>
    <p className='text-sm text-muted-foreground mt-2'>
      Ensure that the `rosbridge_server` is running on your ROS2 machine.
      <br />
      Example command:
    </p>
    <code className='text-xs bg-muted p-2 rounded-md block mt-2'>
      ros2 launch rosbridge_server rosbridge_websocket_launch.xml
    </code>
  </div>
);

export const ROS2_Step2_Address: React.FC<StepComponentProps> = ({
  value,
  onChange,
}) => (
  <div className='grid gap-4 py-4'>
    <div className='grid grid-cols-4 items-center gap-4'>
      <Label htmlFor='ros-address' className='text-right'>
        WebSocket URL
      </Label>
      <Input
        id='ros-address'
        placeholder='ws://<your_ros_ip>:9090'
        className='col-span-3'
        value={value}
        onChange={onChange}
      />
    </div>
    <p className='text-sm text-muted-foreground px-4 text-center'>
      Enter the WebSocket address of your rosbridge server.
    </p>
  </div>
);
