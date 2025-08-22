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
import { useEntityStore } from "@/entities/entity/store";
import { EntityCreateButton } from "@/features/entity/EntityCreateButton";
import { EntityDeleteButton } from "@/features/entity/EntityDeleteButton";
import { EntityUpdateButton } from "@/features/entity/EntityUpdateButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function EntityList() {
  const { selectedDevice } = useDeviceStore();
  const { entities, isLoading, fetchEntities } = useEntityStore();

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  const filteredEntities = selectedDevice
    ? entities.filter((e) => e.device_id === selectedDevice.id)
    : [];

  return (
    <Card>
      <CardHeader className='flex flex-row items-start justify-between'>
        <div>
          <CardTitle>Entities</CardTitle>
          <CardDescription>
            {selectedDevice
              ? `Entities for ${
                  selectedDevice.name || selectedDevice.device_id
                }`
              : "Select a device to see its entities"}
          </CardDescription>
        </div>
        <EntityCreateButton />
      </CardHeader>
      <CardContent className='min-h-[200px]'>
        {isLoading && (
          <div className='flex justify-center items-center h-full'>
            <Loader2 className='h-8 w-8 animate-spin' />
          </div>
        )}

        {!isLoading && !selectedDevice && (
          <div className='flex items-center justify-center h-full text-center text-muted-foreground'>
            <p>No device selected.</p>
          </div>
        )}

        {!isLoading && selectedDevice && filteredEntities.length === 0 && (
          <div className='flex items-center justify-center h-full text-center text-muted-foreground'>
            <p>No entities found for this device.</p>
          </div>
        )}

        {!isLoading && selectedDevice && filteredEntities.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entity ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className='sticky right-0 bg-background w-[40px] min-w-[40px] text-right'>
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntities.map((entity) => (
                <TableRow key={entity.id}>
                  <TableCell className='font-medium'>
                    {entity.entity_id}
                  </TableCell>
                  <TableCell>{entity.friendly_name ?? "N/A"}</TableCell>
                  <TableCell className='sticky right-0 bg-background text-right'>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant='ghost' className='h-8 w-8 p-0'>
                          <span className='sr-only'>Open menu</span>
                          <MoreHorizontal className='h-4 w-4' />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align='end'>
                        <EntityUpdateButton entity={entity} />
                        <EntityDeleteButton entityId={entity.id} />
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
