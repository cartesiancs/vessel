import { useState, useEffect, useCallback } from "react";
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

const getDefaultValueForType = (type: string) => {
  switch (type.toUpperCase()) {
    case "NUMBER":
      return "0";
    case "BOOLEAN":
      return "false";
    case "JSON":
      return "{}";
    case "STRING":
    default:
      return "";
  }
};

export function Options({ open, selectedNode, setOpen }: OptionsProps) {
  const { updateNode, addRefresh } = useFlowStore();

  const [formData, setFormData] = useState<DataNodeType | object>({});
  const [formTypeData, setFormTypeData] = useState<DataNodeTypeType>({});

  const resolveDynamicTypes = useCallback(
    (
      currentData: DataNodeType | object,
      baseDataType: DataNodeTypeType | undefined,
    ) => {
      if (!baseDataType) return {};

      const resolved: DataNodeTypeType = {};
      const dependsOnRegex = /^DEPENDS_ON\[(.*?):(.*?)\]$/;

      for (const key in baseDataType) {
        const typeDef = baseDataType[key] as string;
        const match = typeDef.match(dependsOnRegex);

        if (match) {
          const controllerField = match[1];
          const mappingsString = match[2];
          const controllingValue =
            currentData[controllerField as keyof typeof currentData];

          const mapping = new Map(
            mappingsString.split(",").map((part) => {
              const [val, type] = part.split(">");
              return [val, type];
            }),
          );

          resolved[key] = mapping.get(controllingValue as string) || "ANY";
        } else {
          resolved[key] = typeDef;
        }
      }
      return resolved;
    },
    [],
  );

  useEffect(() => {
    if (selectedNode?.data && selectedNode?.dataType) {
      setFormData(selectedNode.data);
      const initialResolvedTypes = resolveDynamicTypes(
        selectedNode.data,
        selectedNode.dataType,
      );
      setFormTypeData(initialResolvedTypes);
    } else {
      setFormData({});
      setFormTypeData({});
    }
  }, [selectedNode, resolveDynamicTypes]);

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

    const updatedFormData = { ...formData, [key]: processedValue };
    setFormData(updatedFormData);

    const newResolvedTypes = resolveDynamicTypes(
      updatedFormData,
      selectedNode?.dataType,
    );
    setFormTypeData(newResolvedTypes);

    const dataToReset: Record<string, string | number> = {};
    for (const field in newResolvedTypes) {
      if (formTypeData[field] !== newResolvedTypes[field]) {
        dataToReset[field] = getDefaultValueForType(newResolvedTypes[field]);
      }
    }

    if (Object.keys(dataToReset).length > 0) {
      setFormData((prev) => ({
        ...prev,
        ...dataToReset,
      }));
    }
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
      const match = formTypeData[key]?.match(selectRegex);

      if (match && match[1]) {
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
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </>
              </SelectContent>
            </Select>
          </div>
        );
      }

      switch (formTypeData[key]) {
        case "NUMBER":
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
        case "STRING":
        case "ANY":
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
        case "JSON":
          return (
            <div key={inputId} className='grid grid-cols-4 items-center gap-4'>
              <Label htmlFor={inputId} className='text-right'>
                {key}
              </Label>
              <textarea
                id={inputId}
                value={String(value)}
                onChange={(e) => handleInputChange(key, e.target.value)}
                className='col-span-3 p-2 border rounded-md h-24 font-mono'
                rows={4}
              />
            </div>
          );
        case "BOOLEAN":
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
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className='z-[9999]'>
                  <SelectItem value='true'>true</SelectItem>
                  <SelectItem value='false'>false</SelectItem>
                </SelectContent>
              </Select>
            </div>
          );
        case "FIXED_STRING":
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
        default:
          return null;
      }
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
