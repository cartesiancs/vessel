import React, { useState, useEffect, useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Home, Bot, Radio, ArrowRight, CheckCircle, Loader2 } from "lucide-react";
import { useIntegrationStore } from "@/entities/integrations/store";
import {
  StepComponentProps,
  FinalStepProps,
  IntegrationId,
  IntegrationWizardModalProps,
} from "./types";
import { HA_Step1_URL, HA_Step2_Token } from "./HA";
import { ROS2_Step1_Bridge, ROS2_Step2_Address } from "./ROS";
import { SDR_Step1_Info, SDR_Step2_Host, SDR_Step3_Port } from "./SDR";
import { useNavigate } from "react-router";
import { toast } from "sonner";

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
    registrationId: string;
    steps: {
      title: string;
      configKey?: string;
      component: React.FC<StepComponentProps>;
    }[];
    buildConfig: (formData: Record<string, string>) => Record<string, string>;
  };
} = {
  "home-assistant": {
    name: "Home Assistant",
    registrationId: "home_assistant",
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
    buildConfig: (formData) => ({
      url: formData["home_assistant_url"] || "",
      token: formData["home_assistant_token"] || "",
    }),
  },
  ros2: {
    name: "ROS2",
    registrationId: "ros2",
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
    buildConfig: (formData) => ({
      websocket_url: formData["ros2_websocket_url"] || "",
    }),
  },
  sdr: {
    name: "RTL-SDR",
    registrationId: "sdr",
    steps: [
      {
        title: "RTL-SDR (rtl_tcp) Prerequisites",
        component: SDR_Step1_Info,
      },
      {
        title: "Enter Server Host",
        configKey: "sdr_host",
        component: SDR_Step2_Host,
      },
      {
        title: "Enter Server Port",
        configKey: "sdr_port",
        component: SDR_Step3_Port,
      },
    ],
    buildConfig: (formData) => ({
      host: formData["sdr_host"] || "",
      port: formData["sdr_port"] || "1234",
    }),
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
  const { registerIntegration } = useIntegrationStore();

  const config = wizardConfig[integrationId];
  const totalSteps = config.steps.length;
  const isLastStep = currentStep === totalSteps;

  const handleDataChange = (key: string | undefined, value: string) => {
    if (key) {
      setFormData((prev) => ({ ...prev, [key]: value }));
    }
  };

  const isLastConfigStep = currentStep === totalSteps - 1;

  const handleNext = async () => {
    if (isLastConfigStep) {
      // On the last configurable step, register the entire integration
      setIsSaving(true);
      try {
        const integrationConfig = config.buildConfig(formData);
        await registerIntegration(config.registrationId, integrationConfig);
        setCurrentStep((prev) => prev + 1);
      } catch (error) {
        console.error("Failed to register integration:", error);
        toast("Failed to register integration.");
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
  {
    id: "sdr",
    name: "RTL-SDR",
    description:
      "Connect to an RTL-SDR receiver via rtl_tcp for software-defined radio control and spectrum monitoring.",
    icon: <Radio className='h-8 w-8 text-purple-500' />,
    status: "Not Connected",
  },
];

export function Intergration() {
  const [selectedIntegration, setSelectedIntegration] =
    useState<IntegrationId | null>(null);
  const { isHaConnected, isRos2Connected, isSdrConnected, fetchStatus } =
    useIntegrationStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const integrations = useMemo(() => {
    return initialIntegrations.map((int) => {
      if (int.id === "home-assistant") {
        return {
          ...int,
          status: isHaConnected
            ? ("Connected" as const)
            : ("Not Connected" as const),
        };
      }
      if (int.id === "ros2") {
        return {
          ...int,
          status: isRos2Connected
            ? ("Connected" as const)
            : ("Not Connected" as const),
        };
      }
      if (int.id === "sdr") {
        return {
          ...int,
          status: isSdrConnected
            ? ("Connected" as const)
            : ("Not Connected" as const),
        };
      }
      return int;
    });
  }, [isHaConnected, isRos2Connected, isSdrConnected]);

  const handleConnectClick = (integrationId: IntegrationId) => {
    setSelectedIntegration(integrationId);
  };

  const handleWizardComplete = () => {
    fetchStatus();
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
          className='flex items-center gap-4 border p-4'
        >
          {integration.icon}
          <div className='flex-grow'>
            <h3 className='font-semibold'>{integration.name}</h3>
            <p className='text-sm text-muted-foreground'>
              {integration.description}
            </p>
          </div>
          <div className='flex items-center gap-4 ml-auto'>
            {integration.status === "Connected" ? (
              <Button
                size='sm'
                variant='secondary'
                onClick={() => navigate(`/devices?configure=${integration.id}`)}
              >
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
