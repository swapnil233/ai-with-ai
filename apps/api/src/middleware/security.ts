import { randomBytes, randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";
import { isProduction, isTrustedOrigin } from "../lib/security-config.js";

export const CSRF_COOKIE_NAME = "aiapp.csrf-token";
export const CSRF_HEADER_NAME = "x-csrf-token";
export const CSRF_TOKEN_TTL_MS = 1000 * 60 * 60 * 2;

const SAFE_HTTP_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 300;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

const RATE_LIMIT_MAX_REQUESTS = parsePositiveInt(
  process.env.RATE_LIMIT_MAX,
  DEFAULT_RATE_LIMIT_MAX_REQUESTS
);
const RATE_LIMIT_WINDOW_MS = parsePositiveInt(
  process.env.RATE_LIMIT_WINDOW_MS,
  DEFAULT_RATE_LIMIT_WINDOW_MS
);

const cleanupRateLimitStore = () => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
};

const cleanupInterval = setInterval(cleanupRateLimitStore, RATE_LIMIT_WINDOW_MS);
cleanupInterval.unref();

const getHeaderValue = (value: string | string[] | undefined): string | undefined => {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && value.length > 0) {
    return value[0];
  }

  return undefined;
};

export const getRequestIp = (req: Request): string => {
  const forwardedFor = getHeaderValue(req.headers["x-forwarded-for"]);
  if (forwardedFor) {
    const [firstForwardedIp] = forwardedFor.split(",");
    if (firstForwardedIp && firstForwardedIp.trim().length > 0) {
      return firstForwardedIp.trim();
    }
  }

  return req.ip || req.socket.remoteAddress || "unknown";
};

export const getRequestOrigin = (req: Request): string | null => {
  const originHeader = getHeaderValue(req.headers.origin);
  if (originHeader) {
    return originHeader;
  }

  const refererHeader = getHeaderValue(req.headers.referer);
  if (!refererHeader) {
    return null;
  }

  try {
    return new URL(refererHeader).origin;
  } catch {
    return null;
  }
};

export const parseCookieHeader = (cookieHeader: string | undefined): Map<string, string> => {
  const cookies = new Map<string, string>();
  if (!cookieHeader) {
    return cookies;
  }

  for (const pair of cookieHeader.split(";")) {
    const trimmed = pair.trim();
    if (!trimmed) {
      continue;
    }

    const [name, ...rest] = trimmed.split("=");
    if (!name || rest.length === 0) {
      continue;
    }

    const value = rest.join("=");
    cookies.set(name, decodeURIComponent(value));
  }

  return cookies;
};

export const createCsrfToken = () => randomBytes(32).toString("hex");

export const attachRequestId = (req: Request, res: Response, next: NextFunction) => {
  const incomingRequestId = getHeaderValue(req.headers["x-request-id"]);
  const requestId =
    incomingRequestId && incomingRequestId.trim().length > 0 ? incomingRequestId : randomUUID();

  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
};

export const applySecurityHeaders = (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("x-frame-options", "DENY");
  res.setHeader("referrer-policy", "no-referrer");
  res.setHeader("x-dns-prefetch-control", "off");
  res.setHeader("x-xss-protection", "0");
  res.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader(
    "content-security-policy",
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
  );

  if (isProduction) {
    res.setHeader("strict-transport-security", "max-age=31536000; includeSubDomains");
  }

  next();
};

export const rateLimitRequests = (req: Request, res: Response, next: NextFunction) => {
  const key = `${getRequestIp(req)}:${req.method}`;
  const now = Date.now();
  const existingEntry = rateLimitStore.get(key);

  if (!existingEntry || existingEntry.resetAt <= now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
  } else {
    existingEntry.count += 1;
    rateLimitStore.set(key, existingEntry);
  }

  const activeEntry = rateLimitStore.get(key);
  const currentCount = activeEntry?.count ?? 0;
  const resetAt = activeEntry?.resetAt ?? now + RATE_LIMIT_WINDOW_MS;

  res.setHeader("x-ratelimit-limit", String(RATE_LIMIT_MAX_REQUESTS));
  res.setHeader(
    "x-ratelimit-remaining",
    String(Math.max(RATE_LIMIT_MAX_REQUESTS - currentCount, 0))
  );
  res.setHeader("x-ratelimit-reset", String(Math.ceil(resetAt / 1000)));

  if (currentCount > RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterSeconds = Math.max(Math.ceil((resetAt - now) / 1000), 1);
    res.setHeader("retry-after", String(retryAfterSeconds));
    res.status(429).json({ error: "Too many requests" });
    return;
  }

  next();
};

const isExcludedPath = (req: Request): boolean => {
  return req.path.startsWith("/api/auth/");
};

export const requireCsrfProtection = (req: Request, res: Response, next: NextFunction) => {
  if (SAFE_HTTP_METHODS.has(req.method.toUpperCase()) || isExcludedPath(req)) {
    next();
    return;
  }

  const origin = getRequestOrigin(req);
  if (!isTrustedOrigin(origin)) {
    res.status(403).json({ error: "Forbidden origin" });
    return;
  }

  const csrfCookieToken = parseCookieHeader(
    typeof req.headers.cookie === "string" ? req.headers.cookie : undefined
  ).get(CSRF_COOKIE_NAME);
  const csrfHeaderToken = req.header(CSRF_HEADER_NAME);

  if (!csrfCookieToken || !csrfHeaderToken || csrfCookieToken !== csrfHeaderToken) {
    res.status(403).json({ error: "Invalid CSRF token" });
    return;
  }

  next();
};

export const setCsrfCookie = (res: Response, csrfToken: string) => {
  res.cookie(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false,
    maxAge: CSRF_TOKEN_TTL_MS,
    path: "/",
    sameSite: "lax",
    secure: isProduction,
  });
};
