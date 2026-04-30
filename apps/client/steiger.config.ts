import { defineConfig } from "steiger";
import fsd from "@feature-sliced/steiger-plugin";

export default defineConfig([
  ...fsd.configs.recommended,
  {
    files: ["./src/**"],
    rules: {
      "fsd/insignificant-slice": "off",
      "fsd/repetitive-naming": "off",
      "fsd/inconsistent-naming": "off",
      "fsd/excessive-slicing": "off",
    },
  },
]);
