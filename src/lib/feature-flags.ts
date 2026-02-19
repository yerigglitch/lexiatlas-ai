function isTruthy(value: string | undefined) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function readFlag(name: string, fallback = false) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return isTruthy(value);
}

export function isFeatureDocflowEnabled() {
  return readFlag("FEATURE_DOCFLOW", true);
}

export function isFeatureEmailV2Enabled() {
  // Backward compatible with the previous flag name.
  return readFlag("FEATURE_EMAIL_V2", readFlag("EMAIL_V2_ENABLED", false));
}

export function isFeatureAppLiteEnabled() {
  return readFlag("FEATURE_APP_LITE", false);
}

export function isFeatureRssEnabled() {
  return readFlag("FEATURE_RSS", false);
}

export function isFeatureOauthAdvancedEnabled() {
  return readFlag("FEATURE_OAUTH_ADVANCED", true);
}
