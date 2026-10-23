import type { AppServices } from "../contracts";
import { wireLegacyApiFacade } from "../api";
import { mergeEnvarlyApi } from "./appServices";

export function syncLegacyApiFacade(services: AppServices): void {
  wireLegacyApiFacade(mergeEnvarlyApi(services));
}
