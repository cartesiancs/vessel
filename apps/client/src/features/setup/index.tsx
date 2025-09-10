import { getConfigs } from "@/entities/configurations/api";
import { getDevices } from "@/entities/device/api";
import { getAllEntities } from "@/entities/entity/api";
import { getFlows } from "@/entities/flow/api";
import { isValidConfig } from "../integration/validate";

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
    url: "/servers",
    verifyStatus: async () => {
      const response = await getConfigs();

      if (response.data.length > 0) {
        return isValidConfig(response.data, "HA");
      } else {
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
      const devices = await getDevices();
      if (devices.data.length > 0) {
        return true;
      } else {
        return false;
      }
    },
  },
  {
    id: "add-sensor",
    title: "Add Sensor",
    description: "Add a sensor (entity) for the device.",
    isCompleted: false,
    url: "/key",
    verifyStatus: async () => {
      const entity = await getAllEntities();
      if (entity.data.length > 0) {
        return true;
      } else {
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
      const flows = await getFlows();
      if (flows.length > 0) {
        return true;
      } else {
        return false;
      }
    },
  },
];
