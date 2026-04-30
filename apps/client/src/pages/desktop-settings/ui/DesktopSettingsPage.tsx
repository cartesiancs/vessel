import React, { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { storage } from "@/lib/storage";
import {
  getServerAddress,
  type ServerAddress,
  updateServerAddress,
} from "@/shared/desktop";

const HOST_PRESETS = [
  { value: "0.0.0.0", label: "0.0.0.0  (LAN / external access)" },
  { value: "127.0.0.1", label: "127.0.0.1  (this machine only)" },
  { value: "__custom__", label: "Custom host\u2026" },
];

const isValidHost = (value: string): boolean => {
  if (!value) return false;
  if (value === "0.0.0.0" || value === "127.0.0.1" || value === "localhost") {
    return true;
  }
  const ipv4 =
    /^(25[0-5]|2[0-4]\d|[01]?\d?\d)(\.(25[0-5]|2[0-4]\d|[01]?\d?\d)){3}$/;
  if (ipv4.test(value)) return true;
  const hostname =
    /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;
  return hostname.test(value);
};

const closeSelf = async () => {
  try {
    const mod = await import("@tauri-apps/api/window");
    const win = mod.getCurrentWindow();
    await win.close();
  } catch (err) {
    console.warn("Unable to close settings window via @tauri-apps/api", err);
    try {
      window.close();
    } catch {
      // ignore
    }
  }
};

export function DesktopSettingsPage(): React.ReactElement {
  const [hostMode, setHostMode] = useState<string>("0.0.0.0");
  const [host, setHost] = useState<string>("0.0.0.0");
  const [port, setPort] = useState<string>("6174");
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const current = await getServerAddress();
      if (cancelled) return;
      if (current) {
        applyAddress(current);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyAddress = (addr: ServerAddress) => {
    const preset = HOST_PRESETS.find(
      (p) => p.value !== "__custom__" && p.value === addr.host,
    );
    setHost(addr.host);
    setPort(String(addr.port));
    setHostMode(preset ? preset.value : "__custom__");
  };

  const portNumber = useMemo(() => Number.parseInt(port, 10), [port]);
  const hostValid = isValidHost(host.trim());
  const portValid =
    Number.isFinite(portNumber) && portNumber >= 1 && portNumber <= 65535;
  const canSave = hostValid && portValid && !saving && !loading;
  const lowPortWarning = portValid && portNumber < 1024;
  const externalWarning =
    hostValid && host.trim() !== "127.0.0.1" && host.trim() !== "localhost";

  const handleHostModeChange = (value: string) => {
    setHostMode(value);
    if (value !== "__custom__") {
      setHost(value);
    }
  };

  const handleSave = async () => {
    setError(null);
    if (!hostValid) {
      setError("Invalid host. Use an IPv4 address or hostname.");
      return;
    }
    if (!portValid) {
      setError("Port must be an integer between 1 and 65535.");
      return;
    }

    setSaving(true);
    try {
      const status = await updateServerAddress(host.trim(), portNumber);
      if (status?.base_url) {
        storage.setServerUrl(status.base_url);
      }
      await closeSelf();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className='min-h-screen bg-background text-foreground'>
      <div className='flex flex-col gap-5 p-6'>
        <div>
          <h1 className='text-lg font-semibold'>Server Address</h1>
        </div>

        <div className='grid gap-4'>
          <div className='grid gap-2'>
            <Label htmlFor='host-preset'>Host</Label>
            <Select value={hostMode} onValueChange={handleHostModeChange}>
              <SelectTrigger id='host-preset' className='w-full'>
                <SelectValue placeholder='Select host' />
              </SelectTrigger>
              <SelectContent>
                {HOST_PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hostMode === "__custom__" && (
              <Input
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder='e.g. 192.168.1.10'
                aria-invalid={!hostValid}
                spellCheck={false}
              />
            )}
          </div>

          <div className='grid gap-2'>
            <Label htmlFor='port'>Port</Label>
            <Input
              id='port'
              type='number'
              min={1}
              max={65535}
              value={port}
              onChange={(e) => setPort(e.target.value)}
              aria-invalid={!portValid}
            />
          </div>
        </div>

        {(externalWarning || lowPortWarning) && (
          <div className='space-y-1 rounded-md border border-yellow-700/50 bg-yellow-900/20 p-3 text-xs text-yellow-200'>
            {externalWarning && (
              <p>
                Binding to <code>{host}</code> exposes the server beyond this
                machine. Make sure your firewall is configured.
              </p>
            )}
            {lowPortWarning && (
              <p>
                Ports below 1024 are privileged and may require additional
                permissions.
              </p>
            )}
          </div>
        )}

        {error && (
          <div className='rounded-md border border-red-700/60 bg-red-900/20 p-3 text-xs text-red-200'>
            {error}
          </div>
        )}

        <div className='flex justify-end gap-2'>
          <Button
            variant='ghost'
            onClick={() => void closeSelf()}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={!canSave}>
            {saving ? "Restarting\u2026" : "Save & Restart"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default DesktopSettingsPage;
