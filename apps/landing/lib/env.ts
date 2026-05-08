/**
 * [TALLY_ENV] Tiny env reader used by /api/checkout/* and /api/webhooks/*.
 * Mirrors the shape in payments-prototypes/src/lib/env.ts so the surface
 * looks identical across Wave 2 builds.
 */

export class MissingEnvError extends Error {
  constructor(public readonly envName: string) {
    super(`Missing required environment variable: ${envName}`);
    this.name = "MissingEnvError";
  }
}

export function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : undefined;
}

export function requiredEnv(name: string): string {
  const value = optionalEnv(name);
  if (!value) throw new MissingEnvError(name);
  return value;
}

export function appUrlFromRequest(request: Request): string {
  const fromEnv = optionalEnv("NEXT_PUBLIC_SITE_URL") ?? optionalEnv("NEXT_PUBLIC_APP_URL");
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return new URL(request.url).origin;
}
