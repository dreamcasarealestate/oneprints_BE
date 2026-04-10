import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { UserKind } from './user-kind.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

export type CreateUserInternal = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phoneNumber: string;
  passwordHash: string;
  userKind: UserKind;
};

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async create(data: CreateUserInternal): Promise<User> {
    const entity = this.usersRepo.create(data);
    return this.usersRepo.save(entity);
  }

  async createManagedUser(dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase();
    const username =
      dto.username?.trim() ||
      (await this.generateUniqueUsername(dto.firstName, dto.lastName));

    await this.ensureEmailAvailable(email);
    await this.ensureUsernameAvailable(username);

    const user = await this.create({
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      username,
      email,
      phoneNumber: dto.phoneNumber.trim(),
      passwordHash: await bcrypt.hash(dto.password, 10),
      userKind: dto.userKind ?? UserKind.USER,
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
        'userKind',
        'passwordHash',
        'createdAt',
        'updatedAt',
      ],
    });
  }

  async countByKind(kind: UserKind): Promise<number> {
    return this.usersRepo.count({ where: { userKind: kind } });
  }

  async findAll() {
    return this.usersRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOneOrFail(id: string) {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateManagedUser(id: string, dto: UpdateUserDto) {
    const user = await this.findOneOrFail(id);
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

    if (dto.userKind && dto.userKind !== user.userKind) {
      await this.ensureAdminStillExists(user.userKind, dto.userKind);
      user.userKind = dto.userKind;
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

  async removeManagedUser(id: string) {
    const user = await this.findOneOrFail(id);
    await this.ensureAdminStillExists(user.userKind, null);
    await this.usersRepo.remove(user);
    return { id, deleted: true };
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

  async ensureSeedAdmin(
    email: string,
    passwordHash: string,
  ): Promise<void> {
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
        userKind: UserKind.ADMIN,
        passwordHash,
      }),
    );
  }

  async ensureSeedStaff(
    email: string,
    passwordHash: string,
  ): Promise<void> {
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
    const { passwordHash: _passwordHash, ...safe } = plain;
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

  private async ensureAdminStillExists(
    currentKind: UserKind,
    nextKind: UserKind | null,
  ) {
    if (currentKind !== UserKind.ADMIN || nextKind === UserKind.ADMIN) {
      return;
    }

    const adminCount = await this.countByKind(UserKind.ADMIN);
    if (adminCount <= 1) {
      throw new BadRequestException(
        'At least one admin account must remain in the system',
      );
    }
  }
}
