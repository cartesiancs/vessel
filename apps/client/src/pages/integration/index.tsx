import React, { useState } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppSidebar } from "@/features/sidebar";
import { Home, Bot, ArrowRight, CheckCircle } from "lucide-react";

const HA_Step1_URL = () => (
  <div className='grid gap-4 py-4'>
    <div className='grid grid-cols-4 items-center gap-4'>
      <Label htmlFor='ha-url' className='text-right'>
        HA URL
      </Label>
      <Input
        id='ha-url'
        placeholder='http://homeassistant.local:8123'
        className='col-span-3'
      />
    </div>
    <p className='text-sm text-muted-foreground px-4 text-center'>
      Enter the network address of your Home Assistant instance.
    </p>
  </div>
);

const HA_Step2_Token = () => (
  <div className='grid gap-4 py-4'>
    <div className='grid grid-cols-4 items-center gap-4'>
      <Label htmlFor='ha-token' className='text-right'>
        Access Token
      </Label>
      <Input
        id='ha-token'
        type='password'
        placeholder='Paste your Long-Lived Access Token'
        className='col-span-3'
      />
    </div>
    <p className='text-sm text-muted-foreground px-4 text-center'>
      Create and copy a Long-Lived Access Token from your HA profile page.
    </p>
  </div>
);

const ROS2_Step1_Bridge = () => (
  <div className='py-4 text-center'>
    <h4 className='font-semibold'>ROS2 Bridge Server</h4>
    <p className='text-sm text-muted-foreground mt-2'>
      Ensure that the `rosbridge_server` is running on your ROS2 machine.
      <br />
      Example command:
    </p>
    <code className='text-xs bg-muted p-2 rounded-md block mt-2'>
      ros2 launch rosbridge_server rosbridge_websocket_launch.xml
    </code>
  </div>
);

const ROS2_Step2_Address = () => (
  <div className='grid gap-4 py-4'>
    <div className='grid grid-cols-4 items-center gap-4'>
      <Label htmlFor='ros-address' className='text-right'>
        WebSocket URL
      </Label>
      <Input
        id='ros-address'
        placeholder='ws://<your_ros_ip>:9090'
        className='col-span-3'
      />
    </div>
    <p className='text-sm text-muted-foreground px-4 text-center'>
      Enter the WebSocket address of your rosbridge server.
    </p>
  </div>
);

const FinalStep = ({ integrationName }: { integrationName: string }) => (
  <div className='py-8 text-center flex flex-col items-center justify-center gap-4'>
    <CheckCircle className='h-16 w-16 text-green-500' />
    <h3 className='text-2xl font-bold'>Connection Complete!</h3>
    <p className='text-muted-foreground'>
      Successfully configured the {integrationName} integration.
    </p>
  </div>
);

const wizardConfig = {
  "home-assistant": {
    name: "Home Assistant",
    steps: [
      { title: "Connect to Home Assistant", component: <HA_Step1_URL /> },
      { title: "Provide Access Token", component: <HA_Step2_Token /> },
    ],
  },
  ros2: {
    name: "ROS2",
    steps: [
      { title: "Prerequisites", component: <ROS2_Step1_Bridge /> },
      { title: "Enter Bridge Address", component: <ROS2_Step2_Address /> },
    ],
  },
};

type IntegrationId = keyof typeof wizardConfig;

const IntegrationWizardModal = ({
  integrationId,
  onClose,
  onComplete,
}: {
  integrationId: IntegrationId;
  onClose: () => void;
  onComplete: () => void;
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const config = wizardConfig[integrationId];
  const totalSteps = config.steps.length;
  const isLastStep = currentStep === totalSteps;

  const handleNext = () =>
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
  const handleBack = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

  const CurrentStepComponent = isLastStep ? (
    <FinalStep integrationName={config.name} />
  ) : (
    config.steps[currentStep].component
  );

  const currentTitle = isLastStep
    ? "Setup Complete"
    : config.steps[currentStep].title;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>{currentTitle}</DialogTitle>
          {!isLastStep && (
            <DialogDescription>
              Step {currentStep + 1} of {totalSteps}
            </DialogDescription>
          )}
        </DialogHeader>

        {CurrentStepComponent}

        <DialogFooter>
          {currentStep > 0 && !isLastStep && (
            <Button variant='outline' onClick={handleBack}>
              Back
            </Button>
          )}
          {isLastStep ? (
            <Button onClick={onComplete} className='w-full'>
              Finish
            </Button>
          ) : (
            <Button onClick={handleNext}>
              Next <ArrowRight className='ml-2 h-4 w-4' />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const initialIntegrations = [
  {
    id: "home-assistant" as IntegrationId,
    name: "Home Assistant",
    description:
      "Connect and control your Home Assistant devices and entities directly.",
    icon: <Home className='h-8 w-8 text-cyan-500' />,
    status: "Not Connected",
  },
  {
    id: "ros2" as IntegrationId,
    name: "ROS2",
    description:
      "Integrate with your ROS2 ecosystem for advanced robotics control and monitoring.",
    icon: <Bot className='h-8 w-8 text-green-500' />,
    status: "Not Connected",
  },
];

export function IntegrationPage() {
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [selectedIntegration, setSelectedIntegration] =
    useState<IntegrationId | null>(null);

  const handleConnectClick = (integrationId: IntegrationId) => {
    setSelectedIntegration(integrationId);
  };

  const handleWizardComplete = () => {
    if (selectedIntegration) {
      setIntegrations((prev) =>
        prev.map((int) =>
          int.id === selectedIntegration
            ? { ...int, status: "Connected" }
            : int,
        ),
      );
    }
    setSelectedIntegration(null);
  };

  const handleWizardClose = () => {
    setSelectedIntegration(null);
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className='flex h-12 shrink-0 items-center gap-2 border-b px-4'>
          <SidebarTrigger className='-ml-1' />
          <Separator
            orientation='vertical'
            className='mr-2 data-[orientation=vertical]:h-4'
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className='hidden md:block'>
                <BreadcrumbLink href='#'>/</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className='hidden md:block' />
              <BreadcrumbItem>
                <BreadcrumbPage>Integration</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <main className='flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6'>
          <div className='flex items-center'>
            <h1 className='text-lg font-semibold md:text-2xl'>Integrations</h1>
          </div>

          <div className='flex flex-col gap-4'>
            {integrations.map((integration) => (
              <div
                key={integration.id}
                className='flex items-center gap-4 rounded-lg border p-4'
              >
                {integration.icon}
                <div className='flex-grow'>
                  <h3 className='font-semibold'>{integration.name}</h3>
                  <p className='text-sm text-muted-foreground'>
                    {integration.description}
                  </p>
                </div>
                <div className='flex items-center gap-4 ml-auto'>
                  {integration.status != "Connected" && (
                    <Badge
                      variant={
                        integration.status === "Connected"
                          ? "default"
                          : "outline"
                      }
                    >
                      {integration.status}
                    </Badge>
                  )}

                  {integration.status === "Connected" ? (
                    <Button size='sm' variant='secondary'>
                      Configure
                    </Button>
                  ) : (
                    <Button
                      size='sm'
                      onClick={() => handleConnectClick(integration.id)}
                    >
                      Connect
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </main>

        {selectedIntegration && (
          <IntegrationWizardModal
            integrationId={selectedIntegration}
            onClose={handleWizardClose}
            onComplete={handleWizardComplete}
          />
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
