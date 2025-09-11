import { useState, useEffect } from "react";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DataNodeType, DataNodeTypeType, Node } from "./flowTypes";
import { useFlowStore } from "@/entities/flow/store";

interface OptionsProps {
  open: boolean;
  selectedNode: Node | null;
  setOpen: (open: boolean) => void;
}

export function Options({ open, selectedNode, setOpen }: OptionsProps) {
  const { updateNode, addRefresh } = useFlowStore();

  const [formData, setFormData] = useState<DataNodeType | object>({});
  const [formTypeData, setFormTypeData] = useState<DataNodeTypeType>({});

  useEffect(() => {
    if (selectedNode?.data) {
      setFormData(selectedNode.data);
    } else {
      setFormData({});
    }

    if (selectedNode?.dataType) {
      setFormTypeData(selectedNode.dataType);
    }
  }, [selectedNode]);

  const handleInputChange = (key: string, value: string | number) => {
    const originalValue =
      selectedNode?.data?.[key as keyof typeof selectedNode.data];
    let processedValue: string | number = value;

    if (typeof originalValue === "number") {
      processedValue = parseFloat(value as string);
      if (isNaN(processedValue)) {
        processedValue = 0;
      }
    }
    setFormData((prev) => ({ ...prev, [key]: processedValue }));
  };

  const handleSubmit = () => {
    if (selectedNode) {
      updateNode(selectedNode.id, formData as DataNodeType);
      setOpen(false);
      addRefresh();
    }
  };

  const renderFormFields = () => {
    if (!selectedNode || !Object.keys(formData).length) {
      return (
        <p className='text-sm text-muted-foreground'>
          This node has no editable properties.
        </p>
      );
    }

    return Object.entries(formData).map(([key, value]) => {
      const inputId = `${selectedNode.id}-${key}`;
      const ifExist = key in formTypeData;

      if (!ifExist) {
        return null;
      }

      const selectRegex = /^SELECT\[(.*)\]$/;
      const match = formTypeData[key].match(selectRegex);

      if (match && match[1]) {
        console.log(match[1].split(","));
        return (
          <div key={inputId} className='grid grid-cols-4 items-center gap-4'>
            <Label htmlFor={inputId} className='text-right'>
              {key}
            </Label>
            <Select
              value={String(value)}
              onValueChange={(val) => handleInputChange(key, val)}
            >
              <SelectTrigger id={inputId} className='col-span-3'>
                <SelectValue placeholder={`Select ${key}`} />
              </SelectTrigger>
              <SelectContent className='z-[9999]'>
                <>
                  {match[1].split(",").map((item) => (
                    <SelectItem value={item}>{item}</SelectItem>
                  ))}
                </>
              </SelectContent>
            </Select>
          </div>
        );
      }

      if (formTypeData[key] == "NUMBER") {
        return (
          <div key={inputId} className='grid grid-cols-4 items-center gap-4'>
            <Label htmlFor={inputId} className='text-right'>
              {key}
            </Label>
            <Input
              id={inputId}
              type='number'
              value={String(value)}
              onChange={(e) => handleInputChange(key, e.target.value)}
              className='col-span-3'
            />
          </div>
        );
      }

      if (formTypeData[key] == "STRING") {
        return (
          <div key={inputId} className='grid grid-cols-4 items-center gap-4'>
            <Label htmlFor={inputId} className='text-right'>
              {key}
            </Label>
            <Input
              id={inputId}
              value={String(value)}
              onChange={(e) => handleInputChange(key, e.target.value)}
              className='col-span-3'
            />
          </div>
        );
      }

      if (formTypeData[key] == "ANY") {
        return (
          <div key={inputId} className='grid grid-cols-4 items-center gap-4'>
            <Label htmlFor={inputId} className='text-right'>
              {key}
            </Label>
            <Input
              id={inputId}
              value={String(value)}
              onChange={(e) => handleInputChange(key, e.target.value)}
              className='col-span-3'
            />
          </div>
        );
      }

      if (formTypeData[key] == "FIXED_STRING") {
        return (
          <div key={inputId} className='grid grid-cols-4 items-center gap-4'>
            <Label htmlFor={inputId} className='text-right'>
              {key}
            </Label>
            <Input
              id={inputId}
              value={String(value)}
              onChange={(e) => handleInputChange(key, e.target.value)}
              className='col-span-3'
              disabled={true}
            />
          </div>
        );
      }

      return null;
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit: {selectedNode?.title || "Node"}</SheetTitle>
          <SheetDescription>
            Modify the properties of the selected node here.
          </SheetDescription>
        </SheetHeader>
        <div className='grid gap-4 p-4'>{renderFormFields()}</div>
        <SheetFooter>
          <Button onClick={handleSubmit}>Save Changes</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
