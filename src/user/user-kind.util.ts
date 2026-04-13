import { UserKind } from './user-kind.enum';

/**
 * Converts legacy role names into the canonical runtime roles used by the spec.
 * This keeps old records working while new writes converge on `user`/`admin`/`staff`.
 */
export function normalizeUserKind(
  kind: string | null | undefined,
): UserKind | null {
  switch (kind) {
    case UserKind.CUSTOMER:
    case UserKind.USER:
      return UserKind.USER;
    case UserKind.BRANCH_MANAGER:
    case UserKind.ADMIN:
      return UserKind.ADMIN;
    case UserKind.BRANCH_STAFF:
    case UserKind.STAFF:
      return UserKind.STAFF;
    case UserKind.DESIGNER:
      return UserKind.DESIGNER;
    case UserKind.OPS_HEAD:
      return UserKind.OPS_HEAD;
    case UserKind.SUPER_ADMIN:
      return UserKind.SUPER_ADMIN;
    default:
      return null;
  }
}

export function normalizeKnownUserKind(
  kind: string | null | undefined,
): UserKind {
  return normalizeUserKind(kind) ?? (kind as UserKind);
}
