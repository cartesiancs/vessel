import React, { useEffect } from "react";
import { useHaStore } from "@/entities/ha/store";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, AlertTriangle } from "lucide-react";
import { HaStatBlock } from "./HaStatBlock";
import { HaEntitiesTable } from "./HaEntitiesTable";

export const HaDashboard = () => {
  const { states, status, error, fetchStates } = useHaStore();

  useEffect(() => {
    if (status === "idle") {
      fetchStates();
    }
  }, [status, fetchStates]);

  if (status === "loading" || status === "idle") {
    return (
      <div className='flex items-center justify-center py-20'>
        <Loader2 className='h-10 w-10 animate-spin text-muted-foreground' />
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className='flex flex-1 flex-col gap-4 w-full'>
        <Alert variant='destructive' className='m-4 w-auto'>
          <AlertTriangle className='h-4 w-4' />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error || "An unknown error occurred."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className='flex flex-1 flex-col gap-4'>
      <div className='py-4 md:py-6'>
        <HaStatBlock states={states} />
      </div>
      <div className='py-6'>
        <HaEntitiesTable states={states} />
      </div>
    </div>
  );
};
