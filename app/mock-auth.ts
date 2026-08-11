import { headers } from "next/headers";
import { MOCK_USERS, publicUser, type PortalUser } from "./access-model";

const COOKIE_NAME = "sopcare_session";
const SESSION_SECONDS = 60 * 60 * 8;
function bytes(value: string) {
  return new TextEncoder().encode(value);
}

function base64url(value: string) {
  const binary = Array.from(bytes(value), (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function decode64url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized);
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

async function signature(payload: string) {
  const secret = process.env.SOPCARE_SESSION_SECRET;
  if (!secret) throw new Error("SOPCARE_SESSION_SECRET is required.");
  const key = await crypto.subtle.importKey("raw", bytes(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const result = await crypto.subtle.sign("HMAC", key, bytes(payload));
  return Array.from(new Uint8Array(result), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function passwordHash(password: string) {
  const result = await crypto.subtle.digest("SHA-256", bytes(password));
  return Array.from(new Uint8Array(result), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createSessionCookie(userId: string) {
  const payload = base64url(JSON.stringify({ userId, expiresAt: Date.now() + SESSION_SECONDS * 1000 }));
  const token = `${payload}.${await signature(payload)}`;
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_SECONDS}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export async function authenticate(username: string, password: string) {
  const configuredPassword = process.env.SOPCARE_MOCK_PASSWORD;
  if (!configuredPassword) throw new Error("SOPCARE_MOCK_PASSWORD is required for prototype authentication.");
  const normalized = username.trim().toLowerCase();
  const user = MOCK_USERS.find((candidate) => candidate.username.toLowerCase() === normalized);
  if (!user || await passwordHash(configuredPassword) !== await passwordHash(password) || user.status !== "Active") return null;
  return publicUser(user);
}

export async function getPortalUser(): Promise<PortalUser | null> {
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const token = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  if (!token) return null;
  const [payload, receivedSignature] = token.split(".");
  if (!payload || !receivedSignature || receivedSignature !== await signature(payload)) return null;
  try {
    const parsed = JSON.parse(decode64url(payload)) as { userId: string; expiresAt: number };
    if (parsed.expiresAt < Date.now()) return null;
    const user = MOCK_USERS.find((candidate) => candidate.id === parsed.userId && candidate.status === "Active");
    return user ? publicUser(user) : null;
  } catch {
    return null;
  }
}
