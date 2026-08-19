export type WorkspaceKey = "administration" | "healthcare";

export type Workspace = {
  id: WorkspaceKey;
  name: string;
  description: string;
};

export type Permission = {
  id: string;
  name: string;
  group: "Athlete Permissions" | "Clinical Permissions" | "Administration Permissions";
  description: string;
};

export type ProfessionalRole = {
  id: string;
  name: string;
  description: string;
  defaultPermissionIds: string[];
  active: boolean;
};

export type AccessRole = {
  id: string;
  name: string;
  description: string;
  permissionIds: string[];
  userCount: number;
};

export type PortalUser = {
  id: string;
  fullName: string;
  username: string;
  email: string;
  phoneNumber: string;
  professionalRoleId: string;
  professionalRole: string;
  clinicCity: "Riyadh" | "Jeddah" | "Dammam";
  jobTitle: string;
  department: string;
  status: "Active" | "Inactive";
  workspaceIds: WorkspaceKey[];
  roleIds: string[];
  permissionIds: string[];
  permissionOverrides: { grant: string[]; revoke: string[] };
  lastActive: string;
};

export type AuditEntry = {
  id: string;
  username: string;
  action: string;
  target: string;
  createdAt: string;
};

export const WORKSPACES: Workspace[] = [
  { id: "administration", name: "Administration", description: "People, access, governance, and system configuration." },
  { id: "healthcare", name: "Healthcare Workspace", description: "Multidisciplinary athlete care and clinical records." },
];

export const PERMISSIONS: Permission[] = [
  { id: "athletes.view", name: "View Athletes", group: "Athlete Permissions", description: "Open the athlete directory and profiles." },
  { id: "athletes.create", name: "Create Athletes", group: "Athlete Permissions", description: "Register new athlete profiles." },
  { id: "athletes.edit", name: "Edit Athletes", group: "Athlete Permissions", description: "Update athlete demographics and status." },
  { id: "athletes.delete", name: "Delete Athletes", group: "Athlete Permissions", description: "Remove athlete profiles." },
  { id: "clinical.records.view", name: "View Medical Records", group: "Clinical Permissions", description: "Read multidisciplinary medical records." },
  { id: "clinical.notes.create", name: "Create Clinical Care Records", group: "Clinical Permissions", description: "Create encounters, injury episodes, rehabilitation plans, and sessions." },
  { id: "clinical.notes.edit", name: "Update Clinical Care Records", group: "Clinical Permissions", description: "Amend encounters and update injury or rehabilitation pathways." },
  { id: "admin.users.manage", name: "Manage Users", group: "Administration Permissions", description: "Create, update, suspend, and delete user accounts." },
  { id: "admin.professional_roles.manage", name: "Manage Professional Roles", group: "Administration Permissions", description: "Maintain the professional role directory." },
  { id: "admin.permissions.manage", name: "Manage Permissions", group: "Administration Permissions", description: "Maintain roles, permissions, and overrides." },
  { id: "admin.audit.view", name: "View Audit Logs", group: "Administration Permissions", description: "Review sensitive system actions." },
  { id: "admin.settings.manage", name: "Manage Reports & Branding", group: "Administration Permissions", description: "Configure the medical report template, logos, and stamp." },
];

const PERMISSION_DEPENDENCIES: Record<string, string[]> = {
  "athletes.create": ["athletes.view"],
  "athletes.edit": ["athletes.view"],
  "athletes.delete": ["athletes.view"],
  "clinical.records.view": ["athletes.view"],
  "clinical.notes.create": ["athletes.view", "clinical.records.view"],
  "clinical.notes.edit": ["athletes.view", "clinical.records.view"],
};

export function normalizePermissionIds(permissionIds: string[]) {
  const allowed = new Set(PERMISSIONS.map((permission) => permission.id));
  const normalized = new Set(permissionIds.filter((id) => allowed.has(id)));
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of [...normalized]) {
      for (const dependency of PERMISSION_DEPENDENCIES[id] ?? []) {
        if (!normalized.has(dependency)) { normalized.add(dependency); changed = true; }
      }
    }
  }
  return [...normalized];
}

export function togglePermissionId(permissionIds: string[], id: string) {
  if (!permissionIds.includes(id)) return normalizePermissionIds([...permissionIds, id]);
  const next = new Set(permissionIds.filter((permissionId) => permissionId !== id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const permissionId of [...next]) {
      if ((PERMISSION_DEPENDENCIES[permissionId] ?? []).some((dependency) => !next.has(dependency))) {
        next.delete(permissionId);
        changed = true;
      }
    }
  }
  return [...next];
}

const clinicalDefaults = ["athletes.view", "clinical.records.view", "clinical.notes.create", "clinical.notes.edit"];

export const PROFESSIONAL_ROLES: ProfessionalRole[] = [
  { id: "pr-sports-medicine", name: "Sports Medicine Physician", description: "Sports medicine assessment, diagnosis, and return-to-sport care.", defaultPermissionIds: clinicalDefaults, active: true },
  { id: "pr-family", name: "Family Physician", description: "Primary and family medicine within athlete care.", defaultPermissionIds: clinicalDefaults, active: true },
  { id: "pr-physio", name: "Physiotherapist", description: "Rehabilitation, function, and movement care.", defaultPermissionIds: clinicalDefaults, active: true },
  { id: "pr-nutrition", name: "Sports Nutritionist", description: "Performance nutrition and athlete wellbeing.", defaultPermissionIds: clinicalDefaults, active: true },
  { id: "pr-psychology", name: "Sports Psychologist", description: "Mental health and performance psychology.", defaultPermissionIds: clinicalDefaults, active: true },
  { id: "pr-performance", name: "Performance Therapist", description: "Integrated performance therapy and recovery.", defaultPermissionIds: clinicalDefaults, active: true },
];

export const ACCESS_ROLES: AccessRole[] = [
  { id: "role-admin", name: "System Administrator", description: "Full SOPCare administration and clinical access.", permissionIds: PERMISSIONS.map((permission) => permission.id), userCount: 1 },
  { id: "role-clinician", name: "Clinical Practitioner", description: "Standard multidisciplinary clinical access.", permissionIds: clinicalDefaults, userCount: 2 },
  { id: "role-readonly", name: "Clinical Viewer", description: "Read-only athlete and medical record access.", permissionIds: ["athletes.view", "clinical.records.view"], userCount: 1 },
];

export const MOCK_USERS: PortalUser[] = [
  { id: "user-admin", fullName: "Demo Administrator", username: "admin", email: "admin@example.invalid", phoneNumber: "Not applicable", professionalRoleId: "pr-sports-medicine", professionalRole: "Sports Medicine Physician", clinicCity: "Riyadh", jobTitle: "Medical Director", department: "Sports Medicine", status: "Active", workspaceIds: ["administration", "healthcare"], roleIds: ["role-admin"], permissionIds: PERMISSIONS.map((permission) => permission.id), permissionOverrides: { grant: [], revoke: [] }, lastActive: "2026-08-07T08:34:00+03:00" },
  { id: "user-lina", fullName: "Demo Clinician", username: "dr.lina", email: "clinician@example.invalid", phoneNumber: "Not applicable", professionalRoleId: "pr-sports-medicine", professionalRole: "Sports Medicine Physician", clinicCity: "Riyadh", jobTitle: "Consultant", department: "Sports Medicine", status: "Active", workspaceIds: ["healthcare"], roleIds: ["role-clinician"], permissionIds: clinicalDefaults, permissionOverrides: { grant: [], revoke: [] }, lastActive: "2026-08-07T07:58:00+03:00" },
  { id: "user-noura", fullName: "Demo Psychologist", username: "dr.noura", email: "psychologist@example.invalid", phoneNumber: "Not applicable", professionalRoleId: "pr-psychology", professionalRole: "Sports Psychologist", clinicCity: "Jeddah", jobTitle: "Sports Psychologist", department: "Psychology", status: "Active", workspaceIds: ["healthcare"], roleIds: ["role-clinician"], permissionIds: clinicalDefaults, permissionOverrides: { grant: [], revoke: [] }, lastActive: "2026-08-06T15:20:00+03:00" },
  { id: "user-viewer", fullName: "Demo Viewer", username: "viewer", email: "viewer@example.invalid", phoneNumber: "Not applicable", professionalRoleId: "pr-nutrition", professionalRole: "Sports Nutritionist", clinicCity: "Dammam", jobTitle: "Sports Nutritionist", department: "Performance Health", status: "Inactive", workspaceIds: ["healthcare"], roleIds: ["role-readonly"], permissionIds: ["athletes.view", "clinical.records.view"], permissionOverrides: { grant: [], revoke: [] }, lastActive: "2026-07-29T11:10:00+03:00" },
];

export const MOCK_AUDIT_LOGS: AuditEntry[] = [
  { id: "audit-1", username: "admin", action: "Updated permissions", target: "Clinical Practitioner", createdAt: "2026-08-07T08:12:00+03:00" },
  { id: "audit-2", username: "admin", action: "Activated athlete", target: "Demo Athlete 01", createdAt: "2026-08-06T14:46:00+03:00" },
  { id: "audit-3", username: "dr.lina", action: "Created clinical note", target: "Demo Athlete 03", createdAt: "2026-08-05T10:25:00+03:00" },
  { id: "audit-4", username: "admin", action: "Updated professional role", target: "Performance Therapist", createdAt: "2026-08-04T09:04:00+03:00" },
];

export function effectivePermissions(user: PortalUser) {
  return Array.from(new Set([...user.permissionIds, ...user.permissionOverrides.grant])).filter((id) => !user.permissionOverrides.revoke.includes(id));
}

export function publicUser(user: PortalUser) {
  return { ...user, permissionIds: effectivePermissions(user) };
}
