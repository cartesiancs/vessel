import { useEffect } from "react";
import { useConfigStore } from "../store";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ConfigurationCreateButton } from "./ConfigurationCreateButton";
import { ConfigurationActionButton } from "./ConfigurationActionButton";

export function ConfigurationTable() {
  const { configurations, fetchConfigs, isLoading, error } = useConfigStore();

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div className='text-red-500'>{error}</div>;
  }

  return (
    <div className='space-y-4'>
      <div className='flex justify-between items-center'>
        <h2 className='text-2xl font-bold'>System Configurations</h2>
        <ConfigurationCreateButton />
      </div>
      <div className='border rounded-lg'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-[200px]'>Key</TableHead>
              <TableHead>Value</TableHead>
              <TableHead className='w-[150px]'>Description</TableHead>
              <TableHead className='w-[100px]'>Status</TableHead>
              <TableHead className='w-[100px] text-right'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {configurations.map((config) => (
              <TableRow key={config.id}>
                <TableCell className='font-mono'>{config.key}</TableCell>
                <TableCell className='font-mono max-w-xs truncate'>
                  {config.value}
                </TableCell>
                <TableCell>{config.description}</TableCell>
                <TableCell>
                  <Badge variant={config.enabled ? "default" : "outline"}>
                    {config.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </TableCell>
                <TableCell className='text-right'>
                  <ConfigurationActionButton config={config} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
