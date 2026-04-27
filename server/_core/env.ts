export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};

const CRITICAL_ENV_VARS = [
  { key: "VITE_APP_ID", value: ENV.appId },
  { key: "JWT_SECRET", value: ENV.cookieSecret },
  { key: "OAUTH_SERVER_URL", value: ENV.oAuthServerUrl },
] as const;

export function validateCriticalEnvVars(): void {
  const missing = CRITICAL_ENV_VARS
    .filter(({ value }) => value.trim().length === 0)
    .map(({ key }) => key);

  if (missing.length === 0) {
    return;
  }

  throw new Error(
    `[Config] Missing required environment variables: ${missing.join(", ")}`
  );
}
