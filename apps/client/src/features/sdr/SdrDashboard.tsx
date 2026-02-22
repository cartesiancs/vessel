import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Radio, Play, Square, Loader2 } from "lucide-react";
import { SdrAudioPlayer } from "./SdrAudioPlayer";
import * as sdrApi from "./api";

export function SdrDashboard() {
  const [frequencyMhz, setFrequencyMhz] = useState("100.0");
  const [samplerate, setSamplerate] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSettingFreq, setIsSettingFreq] = useState(false);
  const [streamInfo, setStreamInfo] = useState<{
    samplerate: number;
    audio_rate: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    sdrApi
      .getSamplerate()
      .then((res) => {
        if (res.data.samplerate) {
          setSamplerate(res.data.samplerate);
        }
      })
      .catch(() => {});
  }, []);

  const handleSetFrequency = async () => {
    const freqHz = parseFloat(frequencyMhz) * 1_000_000;
    if (isNaN(freqHz) || freqHz <= 0) {
      setError("Invalid frequency");
      return;
    }
    setIsSettingFreq(true);
    setError(null);
    try {
      await sdrApi.setFrequency(freqHz);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to set frequency",
      );
    } finally {
      setIsSettingFreq(false);
    }
  };

  const handleToggleAudio = () => {
    setError(null);
    setIsPlaying((prev) => !prev);
  };

  const handleInfo = useCallback(
    (info: { samplerate: number; audio_rate: number }) => {
      setStreamInfo(info);
      setSamplerate(info.samplerate);
    },
    [],
  );

  const handleError = useCallback((err: string) => {
    setError(err);
    setIsPlaying(false);
  }, []);

  const handleDisconnect = useCallback(() => {
    setIsPlaying(false);
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Frequency Control */}
        <Card>
          <CardHeader>
            <CardDescription>Tuner</CardDescription>
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-purple-500" />
              Frequency Control
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="frequency">Frequency (MHz)</Label>
              <div className="flex gap-2">
                <Input
                  id="frequency"
                  type="number"
                  step="0.001"
                  value={frequencyMhz}
                  onChange={(e) => setFrequencyMhz(e.target.value)}
                  placeholder="100.0"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSetFrequency();
                  }}
                />
                <Button
                  onClick={handleSetFrequency}
                  disabled={isSettingFreq}
                  className="shrink-0"
                >
                  {isSettingFreq ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Set"
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status */}
        <Card>
          <CardHeader>
            <CardDescription>RTL-SDR</CardDescription>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Sample Rate
              </span>
              <Badge variant="secondary">
                {samplerate
                  ? `${(samplerate / 1_000_000).toFixed(2)} MSps`
                  : "N/A"}
              </Badge>
            </div>
            {streamInfo && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Audio Rate
                </span>
                <Badge variant="secondary">
                  {streamInfo.audio_rate / 1000} kHz
                </Badge>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Stream</span>
              <Badge variant={isPlaying ? "default" : "outline"}>
                {isPlaying ? "Active" : "Stopped"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Audio Stream */}
      <Card>
        <CardHeader>
          <CardDescription>FM Audio</CardDescription>
          <CardTitle className="flex items-center justify-between">
            <span>Audio Stream</span>
            <Button
              size="sm"
              variant={isPlaying ? "destructive" : "default"}
              onClick={handleToggleAudio}
            >
              {isPlaying ? (
                <>
                  <Square className="h-4 w-4 mr-1" /> Stop
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-1" /> Start Audio
                </>
              )}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SdrAudioPlayer
            isPlaying={isPlaying}
            onInfo={handleInfo}
            onError={handleError}
            onDisconnect={handleDisconnect}
          />
          {error && (
            <p className="text-sm text-destructive mt-2">{error}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
