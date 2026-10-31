import { playwright } from "@vitest/browser-playwright";
import config from "../../vitest.config.ts";

const storybook = config.test!.projects![1] as any;
storybook.test.browser.provider = playwright({ launchOptions: { channel: "msedge" } });
export default config;
