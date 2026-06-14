import baseConfig from "@Emitkit/config/vitest.config.base";
import { mergeConfig } from "vitest/config";

export default mergeConfig(baseConfig, {
  test: {
    environment: "jsdom",
  },
});
