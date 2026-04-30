import { getDevices } from "@/entities/device";
import { getAllEntities } from "@/entities/entity";
import { getFlows } from "@/entities/flow";
import { getIntegrationStatus } from "@/entities/integrations";

export type SetupStep = {
  id: string;
  title: string;
  description: string;
  isCompleted: boolean;
  url: string;
  verifyStatus: () => Promise<boolean>;
};

export const initialSetupSteps: SetupStep[] = [
  {
    id: "enable-config",
    title: "Enable MQTT & UDP",
    description: "Enable basic protocols",
    isCompleted: false,
    url: "/settings/config",
    verifyStatus: async () => {
      try {
        const status = await getIntegrationStatus();
        return status.data.home_assistant.connected;
      } catch {
        return false;
      }
    },
  },
  {
    id: "add-device",
    title: "Add Device",
    description: "Add a new device.",
    isCompleted: false,
    url: "/devices",
    verifyStatus: async () => {
      try {
        const devices = await getDevices();
        return devices.data.length > 0;
      } catch {
        return false;
      }
    },
  },
  {
    id: "add-sensor",
    title: "Add Sensor",
    description: "Add a sensor (entity) for the device.",
    isCompleted: false,
    url: "/devices",
    verifyStatus: async () => {
      try {
        const entity = await getAllEntities();
        return entity.data.length > 0;
      } catch {
        return false;
      }
    },
  },
  {
    id: "first-flow",
    title: "Setup a Flow",
    description: "Creates the first flow.",
    isCompleted: false,
    url: "/flow",
    verifyStatus: async () => {
      try {
        const flows = await getFlows();
        return flows.length > 0;
      } catch {
        return false;
      }
    },
  },
];
