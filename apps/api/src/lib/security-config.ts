const DEFAULT_TRUSTED_ORIGIN = "http://localhost:3000";

const parseOrigins = (value: string | undefined): string[] => {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
};

const toOrigin = (value: string): string | null => {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

export const getTrustedOrigins = (): string[] => {
  const configuredOrigins = [
    ...parseOrigins(process.env.TRUSTED_ORIGINS),
    ...parseOrigins(process.env.CORS_ORIGIN),
  ];

  const resolvedOrigins =
    configuredOrigins.length > 0 ? configuredOrigins : [DEFAULT_TRUSTED_ORIGIN];

  const normalizedOrigins = Array.from(
    new Set(
      resolvedOrigins
        .map((origin) => toOrigin(origin))
        .filter((origin): origin is string => origin !== null)
    )
  );

  if (normalizedOrigins.length === 0) {
    return [DEFAULT_TRUSTED_ORIGIN];
  }

  return normalizedOrigins;
};

export const isTrustedOrigin = (origin: string | null | undefined): boolean => {
  if (!origin) {
    return false;
  }

  const normalizedOrigin = toOrigin(origin);
  if (!normalizedOrigin) {
    return false;
  }

  return getTrustedOrigins().includes(normalizedOrigin);
};

export const getPrimaryTrustedOrigin = (): string => {
  const [firstOrigin = DEFAULT_TRUSTED_ORIGIN] = getTrustedOrigins();
  return firstOrigin;
};

export const isProduction = process.env.NODE_ENV === "production";
