export enum UserKind {
  USER = 'user',
  /** @deprecated Prefer SUPER_ADMIN for new accounts; treated as global in UI */
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
  OPS_HEAD = 'ops_head',
  BRANCH_MANAGER = 'branch_manager',
  STAFF = 'staff',
}
