import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { Role } from './role.entity';
import { UserKind } from './user-kind.enum';
import { userKindToRoleKey } from './role-key.util';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { isBranchAdminRole, isGlobalOperationRole } from './roles.util';
import { normalizeKnownUserKind, normalizeUserKind } from './user-kind.util';

export type CreateUserInternal = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phoneNumber: string;
  passwordHash: string;
  userKind: UserKind;
  branchId?: string | null;
};

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
  ) {}

  async ensureRoleRows(): Promise<void> {
    const keys = [
      'customer',
      'designer',
      'branch_staff',
      'branch_manager',
      'ops_head',
      'super_admin',
      'admin',
    ];
    for (const key of keys) {
      const row = await this.roleRepo.findOne({ where: { key } });
      if (!row) {
        await this.roleRepo.save(this.roleRepo.create({ key }));
      }
    }
  }

  async syncAllUserRoleIds(): Promise<void> {
    await this.ensureRoleRows();
    const users = await this.usersRepo.find({
      select: ['id', 'userKind', 'roleId'],
    });
    for (const u of users) {
      const roleId = await this.resolveRoleId(u.userKind);
      if (u.roleId !== roleId) {
        u.roleId = roleId;
        await this.usersRepo.save(u);
      }
    }
  }

  private async resolveRoleId(kind: UserKind): Promise<string | null> {
    const key = userKindToRoleKey(normalizeKnownUserKind(kind));
    const r = await this.roleRepo.findOne({ where: { key } });
    return r?.id ?? null;
  }

  async create(data: CreateUserInternal): Promise<User> {
    const userKind = data.userKind;
    const roleId = await this.resolveRoleId(userKind);
    const entity = this.usersRepo.create({
      ...data,
      userKind,
      roleId,
      branchId: data.branchId ?? null,
    });
    return this.usersRepo.save(entity);
  }

  private async createUnscopedUser(dto: CreateUserDto): Promise<User> {
    const kind = dto.userKind ?? UserKind.USER;
    const email = dto.email.trim().toLowerCase();
    const username =
      dto.username?.trim() ||
      (await this.generateUniqueUsername(dto.firstName, dto.lastName));

    await this.ensureRoleRows();
    await this.ensureEmailAvailable(email);
    await this.ensureUsernameAvailable(username);

    return this.create({
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      username,
      email,
      phoneNumber: dto.phoneNumber.trim(),
      passwordHash: await bcrypt.hash(dto.password, 10),
      userKind: kind,
      branchId: dto.branchId?.trim() || null,
    });
  }

  private isBranchScopedOperator(kind: UserKind): boolean {
    const normalized = normalizeUserKind(kind);
    return isBranchAdminRole(kind) || normalized === UserKind.STAFF;
  }

  private resolveTargetBranchIdForWrite(
    actor: User,
    dtoBranchId?: string,
  ): string | null {
    if (isGlobalOperationRole(normalizeKnownUserKind(actor.userKind))) {
      const trimmed = dtoBranchId?.trim();
      if (!trimmed) {
        throw new BadRequestException(
          'branchId is required when using a global account (super_admin / ops_head). Select a branch in the admin UI and send it in the payload.',
        );
      }
      return trimmed;
    }
    if (!this.isBranchScopedOperator(actor.userKind)) {
      throw new ForbiddenException();
    }
    if (!actor.branchId) {
      throw new BadRequestException(
        'Your account has no branch assignment. Ask a super admin to set branchId on your user row, or use a global role.',
      );
    }
    return actor.branchId;
  }

  private assertCreatableUserKind(actor: User, kind: UserKind): void {
    const normalizedActorKind = normalizeKnownUserKind(actor.userKind);
    const normalizedTargetKind = normalizeKnownUserKind(kind);
    if (normalizedActorKind === UserKind.ADMIN) {
      return;
    }
    if (
      normalizedTargetKind === UserKind.SUPER_ADMIN &&
      normalizedActorKind !== UserKind.SUPER_ADMIN
    ) {
      throw new ForbiddenException(
        'Only super_admin can create super_admin users',
      );
    }
    if (isGlobalOperationRole(normalizedActorKind)) {
      const blocked = [UserKind.CUSTOMER, UserKind.USER, UserKind.DESIGNER];
      if (blocked.includes(normalizedTargetKind)) {
        throw new BadRequestException(
          'Cannot create storefront-only roles from admin user management',
        );
      }
      return;
    }
    if (isBranchAdminRole(normalizedActorKind)) {
      const allowed = [UserKind.ADMIN, UserKind.STAFF];
      if (!allowed.includes(normalizedTargetKind)) {
        throw new BadRequestException(
          'You can only create admin or staff users for your branch',
        );
      }
      return;
    }
    if (normalizedActorKind === UserKind.STAFF) {
      const allowed = [UserKind.STAFF];
      if (!allowed.includes(normalizedTargetKind)) {
        throw new BadRequestException('You can only create staff users');
      }
      return;
    }
    throw new ForbiddenException();
  }

  private assertActorCanAccessUserRow(actor: User, target: User): void {
    const normalizedActorKind = normalizeKnownUserKind(actor.userKind);
    if (isGlobalOperationRole(normalizedActorKind)) {
      return;
    }
    if (!this.isBranchScopedOperator(normalizedActorKind)) {
      throw new ForbiddenException();
    }
    if (!actor.branchId) {
      throw new BadRequestException('Your account has no branch assignment.');
    }
    if (target.branchId !== actor.branchId) {
      throw new ForbiddenException('User belongs to another branch');
    }
  }

  async createManagedUser(dto: CreateUserDto, actor?: User) {
    if (!actor) {
      const user = await this.createUnscopedUser(dto);
      return this.toSafeUser(user);
    }

    const email = dto.email.trim().toLowerCase();
    const username =
      dto.username?.trim() ||
      (await this.generateUniqueUsername(dto.firstName, dto.lastName));

    await this.ensureEmailAvailable(email);
    await this.ensureUsernameAvailable(username);

    const kind = dto.userKind ?? UserKind.STAFF;
    this.assertCreatableUserKind(actor, kind);
    const branchId = this.resolveTargetBranchIdForWrite(actor, dto.branchId);

    const user = await this.create({
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      username,
      email,
      phoneNumber: dto.phoneNumber.trim(),
      passwordHash: await bcrypt.hash(dto.password, 10),
      userKind: kind,
      branchId,
    });

    return this.toSafeUser(user);
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { id } });
  }

  async findByEmailOrUsername(
    email: string,
    username: string,
  ): Promise<User | null> {
    return this.usersRepo.findOne({
      where: [{ email }, { username }],
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email } });
  }

  /**
   * When a designer application is approved, link the storefront account that
   * registered with the same email and promote the role to designer.
   *
   * Uses a direct UPDATE query rather than entity save() so that the role flip
   * persists reliably even when the entity was loaded without `select: false`
   * columns (passwordHash) — those omitted columns can otherwise interfere
   * with TypeORM's diff/save behaviour.
   */
  async promoteCustomerToDesignerByEmail(email: string): Promise<User | null> {
    await this.ensureRoleRows();
    const normalized = email.trim().toLowerCase();
    const user = await this.findByEmail(normalized);
    if (!user) {
      return null;
    }
    const currentKind = normalizeKnownUserKind(user.userKind);
    if (currentKind === UserKind.DESIGNER) {
      return user;
    }
    if (currentKind !== UserKind.USER) {
      // admin / staff / ops — never auto-flip these to designer.
      return null;
    }
    const roleId = await this.resolveRoleId(UserKind.DESIGNER);
    await this.usersRepo.update(
      { id: user.id },
      { userKind: UserKind.DESIGNER, roleId },
    );
    user.userKind = UserKind.DESIGNER;
    user.roleId = roleId;
    return user;
  }

  async demoteDesignerToUserById(userId: string): Promise<User | null> {
    await this.ensureRoleRows();
    const user = await this.findById(userId);
    if (!user) {
      return null;
    }
    if (normalizeKnownUserKind(user.userKind) !== UserKind.DESIGNER) {
      return user;
    }
    const roleId = await this.resolveRoleId(UserKind.USER);
    await this.usersRepo.update(
      { id: user.id },
      { userKind: UserKind.USER, roleId },
    );
    user.userKind = UserKind.USER;
    user.roleId = roleId;
    return user;
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { username } });
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.usersRepo.findOne({
      where: { email },
      select: [
        'id',
        'firstName',
        'lastName',
        'username',
        'email',
        'phoneNumber',
        'profileImage',
        'userKind',
        'roleId',
        'branchId',
        'passwordHash',
        'isActive',
        'deactivatedAt',
        'deletionScheduledAt',
        'deletedAt',
        'createdAt',
        'updatedAt',
      ],
    });
  }

  async countByKind(kind: UserKind): Promise<number> {
    const normalized = normalizeKnownUserKind(kind);
    const variants: UserKind[] =
      normalized === UserKind.USER
        ? [UserKind.USER, UserKind.CUSTOMER]
        : normalized === UserKind.ADMIN
          ? [UserKind.ADMIN, UserKind.BRANCH_MANAGER]
          : normalized === UserKind.STAFF
            ? [UserKind.STAFF, UserKind.BRANCH_STAFF]
            : [normalized];
    return this.usersRepo.count({
      where: variants.map((userKind) => ({ userKind })),
    });
  }

  async findAll() {
    return this.usersRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findAllForActor(actor: User, queryBranchId?: string) {
    const qb = this.usersRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.branch', 'branch')
      .orderBy('u.createdAt', 'DESC');

    if (isGlobalOperationRole(normalizeKnownUserKind(actor.userKind))) {
      const trimmed = queryBranchId?.trim();
      if (trimmed) {
        qb.where('u.branchId = :bid', { bid: trimmed });
      }
    } else if (
      this.isBranchScopedOperator(normalizeKnownUserKind(actor.userKind))
    ) {
      if (!actor.branchId) {
        throw new BadRequestException('Your account has no branch assignment.');
      }
      qb.where('u.branchId = :bid', { bid: actor.branchId });
    } else {
      throw new ForbiddenException();
    }

    const rows = await qb.getMany();
    return rows.map((u) => this.toSafeUser(u));
  }

  /** Normalize legacy enum strings stored before role rename (idempotent). */
  async normalizeLegacyUserKinds(): Promise<void> {
    await this.usersRepo.query(
      `UPDATE "users" SET "userKind" = $1 WHERE "userKind" = $2`,
      [UserKind.USER, UserKind.CUSTOMER],
    );
    await this.usersRepo.query(
      `UPDATE "users" SET "userKind" = $1 WHERE "userKind" = $2`,
      [UserKind.STAFF, UserKind.BRANCH_STAFF],
    );
    await this.usersRepo.query(
      `UPDATE "users" SET "userKind" = $1 WHERE "userKind" = $2`,
      [UserKind.ADMIN, UserKind.BRANCH_MANAGER],
    );
  }

  async updateNotificationPreferences(
    userId: string,
    prefs: Record<string, unknown>,
  ) {
    const user = await this.findOneOrFail(userId);
    user.notificationPreferences = {
      ...(user.notificationPreferences ?? {}),
      ...prefs,
    };
    await this.usersRepo.save(user);
    return user.notificationPreferences;
  }

  getNotificationPreferences(userId: string) {
    return this.findOneOrFail(userId).then((u) => u.notificationPreferences);
  }

  async setPasswordHashByEmail(email: string, passwordHash: string) {
    const user = await this.findByEmailWithPassword(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.passwordHash = passwordHash;
    await this.usersRepo.save(user);
  }

  async findOneOrFail(id: string) {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findOneOrFailForActor(id: string, actor: User) {
    const user = await this.findOneOrFail(id);
    this.assertActorCanAccessUserRow(actor, user);
    return this.toSafeUser(user);
  }

  async updateManagedUser(id: string, dto: UpdateUserDto, actor: User) {
    const user = await this.findOneOrFail(id);
    this.assertActorCanAccessUserRow(actor, user);
    const nextEmail = dto.email?.trim().toLowerCase();
    const nextUsername = dto.username?.trim();

    if (nextEmail && nextEmail !== user.email) {
      await this.ensureEmailAvailable(nextEmail);
      user.email = nextEmail;
    }

    if (nextUsername && nextUsername !== user.username) {
      await this.ensureUsernameAvailable(nextUsername);
      user.username = nextUsername;
    }

    if (dto.firstName !== undefined) {
      user.firstName = dto.firstName.trim();
    }

    if (dto.lastName !== undefined) {
      user.lastName = dto.lastName.trim();
    }

    if (dto.phoneNumber !== undefined) {
      user.phoneNumber = dto.phoneNumber.trim();
    }

    if (
      dto.userKind &&
      normalizeKnownUserKind(dto.userKind) !==
        normalizeKnownUserKind(user.userKind)
    ) {
      const nextKind = dto.userKind as UserKind;
      this.assertCreatableUserKind(actor, nextKind);
      await this.ensureAdminStillExists(user.userKind, nextKind);
      user.userKind = nextKind;
      user.roleId = await this.resolveRoleId(nextKind);
    }

    if (dto.branchId !== undefined) {
      if (!isGlobalOperationRole(normalizeKnownUserKind(actor.userKind))) {
        throw new ForbiddenException('Only global roles can change branchId');
      }
      user.branchId = dto.branchId;
    }

    if (dto.password) {
      const withPassword = await this.findByEmailWithPassword(user.email);
      if (!withPassword) {
        throw new NotFoundException('User not found');
      }
      withPassword.passwordHash = await bcrypt.hash(dto.password, 10);
      await this.usersRepo.save(withPassword);
    }

    const saved = await this.usersRepo.save(user);
    return this.toSafeUser(saved);
  }

  /**
   * Self-service profile update. Any signed-in user may edit their own basic
   * fields (name, username, email, phone, avatar) and optionally change their
   * password when they provide the current one. Role / branch changes are
   * not allowed here — use the admin endpoints for that.
   */
  async updateOwnProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.findOneOrFail(userId);

    if (dto.firstName !== undefined) {
      const trimmed = dto.firstName.trim();
      if (!trimmed) {
        throw new BadRequestException('First name cannot be empty');
      }
      user.firstName = trimmed;
    }

    if (dto.lastName !== undefined) {
      const trimmed = dto.lastName.trim();
      if (!trimmed) {
        throw new BadRequestException('Last name cannot be empty');
      }
      user.lastName = trimmed;
    }

    if (dto.phoneNumber !== undefined) {
      user.phoneNumber = dto.phoneNumber.trim();
    }

    if (dto.profileImage !== undefined) {
      const trimmed = dto.profileImage?.trim();
      user.profileImage = trimmed ? trimmed : null;
    }

    const nextUsername = dto.username?.trim();
    if (nextUsername && nextUsername !== user.username) {
      await this.ensureUsernameAvailable(nextUsername);
      user.username = nextUsername;
    }

    const nextEmail = dto.email?.trim().toLowerCase();
    const wantsEmailChange = !!nextEmail && nextEmail !== user.email;
    const wantsPasswordChange = !!dto.password;

    if (wantsEmailChange || wantsPasswordChange) {
      if (!dto.currentPassword) {
        throw new BadRequestException(
          'Current password is required to change email or password',
        );
      }
      const withPassword = await this.findByEmailWithPassword(user.email);
      if (!withPassword) {
        throw new NotFoundException('User not found');
      }
      const ok = await bcrypt.compare(
        dto.currentPassword,
        withPassword.passwordHash,
      );
      if (!ok) {
        throw new UnauthorizedException('Current password is incorrect');
      }

      if (wantsEmailChange && nextEmail) {
        await this.ensureEmailAvailable(nextEmail);
        user.email = nextEmail;
      }

      if (wantsPasswordChange && dto.password) {
        withPassword.passwordHash = await bcrypt.hash(dto.password, 10);
        withPassword.email = user.email;
        await this.usersRepo.save(withPassword);
      }
    }

    const saved = await this.usersRepo.save(user);
    return this.toSafeUser(saved);
  }

  async removeManagedUser(id: string, actor?: User) {
    const user = await this.findOneOrFail(id);
    if (actor) {
      this.assertActorCanAccessUserRow(actor, user);
    }
    await this.ensureAdminStillExists(user.userKind, null);
    await this.usersRepo.remove(user);
    return { id, deleted: true };
  }

  /**
   * Self-service account deactivation. The user must confirm with their
   * current password. The row is preserved so they can reactivate later by
   * logging back in (we flip the flag) or by contacting support.
   */
  async deactivateOwnAccount(
    userId: string,
    currentPassword: string,
    reason?: string,
  ) {
    if (!currentPassword?.trim()) {
      throw new BadRequestException(
        'Current password is required to deactivate your account',
      );
    }
    const user = await this.findOneOrFail(userId);
    const withPassword = await this.findByEmailWithPassword(user.email);
    if (!withPassword) {
      throw new NotFoundException('User not found');
    }
    const ok = await bcrypt.compare(currentPassword, withPassword.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (this.isElevatedAdmin(user.userKind)) {
      throw new ForbiddenException(
        'Admin accounts cannot self-deactivate. Contact a super admin.',
      );
    }

    user.isActive = false;
    user.deactivatedAt = new Date();
    if (reason && reason.trim()) {
      user.deletionReason = reason.trim().slice(0, 500);
    }
    await this.usersRepo.save(user);

    return {
      id: user.id,
      isActive: user.isActive,
      deactivatedAt: user.deactivatedAt,
      message:
        'Your account has been deactivated. Sign in again any time to reactivate it.',
    };
  }

  /** Re-enable a previously deactivated account (used during login). */
  async reactivateOwnAccount(userId: string) {
    const user = await this.findOneOrFail(userId);
    if (user.deletedAt) {
      throw new ForbiddenException(
        'This account has been permanently deleted and cannot be reactivated.',
      );
    }
    user.isActive = true;
    user.deactivatedAt = null;
    user.deletionScheduledAt = null;
    await this.usersRepo.save(user);
    return {
      id: user.id,
      isActive: true,
      message: 'Welcome back — your account is active again.',
    };
  }

  /**
   * Self-service account deletion. We schedule a soft-delete (30-day grace
   * window) so the user can recover the account by signing back in. After
   * the grace window a scheduled job hard-deletes the row.
   */
  async requestOwnAccountDeletion(
    userId: string,
    currentPassword: string,
    reason?: string,
  ) {
    if (!currentPassword?.trim()) {
      throw new BadRequestException(
        'Current password is required to delete your account',
      );
    }
    const user = await this.findOneOrFail(userId);
    const withPassword = await this.findByEmailWithPassword(user.email);
    if (!withPassword) {
      throw new NotFoundException('User not found');
    }
    const ok = await bcrypt.compare(currentPassword, withPassword.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (this.isElevatedAdmin(user.userKind)) {
      throw new ForbiddenException(
        'Admin accounts cannot self-delete. Contact a super admin.',
      );
    }

    const now = new Date();
    user.isActive = false;
    user.deactivatedAt = user.deactivatedAt ?? now;
    user.deletionScheduledAt = now;
    if (reason && reason.trim()) {
      user.deletionReason = reason.trim().slice(0, 500);
    }
    await this.usersRepo.save(user);

    const purgeAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return {
      id: user.id,
      scheduledAt: user.deletionScheduledAt,
      purgeAt,
      message:
        'Your account is scheduled for permanent deletion in 30 days. Sign in any time before then to cancel.',
    };
  }

  async generateUniqueUsername(
    firstName: string,
    lastName: string,
    excludeUserId?: string,
  ) {
    const base =
      `${firstName}.${lastName}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '.')
        .replace(/^\.+|\.+$/g, '') || 'user';

    let candidate = base;
    let suffix = 1;

    while (true) {
      const existing = await this.findByUsername(candidate);
      if (!existing || existing.id === excludeUserId) {
        return candidate;
      }

      candidate = `${base}${suffix}`;
      suffix += 1;
    }
  }

  async ensureSeedAdmin(email: string, passwordHash: string): Promise<void> {
    const existing = await this.usersRepo.findOne({ where: { email } });
    if (existing) {
      return;
    }
    await this.usersRepo.save(
      this.usersRepo.create({
        firstName: 'System',
        lastName: 'Admin',
        username: 'admin',
        email,
        phoneNumber: '0000000000',
        userKind: UserKind.SUPER_ADMIN,
        passwordHash,
      }),
    );
  }

  async ensureSeedStaff(email: string, passwordHash: string): Promise<void> {
    const existing = await this.usersRepo.findOne({ where: { email } });
    if (existing) {
      return;
    }
    await this.usersRepo.save(
      this.usersRepo.create({
        firstName: 'Ops',
        lastName: 'Staff',
        username: 'staff',
        email,
        phoneNumber: '0000000001',
        userKind: UserKind.STAFF,
        passwordHash,
      }),
    );
  }

  private toSafeUser(user: User) {
    const plain = user as User & { passwordHash?: string };
    const safe = { ...plain };
    delete safe.passwordHash;
    return safe;
  }

  private async ensureEmailAvailable(email: string) {
    const existing = await this.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email already in use');
    }
  }

  private async ensureUsernameAvailable(username: string) {
    const existing = await this.findByUsername(username);
    if (existing) {
      throw new ConflictException('Username already in use');
    }
  }

  private isElevatedAdmin(kind: UserKind): boolean {
    const normalized = normalizeKnownUserKind(kind);
    return normalized === UserKind.ADMIN || normalized === UserKind.SUPER_ADMIN;
  }

  private async countElevatedAdmins(): Promise<number> {
    const admins = await this.countByKind(UserKind.ADMIN);
    const superAdmins = await this.countByKind(UserKind.SUPER_ADMIN);
    return admins + superAdmins;
  }

  private async ensureAdminStillExists(
    currentKind: UserKind,
    nextKind: UserKind | null,
  ) {
    if (!this.isElevatedAdmin(currentKind)) {
      return;
    }
    const nextIsElevated = nextKind !== null && this.isElevatedAdmin(nextKind);
    if (nextIsElevated) {
      return;
    }

    const elevatedCount = await this.countElevatedAdmins();
    if (elevatedCount <= 1) {
      throw new BadRequestException(
        'At least one super admin or admin account must remain in the system',
      );
    }
  }
}
