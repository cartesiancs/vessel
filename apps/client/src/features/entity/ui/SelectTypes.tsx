import { SelectItem } from "@/components/ui/select";
import { Baseline, Database, Locate, Play } from "lucide-react";

export function EntitySelectTypes() {
  return (
    <>
      <SelectItem value='NONE'>
        <Database /> NONE
      </SelectItem>
      <SelectItem value='AUDIO'>
        <Play /> AUDIO
      </SelectItem>
      <SelectItem value='GPS'>
        <Locate /> GPS
      </SelectItem>
      <SelectItem value='TEXT'>
        <Baseline /> TEXT
      </SelectItem>
      <SelectItem value='VIDEO'>
        <Play /> VIDEO
      </SelectItem>
    </>
  );
}
