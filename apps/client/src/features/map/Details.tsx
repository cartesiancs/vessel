import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { X, MapPin, TabletSmartphone, Server, Database } from "lucide-react";
import { useMapStore } from "./store";
import { useEffect, useState } from "react";
import { getDeviceById } from "@/entities/device/api";
import { Entity } from "@/entities/entity/types";

export function EntityDetailsPanel() {
  const { selectedEntity, setSelectedEntity } = useMapStore();
  const [device, setDevice] = useState({
    name: "",
  });
  const [entities, setEntities] = useState<Entity[]>([]);

  const handleClose = () => {
    setSelectedEntity(null);
  };

  const getDevice = async (device_id: number) => {
    const get = await getDeviceById(device_id);

    setDevice({
      name: get.data.name as string,
    });
    setEntities(get.data.entities);
  };

  useEffect(() => {
    if (selectedEntity) {
      getDevice(selectedEntity.device_id);
    }
  }, [selectedEntity]);

  return (
    <div
      className={`
        absolute top-[46px] right-0 h-[calc(100%-48px)] p-4 transition-transform duration-300 ease-in-out z-[999999]
        ${selectedEntity ? "translate-x-0" : "translate-x-full"}
      `}
      style={{ width: "400px" }}
    >
      {selectedEntity && (
        <Card className='h-full w-full'>
          <CardHeader>
            <div className='flex justify-between items-start'>
              <div>
                <CardTitle>
                  {selectedEntity.friendly_name || selectedEntity.entity_id}
                </CardTitle>
                <CardDescription>{selectedEntity.entity_id}</CardDescription>
              </div>
              <Button variant='ghost' size='icon' onClick={handleClose}>
                <X className='h-4 w-4' />
              </Button>
            </div>
          </CardHeader>
          <CardContent className='space-y-4 overflow-scroll'>
            <div>
              <h4 className='font-semibold text-sm mb-2'>State</h4>
              <div className='text-sm p-3 bg-muted rounded-md overflow-scroll'>
                <p>
                  <strong>State:</strong> {selectedEntity.state?.state || "N/A"}
                </p>
                <p className='text-xs text-muted-foreground'>
                  <strong>Last Updated:</strong>{" "}
                  {selectedEntity.state
                    ? new Date(
                        selectedEntity.state.last_updated,
                      ).toLocaleString()
                    : "N/A"}
                </p>
              </div>
            </div>

            <div>
              <h4 className='font-semibold text-sm mb-2'>Details</h4>
              <ul className='text-sm space-y-2'>
                <li className='flex items-center'>
                  <MapPin className='h-4 w-4 mr-2 text-muted-foreground' />
                  <strong>Type:</strong>{" "}
                  <span className='ml-2'>
                    {selectedEntity.entity_type || "N/A"}
                  </span>
                </li>
                <li className='flex items-center'>
                  <Server className='h-4 w-4 mr-2 text-muted-foreground' />
                  <strong>Platform:</strong>{" "}
                  <span className='ml-2'>
                    {selectedEntity.platform || "N/A"}
                  </span>
                </li>
                <li className='flex items-center'>
                  <TabletSmartphone className='h-4 w-4 mr-2 text-muted-foreground' />
                  <strong>Device ID:</strong>{" "}
                  <span className='ml-2'>
                    {selectedEntity.device_id ?? "N/A"}
                  </span>
                </li>
              </ul>
            </div>

            {selectedEntity.configuration && (
              <div>
                <h4 className='font-semibold text-sm mb-2'>Configuration</h4>
                <pre className='text-xs p-3 bg-muted rounded-md overflow-auto'>
                  {JSON.stringify(selectedEntity.configuration, null, 2)}
                </pre>
              </div>
            )}

            <div>
              <h4 className='font-semibold text-base mb-2'>Device</h4>
              <ul className='text-sm space-y-2'>
                <li className='flex items-center'>
                  <strong>Name:</strong>{" "}
                  <span className='ml-2'>{device.name || "N/A"}</span>
                </li>
              </ul>
            </div>

            {entities.map((item) => (
              <div>
                <h4 className='font-semibold text-sm mb-2'>
                  Entity: {item.friendly_name}
                </h4>
                <pre className='text-xs p-3 bg-muted rounded-md overflow-auto'>
                  {JSON.stringify(item, null, 2)}
                </pre>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
