export type IntegrationId = "home-assistant" | "ros2";

export interface StepComponentProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export interface FinalStepProps {
  integrationName: string;
}

export interface IntegrationWizardModalProps {
  integrationId: IntegrationId;
  onClose: () => void;
  onComplete: () => void;
}
