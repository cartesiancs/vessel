import React, { useState, useEffect, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Home, Bot, ArrowRight, CheckCircle, Loader2 } from "lucide-react";
import { useConfigStore } from "@/entities/configurations/store";

type IntegrationId = "home-assistant" | "ros2";

interface StepComponentProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

interface FinalStepProps {
  integrationName: string;
}

interface IntegrationWizardModalProps {
  integrationId: IntegrationId;
  onClose: () => void;
  onComplete: () => void;
}

const HA_Step1_URL: React.FC<StepComponentProps> = ({ value, onChange }) => (
  <div className='grid gap-4 py-4'>
    <div className='grid grid-cols-4 items-center gap-4'>
      <Label htmlFor='ha-url' className='text-right'>
        HA URL
      </Label>
      <Input
        id='ha-url'
        placeholder='http://homeassistant.local:8123'
        className='col-span-3'
        value={value}
        onChange={onChange}
      />
    </div>
    <p className='text-sm text-muted-foreground px-4 text-center'>
      Enter the network address of your Home Assistant instance.
    </p>
  </div>
);

const HA_Step2_Token: React.FC<StepComponentProps> = ({ value, onChange }) => (
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
        value={value}
        onChange={onChange}
      />
    </div>
    <p className='text-sm text-muted-foreground px-4 text-center'>
      Create and copy a Long-Lived Access Token from your HA profile page.
    </p>
  </div>
);

const ROS2_Step1_Bridge: React.FC = () => (
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

const ROS2_Step2_Address: React.FC<StepComponentProps> = ({
  value,
  onChange,
}) => (
  <div className='grid gap-4 py-4'>
    <div className='grid grid-cols-4 items-center gap-4'>
      <Label htmlFor='ros-address' className='text-right'>
        WebSocket URL
      </Label>
      <Input
        id='ros-address'
        placeholder='ws://<your_ros_ip>:9090'
        className='col-span-3'
        value={value}
        onChange={onChange}
      />
    </div>
    <p className='text-sm text-muted-foreground px-4 text-center'>
      Enter the WebSocket address of your rosbridge server.
    </p>
  </div>
);

const FinalStep: React.FC<FinalStepProps> = ({ integrationName }) => (
  <div className='py-8 text-center flex flex-col items-center justify-center gap-4'>
    <CheckCircle className='h-16 w-16 text-green-500' />
    <h3 className='text-2xl font-bold'>Connection Complete!</h3>
    <p className='text-muted-foreground'>
      Successfully configured the {integrationName} integration.
    </p>
  </div>
);

const wizardConfig: {
  [key in IntegrationId]: {
    name: string;
    steps: {
      title: string;
      configKey?: string;
      component: React.FC<StepComponentProps>;
    }[];
  };
} = {
  "home-assistant": {
    name: "Home Assistant",
    steps: [
      {
        title: "Connect to Home Assistant",
        configKey: "home_assistant_url",
        component: HA_Step1_URL,
      },
      {
        title: "Provide Access Token",
        configKey: "home_assistant_token",
        component: HA_Step2_Token,
      },
    ],
  },
  ros2: {
    name: "ROS2",
    steps: [
      {
        title: "Prerequisites",
        component: ROS2_Step1_Bridge,
      },
      {
        title: "Enter Bridge Address",
        configKey: "ros2_websocket_url",
        component: ROS2_Step2_Address,
      },
    ],
  },
};

const IntegrationWizardModal: React.FC<IntegrationWizardModalProps> = ({
  integrationId,
  onClose,
  onComplete,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<{ [key: string]: string }>({});
  const [isSaving, setIsSaving] = useState(false);
  const { createConfig } = useConfigStore();

  const config = wizardConfig[integrationId];
  const totalSteps = config.steps.length;
  const isLastStep = currentStep === totalSteps;

  const handleDataChange = (key: string | undefined, value: string) => {
    if (key) {
      setFormData((prev) => ({ ...prev, [key]: value }));
    }
  };

  const handleNext = async () => {
    if (currentStep === totalSteps - 1) {
      setIsSaving(true);
      try {
        const createPromises = config.steps
          .map((step) => {
            const value = formData[step.configKey!];
            if (step.configKey && value) {
              return createConfig({
                key: step.configKey,
                value: value,
                enabled: 1,
                description: `${config.name} configuration setting`,
              });
            }
            return null;
          })
          .filter(Boolean);

        if (createPromises.length > 0) {
          await Promise.all(createPromises);
        }
        setCurrentStep((prev) => prev + 1);
      } catch (error) {
        console.error("Failed to save configuration:", error);
      } finally {
        setIsSaving(false);
      }
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };
  const handleBack = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

  const stepInfo = !isLastStep ? config.steps[currentStep] : null;
  const CurrentStepComponent = isLastStep ? (
    <FinalStep integrationName={config.name} />
  ) : (
    stepInfo &&
    React.createElement(stepInfo.component, {
      value: formData[stepInfo.configKey!] || "",
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        handleDataChange(stepInfo.configKey, e.target.value),
    })
  );

  const currentTitle = isLastStep
    ? "Setup Complete"
    : config.steps[currentStep].title;

  return (
    <Dialog open={true} onOpenChange={!isSaving ? onClose : undefined}>
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
            <Button variant='outline' onClick={handleBack} disabled={isSaving}>
              Back
            </Button>
          )}
          {isLastStep ? (
            <Button onClick={onComplete} className='w-full'>
              Finish
            </Button>
          ) : (
            <Button onClick={handleNext} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              ) : (
                "Next"
              )}
              {!isSaving && <ArrowRight className='ml-2 h-4 w-4' />}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const initialIntegrations: {
  id: IntegrationId;
  name: string;
  description: string;
  icon: React.ReactNode;
  status: "Connected" | "Not Connected";
}[] = [
  {
    id: "home-assistant",
    name: "Home Assistant",
    description:
      "Connect and control your Home Assistant devices and entities directly.",
    icon: <Home className='h-8 w-8 text-cyan-500' />,
    status: "Not Connected",
  },
  {
    id: "ros2",
    name: "ROS2",
    description:
      "Integrate with your ROS2 ecosystem for advanced robotics control and monitoring.",
    icon: <Bot className='h-8 w-8 text-green-500' />,
    status: "Not Connected",
  },
];

export function Intergration() {
  const [selectedIntegration, setSelectedIntegration] =
    useState<IntegrationId | null>(null);
  const { configurations, fetchConfigs } = useConfigStore();

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const integrations = useMemo(() => {
    const hasConfig = (key: string) =>
      configurations.some((c) => c.key === key && c.value);

    const isHaConnected =
      hasConfig("home_assistant_url") && hasConfig("home_assistant_token");
    const isRos2Connected = hasConfig("ros2_websocket_url");

    return initialIntegrations.map((int) => {
      if (int.id === "home-assistant") {
        return {
          ...int,
          status: isHaConnected ? "Connected" : "Not Connected",
        };
      }
      if (int.id === "ros2") {
        return {
          ...int,
          status: isRos2Connected ? "Connected" : "Not Connected",
        };
      }
      return int;
    });
  }, [configurations]);

  const handleConnectClick = (integrationId: IntegrationId) => {
    setSelectedIntegration(integrationId);
  };

  const handleWizardComplete = () => {
    fetchConfigs();
    setSelectedIntegration(null);
  };

  const handleWizardClose = () => {
    setSelectedIntegration(null);
  };

  return (
    <>
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
            <Badge
              variant={
                integration.status === "Connected" ? "default" : "outline"
              }
            >
              {integration.status}
            </Badge>

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

      {selectedIntegration && (
        <IntegrationWizardModal
          integrationId={selectedIntegration}
          onClose={handleWizardClose}
          onComplete={handleWizardComplete}
        />
      )}
    </>
  );
}
