import { useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { useDeviceStore } from "@/entities/device/store";
import { DeviceDeleteButton } from "@/features/device/DeviceDeleteButton";
import { DeviceUpdateButton } from "@/features/device/DeviceUpdateButton";
import { DeviceCreateButton } from "@/features/device/DeviceCreateButton";

export function DeviceList() {
  const { devices, isLoading, fetchDevices, selectDevice, selectedDevice } =
    useDeviceStore();

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  if (isLoading) {
    return (
      <Card className='flex justify-center items-center min-h-[200px]'>
        <Loader2 className='h-8 w-8 animate-spin' />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className='flex flex-row items-start justify-between'>
        <div>
          <CardTitle>Devices</CardTitle>
          <CardDescription>
            Select a device to view its entities.
          </CardDescription>
        </div>
        <DeviceCreateButton />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className='hidden sm:table-cell'>
                Manufacturer
              </TableHead>
              <TableHead className='text-right'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.map((device) => (
              <TableRow
                key={device.id}
                onClick={() => selectDevice(device)}
                className={`cursor-pointer ${
                  selectedDevice?.id === device.id ? "bg-muted/50" : ""
                }`}
              >
                <TableCell className='font-medium'>
                  {device.device_id}
                </TableCell>
                <TableCell>{device.name ?? "N/A"}</TableCell>
                <TableCell className='hidden sm:table-cell'>
                  {device.manufacturer ?? "N/A"}
                </TableCell>
                <TableCell
                  className='text-right space-x-1'
                  onClick={(e) => e.stopPropagation()}
                >
                  <DeviceUpdateButton device={device} />
                  <DeviceDeleteButton deviceId={device.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
