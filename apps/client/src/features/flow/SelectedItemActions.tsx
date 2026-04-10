import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

type SelectedElement = {
  type: "node" | "edge";
  id: string;
} | null;

type Props = {
  selectedElement: SelectedElement;
  onDeleteNode: () => void;
};

// Floating action bar anchored at the top; avoids overlap with nodes.
export function SelectedItemActions({ selectedElement, onDeleteNode }: Props) {
  if (!selectedElement || selectedElement.type !== "node") {
    return null;
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        left: "12px",
        display: "flex",
        gap: 8,
        zIndex: 10,
      }}
    >
      <Button
        size={"sm"}
        variant={"outline"}
        onClick={onDeleteNode}
        style={{ display: "flex", alignItems: "center", gap: 6 }}
      >
        <Trash2 size={14} />
      </Button>
    </div>
  );
}
