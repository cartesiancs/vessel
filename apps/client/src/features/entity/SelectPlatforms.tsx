import { SelectItem } from "@/components/ui/select";

export function EntitySelectPlatforms() {
  return (
    <>
      <SelectItem value='MQTT'>MQTT</SelectItem>
      <SelectItem value='UDP'>RTP over UDP</SelectItem>
      <SelectItem value='RTSP'>RTSP</SelectItem>
    </>
  );
}
