import React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { StepComponentProps } from "./types";

export const HA_Step1_URL: React.FC<StepComponentProps> = ({
  value,
  onChange,
}) => (
  <div className='grid gap-4 py-4'>
    <div className='grid grid-cols-4 items-center gap-4'>
      <Label htmlFor='ha-url' className='text-right'>
        HA URL
      </Label>
      <Input
        id='ha-url'
        placeholder='http://homeassistant.local:8123'
        className='col-span-3'
        value={value}
        onChange={onChange}
      />
    </div>
    <p className='text-sm text-muted-foreground px-4 text-center'>
      Enter the network address of your Home Assistant instance.
    </p>
  </div>
);

export const HA_Step2_Token: React.FC<StepComponentProps> = ({
  value,
  onChange,
}) => (
  <div className='grid gap-4 py-4'>
    <div className='grid grid-cols-4 items-center gap-4'>
      <Label htmlFor='ha-token' className='text-right'>
        Access Token
      </Label>
      <Input
        id='ha-token'
        type='password'
        placeholder='Paste your Long-Lived Access Token'
        className='col-span-3'
        value={value}
        onChange={onChange}
      />
    </div>
    <p className='text-sm text-muted-foreground px-4 text-center'>
      Create and copy a Long-Lived Access Token from your HA profile page.
    </p>
  </div>
);
