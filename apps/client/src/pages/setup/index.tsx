import React, { useEffect, useState } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/features/sidebar";
import { ArrowRight, Check, Circle, Loader2 } from "lucide-react";
import { initialSetupSteps, SetupStep } from "@/features/setup";

export function SetupPage(): React.ReactElement {
  const [steps, setSteps] = useState<SetupStep[]>(initialSetupSteps);
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    const runInitialChecks = async () => {
      setIsVerifying(true);
      const updatedSteps = await Promise.all(
        initialSetupSteps.map(async (step) => ({
          ...step,
          isCompleted: await step.verifyStatus(),
        })),
      );
      setSteps(updatedSteps);
      setIsVerifying(false);
    };

    runInitialChecks();
  }, []);

  const handleNavigate = (url: string) => {
    console.log(`Navigating to ${url}`);
    window.location.href = url;
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className='flex h-12 shrink-0 items-center gap-2 border-b border-gray-800 px-4'>
          <SidebarTrigger className='-ml-1' />
          <Separator
            orientation='vertical'
            className='mr-2 border-gray-700 data-[orientation=vertical]:h-4'
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className='hidden md:block'>
                <BreadcrumbLink href='#' className='text-gray-400'>
                  /
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className='hidden md:block' />
              <BreadcrumbItem>
                <BreadcrumbPage className='text-gray-50'>Setup</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <main className='flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6'>
          <div className='flex items-center'>
            <h1 className='text-lg font-semibold text-gray-50 md:text-2xl'>
              Setup Guide
            </h1>
          </div>

          {isVerifying && (
            <div className='flex items-center justify-center p-8'>
              <Loader2 className='h-6 w-6 animate-spin text-gray-400' />
              <p className='ml-3 text-gray-400'>Verifying setup status...</p>
            </div>
          )}
          {!isVerifying && (
            <div className='flex flex-col'>
              {steps.map((step, index) => (
                <div key={step.id} className='flex gap-4'>
                  <div className='flex flex-col items-center'>
                    <div
                      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                        step.isCompleted
                          ? "bg-blue-600 text-white"
                          : "border-2 border-gray-700 bg-gray-900 text-gray-500"
                      }`}
                    >
                      {step.isCompleted ? (
                        <Check className='h-5 w-5' />
                      ) : (
                        <Circle className='h-3 w-3 fill-current' />
                      )}
                    </div>
                    {index < steps.length - 1 && (
                      <div className='h-full w-0.5 bg-gray-800' />
                    )}
                  </div>
                  <div className='flex-1 pb-10'>
                    <div className='flex items-center justify-between'>
                      <div className='flex flex-col'>
                        <h3
                          className={`font-semibold ${
                            step.isCompleted ? "text-gray-600" : "text-gray-100"
                          }`}
                        >
                          {step.title}
                        </h3>
                        <p
                          className={`text-sm ${
                            step.isCompleted
                              ? "text-gray-500 line-through"
                              : "text-gray-400"
                          }`}
                        >
                          {step.description}
                        </p>
                      </div>
                      {step.isCompleted ? (
                        <div className=''></div>
                      ) : (
                        <Button
                          onClick={() => handleNavigate(step.url)}
                          size='sm'
                          variant='secondary'
                        >
                          Go to setup
                          <ArrowRight className='ml-2 h-4 w-4' />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
