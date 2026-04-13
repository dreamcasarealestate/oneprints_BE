import { UserKind } from './user-kind.enum';
import { normalizeKnownUserKind } from './user-kind.util';

/** Maps `User.userKind` string to `roles.key` */
export function userKindToRoleKey(kind: UserKind): string {
  switch (normalizeKnownUserKind(kind)) {
    case UserKind.USER:
      return 'customer';
    case UserKind.DESIGNER:
      return 'designer';
    case UserKind.STAFF:
      return 'branch_staff';
    case UserKind.ADMIN:
      return 'admin';
    case UserKind.OPS_HEAD:
      return 'ops_head';
    case UserKind.SUPER_ADMIN:
      return 'super_admin';
    default:
      return kind as string;
  }
}
