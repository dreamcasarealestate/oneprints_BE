import { SetMetadata } from '@nestjs/common';
import { UserKind } from '../../user/user-kind.enum';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserKind[]) => SetMetadata(ROLES_KEY, roles);
