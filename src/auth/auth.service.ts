import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../user/users.service';
import { UserKind } from '../user/user-kind.enum';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    if (dto.userKind && dto.userKind !== UserKind.USER) {
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

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const { passwordHash: _, ...safe } = user;
    return this.issueTokens(safe as typeof user);
  }

  private issueTokens(user: {
    id: string;
    email: string;
    userKind: UserKind;
    firstName: string;
    lastName: string;
    username: string;
    phoneNumber: string;
  }) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      userKind: user.userKind,
    };
    const access_token = this.jwtService.sign(payload);
    return {
      access_token,
      user: {
        id: user.id,
        email: user.email,
        userKind: user.userKind,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        phoneNumber: user.phoneNumber,
      },
    };
  }
}
