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
import { Loader2, MoreHorizontal } from "lucide-react";
import { useDeviceStore } from "@/entities/device/store";
import { DeviceDeleteButton } from "@/features/device/DeviceDeleteButton";
import { DeviceUpdateButton } from "@/features/device/DeviceUpdateButton";
import { DeviceCreateButton } from "@/features/device/DeviceCreateButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant='ghost' className='h-8 w-8 p-0'>
                        <span className='sr-only'>Open menu</span>
                        <MoreHorizontal className='h-4 w-4' />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='end'>
                      <DeviceUpdateButton device={device} />
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
