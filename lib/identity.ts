import { randomBytes, timingSafeEqual } from "node:crypto";

export function makeSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function secretsMatch(a: unknown, b: unknown): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length === 0 || b.length !== a.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
