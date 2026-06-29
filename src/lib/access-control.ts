export const INTERNAL_ROLES = ["SUPER_ADMIN", "ADMIN", "CSKH", "DEALER", "KTV"] as const;
export type InternalRole = (typeof INTERNAL_ROLES)[number];

export const ROLE_HOME: Record<InternalRole, string> = {
  SUPER_ADMIN: "/super-admin",
  ADMIN: "/admin/executive",
  CSKH: "/csos",
  DEALER: "/agent-portal",
  KTV: "/technician-portal",
};

export const ROLE_LABEL: Record<InternalRole, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin vận hành",
  CSKH: "Nhân viên CSKH",
  DEALER: "Đại lý",
  KTV: "Kỹ thuật viên",
};

export const PROTECTED_ROUTE_RULES: Array<{ prefix: string; roles: InternalRole[] }> = [
  { prefix: "/super-admin", roles: ["SUPER_ADMIN"] },
  { prefix: "/admin", roles: ["ADMIN"] },
  { prefix: "/cskh", roles: ["CSKH"] },
  { prefix: "/csos", roles: ["CSKH"] },
  { prefix: "/agent-portal", roles: ["DEALER"] },
  { prefix: "/technician-portal", roles: ["KTV"] },
  { prefix: "/activate", roles: ["DEALER", "KTV"] },
  { prefix: "/service-report", roles: ["DEALER", "KTV"] },
  { prefix: "/customer-map", roles: ["ADMIN", "CSKH"] },
  { prefix: "/dealer-map", roles: ["ADMIN", "CSKH"] },
  { prefix: "/operations-map", roles: ["ADMIN", "CSKH"] },
];

export function isInternalRole(value: unknown): value is InternalRole {
  return typeof value === "string" && INTERNAL_ROLES.includes(value as InternalRole);
}

export function homeForRole(role: string | null | undefined) {
  return isInternalRole(role) ? ROLE_HOME[role] : "/login";
}

export function rolesForPath(pathname: string) {
  return PROTECTED_ROUTE_RULES.find((rule) => pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`))?.roles || null;
}

export function canRoleAccessPath(role: string | null | undefined, pathname: string) {
  if (!isInternalRole(role) || !pathname.startsWith("/") || pathname.startsWith("//")) return false;
  const roles = rolesForPath(pathname);
  return Boolean(roles?.includes(role));
}
