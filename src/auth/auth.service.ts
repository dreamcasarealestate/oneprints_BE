import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import type { StringValue } from 'ms';
import * as bcrypt from 'bcrypt';
import { randomInt, randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { UsersService } from '../user/users.service';
import { UserKind } from '../user/user-kind.enum';
import { normalizeKnownUserKind, normalizeUserKind } from '../user/user-kind.util';
import { Designer } from '../designer/designer.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './strategies/jwt.strategy';

type RefreshTokenPayload = {
  sub: string;
  email: string;
  typ?: string;
  jti: string;
};

@Injectable()
export class AuthService {
  private readonly revokedRefreshJti = new Set<string>();
  private readonly passwordOtps = new Map<
    string,
    { codeHash: string; exp: number }
  >();

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(Designer)
    private readonly designerRepo: Repository<Designer>,
  ) {}

  /**
   * Self-heals legacy accounts whose `userKind` was never flipped to `designer`
   * after their designer profile was approved (e.g. older promotion code paths
   * that didn't persist reliably). Runs at login so the issued token always
   * reflects the correct role.
   */
  private async reconcileDesignerKind(user: {
    id: string;
    email: string;
    userKind: UserKind;
  }): Promise<UserKind> {
    const current = normalizeKnownUserKind(user.userKind);
    if (current !== UserKind.USER) {
      return current;
    }
    const email = user.email.trim().toLowerCase();
    const designer = await this.designerRepo
      .createQueryBuilder('d')
      .where('d.status = :st', { st: 'approved' })
      .andWhere('(d.userId = :uid OR LOWER(d.email) = :email)', {
        uid: user.id,
        email,
      })
      .orderBy('d.approvedAt', 'DESC')
      .getOne();
    if (!designer) {
      return current;
    }
    const promoted = await this.usersService.promoteCustomerToDesignerByEmail(
      email,
    );
    if (!promoted) {
      return current;
    }
    if (!designer.userId) {
      designer.userId = promoted.id;
      await this.designerRepo.save(designer);
    }
    return UserKind.DESIGNER;
  }

  async register(dto: RegisterDto) {
    const requestedKind = normalizeUserKind(dto.userKind) ?? UserKind.USER;
    if (
      dto.userKind &&
      requestedKind !== UserKind.USER &&
      requestedKind !== UserKind.CUSTOMER
    ) {
      throw new BadRequestException(
        'Self-registration can only create customer accounts',
      );
    }

    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const username = await this.usersService.generateUniqueUsername(
      dto.firstName,
      dto.lastName,
    );
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create({
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      username,
      email: dto.email.trim().toLowerCase(),
      phoneNumber: dto.phoneNumber.trim(),
      passwordHash,
      userKind: UserKind.USER,
    });
    const { passwordHash: _, ...safe } = user;
    return this.issueTokens(safe);
  }

  /**
   * Returns the up-to-date user record for the authenticated principal,
   * reconciling stale `userKind` against the designer profile so the storefront
   * session always reflects the canonical role.
   */
  async getCurrentUser<
    T extends { id: string; email: string; userKind: UserKind },
  >(user: T): Promise<T> {
    const reconciledKind = await this.reconcileDesignerKind(user);
    if (reconciledKind !== user.userKind) {
      user.userKind = reconciledKind;
    }
    return user;
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const reconciledKind = await this.reconcileDesignerKind(user);
    user.userKind = reconciledKind;

    // Hard-deleted accounts cannot sign in.
    if (user.deletedAt) {
      throw new UnauthorizedException(
        'This account has been permanently deleted.',
      );
    }

    // If the account was deactivated or scheduled for deletion, signing in
    // cancels the action and reactivates the account.
    if (user.isActive === false || user.deletionScheduledAt) {
      await this.usersService.reactivateOwnAccount(user.id);
      user.isActive = true;
      user.deactivatedAt = null;
      user.deletionScheduledAt = null;
    }

    const { passwordHash: _, ...safe } = user;
    return this.issueTokens(safe as typeof user);
  }

  async refresh(refreshToken: string) {
    let payload: RefreshTokenPayload;
    try {
      payload = this.jwtService.verify<RefreshTokenPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.typ !== 'refresh' || !payload.jti) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (this.revokedRefreshJti.has(payload.jti)) {
      throw new UnauthorizedException('Session ended');
    }
    const user = await this.usersService.findById(payload.sub);
    if (!user || user.email !== payload.email) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    this.revokedRefreshJti.add(payload.jti);
    const reconciledKind = await this.reconcileDesignerKind(user);
    user.userKind = reconciledKind;
    const { passwordHash: _, ...safe } = user;
    return this.issueTokens(safe);
  }

  logout(refreshToken?: string) {
    if (!refreshToken?.trim()) {
      return { ok: true };
    }
    try {
      const payload = this.jwtService.verify<RefreshTokenPayload>(
        refreshToken.trim(),
      );
      if (payload.typ === 'refresh' && payload.jti) {
        this.revokedRefreshJti.add(payload.jti);
      }
    } catch {
      /* ignore invalid token on logout */
    }
    return { ok: true };
  }

  async forgotPassword(email: string) {
    const normalized = email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(normalized);
    if (user) {
      const otp = String(randomInt(100_000, 1_000_000));
      const codeHash = await bcrypt.hash(otp, 8);
      const ttlMs = 15 * 60 * 1000;
      this.passwordOtps.set(normalized, {
        codeHash,
        exp: Date.now() + ttlMs,
      });
      if (this.config.get<string>('NODE_ENV') !== 'production') {
        // Dev convenience — wire email provider in production
        // eslint-disable-next-line no-console
        console.info(`[auth] Password reset OTP for ${normalized}: ${otp}`);
      }
    }
    return {
      message:
        'If an account exists for this email, a reset code has been sent.',
    };
  }

  async resetPassword(email: string, otp: string, newPassword: string) {
    const normalized = email.trim().toLowerCase();
    const entry = this.passwordOtps.get(normalized);
    if (!entry || entry.exp < Date.now()) {
      this.passwordOtps.delete(normalized);
      throw new BadRequestException('Invalid or expired code');
    }
    const ok = await bcrypt.compare(otp.trim(), entry.codeHash);
    if (!ok) {
      throw new BadRequestException('Invalid or expired code');
    }
    const user = await this.usersService.findByEmailWithPassword(normalized);
    if (!user) {
      this.passwordOtps.delete(normalized);
      throw new BadRequestException('Invalid or expired code');
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.usersService.setPasswordHashByEmail(normalized, passwordHash);
    this.passwordOtps.delete(normalized);
    return { message: 'Password updated. You can sign in with the new password.' };
  }

  private issueTokens(user: {
    id: string;
    email: string;
    userKind: UserKind;
    firstName: string;
    lastName: string;
    username: string;
    phoneNumber: string;
    profileImage?: string | null;
    branchId?: string | null;
  }) {
    const accessTtl =
      this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '30d';
    const refreshTtl =
      this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';

    const accessPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      userKind: normalizeUserKind(user.userKind) ?? user.userKind,
      branchId: user.branchId ?? null,
    };
    const jti = randomUUID();
    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      email: user.email,
      typ: 'refresh',
      jti,
    };

    const access_token = this.jwtService.sign(accessPayload, {
      expiresIn: accessTtl as StringValue,
    });
    const refresh_token = this.jwtService.sign(refreshPayload, {
      expiresIn: refreshTtl as StringValue,
    });

    return {
      access_token,
      refresh_token,
      token_type: 'Bearer' as const,
      user: {
        id: user.id,
        email: user.email,
        userKind: normalizeUserKind(user.userKind) ?? user.userKind,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        phoneNumber: user.phoneNumber,
        profileImage: user.profileImage ?? null,
        branchId: user.branchId ?? null,
      },
    };
  }
}
