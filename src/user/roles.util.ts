import { UserKind } from './user-kind.enum';
import { normalizeUserKind } from './user-kind.util';

/** Staff and ops roles that can manage orders, dispatch, etc. */
export const STAFF_OPERATION_ROLES: UserKind[] = [
  UserKind.ADMIN,
  UserKind.SUPER_ADMIN,
  UserKind.OPS_HEAD,
  UserKind.BRANCH_MANAGER,
  UserKind.BRANCH_STAFF,
  UserKind.STAFF,
];

/** Roles that see their own orders on GET /orders */
export const ORDER_CUSTOMER_ROLES: UserKind[] = [
  UserKind.CUSTOMER,
  UserKind.DESIGNER,
  UserKind.USER,
];

/** Catalogue write operations per spec (admin only, not ops head). */
export const CATALOGUE_ADMIN_ROLES: UserKind[] = [
  UserKind.SUPER_ADMIN,
  UserKind.ADMIN,
];

export const USER_MANAGEMENT_ROLES: UserKind[] = [
  UserKind.SUPER_ADMIN,
  UserKind.ADMIN,
  UserKind.OPS_HEAD,
  UserKind.BRANCH_MANAGER,
  UserKind.BRANCH_STAFF,
  UserKind.STAFF,
];

/** Global roles that may work across branches. */
export const GLOBAL_OPERATION_ROLES: UserKind[] = [
  UserKind.SUPER_ADMIN,
  UserKind.OPS_HEAD,
];

/** Branch admin equivalents during the migration from `branch_manager` naming. */
export const BRANCH_ADMIN_ROLES: UserKind[] = [
  UserKind.ADMIN,
  UserKind.BRANCH_MANAGER,
];

/** Branch CRUD per spec: super admin only */
export const BRANCH_CRUD_ROLES: UserKind[] = [
  UserKind.SUPER_ADMIN,
];

export const ANALYTICS_ROLES: UserKind[] = [
  UserKind.SUPER_ADMIN,
  UserKind.OPS_HEAD,
];

export const DESIGNER_APPROVAL_ROLES: UserKind[] = [
  UserKind.SUPER_ADMIN,
  UserKind.ADMIN,
  UserKind.OPS_HEAD,
];

export const DESIGNER_VIEW_ROLES: UserKind[] = [
  UserKind.SUPER_ADMIN,
  UserKind.ADMIN,
  UserKind.OPS_HEAD,
  UserKind.STAFF,
];

export const PAYOUT_ADMIN_ROLES: UserKind[] = [
  UserKind.SUPER_ADMIN,
  UserKind.ADMIN,
  UserKind.OPS_HEAD,
];

export const AUDIT_VIEW_ROLES: UserKind[] = [
  UserKind.SUPER_ADMIN,
  UserKind.OPS_HEAD,
];

export function isStaffOperationRole(kind: UserKind): boolean {
  const normalized = normalizeUserKind(kind);
  return normalized ? STAFF_OPERATION_ROLES.includes(normalized) : false;
}

export function isOrderCustomerRole(kind: UserKind): boolean {
  const normalized = normalizeUserKind(kind);
  return normalized ? ORDER_CUSTOMER_ROLES.includes(normalized) : false;
}

export function isGlobalOperationRole(kind: UserKind): boolean {
  const normalized = normalizeUserKind(kind);
  return normalized ? GLOBAL_OPERATION_ROLES.includes(normalized) : false;
}

export function isBranchAdminRole(kind: UserKind): boolean {
  const normalized = normalizeUserKind(kind);
  return normalized ? BRANCH_ADMIN_ROLES.includes(normalized) : false;
}
