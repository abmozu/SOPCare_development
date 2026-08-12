Exit code: 0
Wall time: 0.5 seconds
Output:
import { headers } from "next/headers";
import { MOCK_USERS, publicUser, type PortalUser } from "./access-model";
import { ensureDatabase } from "../db/runtime";

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

export async function hashPassword(password: string) {
  const result = await crypto.subtle.digest("SHA-256", bytes(password));
  return Array.from(new Uint8Array(result), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

type StoredPortalUser = {
  id: string; username: string; password_hash: string; email: string; full_name: string; phone_number: string;
  professional_role_id: string; professional_role: string; job_title: string; department: string; status: "Active" | "Inactive";
  workspace_ids: string; role_ids: string; permission_ids: string; permission_overrides: string; last_active: string;
};

function parseList(value: string) { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []; } catch { return []; } }
function parseOverrides(value: string) { try { const parsed = JSON.parse(value); return { grant: parseList(JSON.stringify(parsed?.grant ?? [])), revoke: parseList(JSON.stringify(parsed?.revoke ?? [])) }; } catch { return { grant: [], revoke: [] }; } }
function portalUser(row: StoredPortalUser): PortalUser {
  return { id: row.id, username: row.username, email: row.email, fullName: row.full_name, phoneNumber: row.phone_number, professionalRoleId: row.professional_role_id, professionalRole: row.professional_role, jobTitle: row.job_title, department: row.department, status: row.status, workspaceIds: parseList(row.workspace_ids) as PortalUser["workspaceIds"], roleIds: parseList(row.role_ids), permissionIds: parseList(row.permission_ids), permissionOverrides: parseOverrides(row.permission_overrides), lastActive: row.last_active };
}

async function storedPortalUserRows() {
  const db = await ensureDatabase();
  const rows = await db.prepare("SELECT id, username, password_hash, email, full_name, phone_number, professional_role_id, professional_role, job_title, department, status, workspace_ids, role_ids, permission_ids, permission_overrides, last_active FROM portal_users ORDER BY created_at DESC").all<StoredPortalUser>();
  return rows.results;
}

export async function storedPortalUsers() {
  return (await storedPortalUserRows()).map(portalUser);
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
  const normalized = username.trim().toLowerCase();
  const stored = (await storedPortalUserRows()).find((candidate) => candidate.username.toLowerCase() === normalized);
  if (stored) return stored.status === "Active" && stored.password_hash === await hashPassword(password) ? publicUser(portalUser(stored)) : null;
  const configuredPassword = process.env.SOPCARE_MOCK_PASSWORD;
  if (!configuredPassword) throw new Error("SOPCARE_MOCK_PASSWORD is required for prototype authentication.");
  const user = MOCK_USERS.find((candidate) => candidate.username.toLowerCase() === normalized);
  if (!user || await hashPassword(configuredPassword) !== await hashPassword(password) || user.status !== "Active") return null;
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
    const user = (await storedPortalUsers()).find((candidate) => candidate.id === parsed.userId && candidate.status === "Active") ?? MOCK_USERS.find((candidate) => candidate.id === parsed.userId && candidate.status === "Active");
    return user ? publicUser(user) : null;
  } catch {
    return null;
  }
}

