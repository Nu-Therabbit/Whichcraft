import type { AppServices } from "../contracts";
import { wireLegacyApiFacade } from "../api";
import { mergeWhichcraftApi } from "./appServices";

export function syncLegacyApiFacade(services: AppServices): void {
  wireLegacyApiFacade(mergeWhichcraftApi(services));
}
