/**
 * Application roles.
 *
 * Canonical target product model:
 * - `super_admin`: global access across all branches
 * - `admin`: branch admin that can use both admin and storefront layouts
 * - `staff`: branch-scoped operational staff
 * - `user`: customer storefront role
 * - `designer`: fashion designer marketplace role
 *
 * Compatibility values (`customer`, `branch_staff`, `branch_manager`) remain while
 * the codebase transitions from the original branch-manager/staff naming.
 */
export enum UserKind {
  CUSTOMER = 'customer',
  DESIGNER = 'designer',
  BRANCH_STAFF = 'branch_staff',
  BRANCH_MANAGER = 'branch_manager',
  OPS_HEAD = 'ops_head',
  SUPER_ADMIN = 'super_admin',
  /** @deprecated Prefer SUPER_ADMIN */
  ADMIN = 'admin',
  /** @deprecated Legacy alias for CUSTOMER — migrated on seed */
  USER = 'user',
  /** @deprecated Legacy alias for BRANCH_STAFF — migrated on seed */
  STAFF = 'staff',
}
