import { isFeatureEmailV2Enabled } from "@/lib/feature-flags";

export function isEmailV2Enabled() {
  return isFeatureEmailV2Enabled();
}
