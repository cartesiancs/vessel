import { useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { Circle, CircleCheck, Loader2, MoreHorizontal } from "lucide-react";
import { useDeviceStore } from "@/entities/device";
import { DeviceDeleteButton } from "@/features/device";
import { DeviceUpdateButton } from "@/features/device";
import { DeviceCreateButton } from "@/features/device";
import { DeviceKeyButton } from "@/features/device";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Button } from "@/shared/ui/button";

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
              <TableHead></TableHead>

              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className='hidden sm:table-cell'>
                Manufacturer
              </TableHead>
              <TableHead className='sticky right-0 bg-background w-[40px] min-w-[40px] text-right'>
                Actions
              </TableHead>
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
                  {selectedDevice?.id === device.id ? (
                    <CircleCheck className='text-blue-500' />
                  ) : (
                    <Circle className='text-muted/70' />
                  )}
                </TableCell>
                <TableCell className='font-medium'>
                  {device.device_id}
                </TableCell>
                <TableCell>{device.name ?? "N/A"}</TableCell>
                <TableCell className='hidden sm:table-cell'>
                  {device.manufacturer ?? "N/A"}
                </TableCell>
                <TableCell
                  className='sticky right-0 bg-background text-right space-x-1'
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant='ghost' className='h-8 w-8 p-0'>
                        <span className='sr-only'>Open menu</span>
                        <MoreHorizontal className='h-4 w-4' />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='end'>
                      <DeviceUpdateButton device={device} />
                      <DeviceKeyButton deviceId={device.id} />
                      <DeviceDeleteButton deviceId={device.id} />
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
