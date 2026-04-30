import React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { StepComponentProps } from "./types";

export const SDR_Step1_Info: React.FC = () => (
  <div className='py-4 text-center'>
    <h4 className='font-semibold'>RTL-SDR (rtl_tcp)</h4>
    <p className='text-sm text-muted-foreground mt-2'>
      Ensure that rtl_tcp is running and accessible on the network.
      <br />
      The server typically listens on port 1234.
    </p>
    <code className='text-xs bg-muted p-2 rounded-md block mt-2'>
      rtl_tcp -a 0.0.0.0
    </code>
  </div>
);

export const SDR_Step2_Host: React.FC<StepComponentProps> = ({
  value,
  onChange,
}) => (
  <div className='grid gap-4 py-4'>
    <div className='grid grid-cols-4 items-center gap-4'>
      <Label htmlFor='sdr-host' className='text-right'>
        Host
      </Label>
      <Input
        id='sdr-host'
        placeholder='192.168.1.100'
        className='col-span-3'
        value={value}
        onChange={onChange}
      />
    </div>
    <p className='text-sm text-muted-foreground px-4 text-center'>
      Enter the hostname or IP address of the rtl_tcp server.
    </p>
  </div>
);

export const SDR_Step3_Port: React.FC<StepComponentProps> = ({
  value,
  onChange,
}) => (
  <div className='grid gap-4 py-4'>
    <div className='grid grid-cols-4 items-center gap-4'>
      <Label htmlFor='sdr-port' className='text-right'>
        Port
      </Label>
      <Input
        id='sdr-port'
        placeholder='1234'
        className='col-span-3'
        value={value}
        onChange={onChange}
      />
    </div>
    <p className='text-sm text-muted-foreground px-4 text-center'>
      Enter the TCP port of the rtl_tcp server (default: 1234).
    </p>
  </div>
);
