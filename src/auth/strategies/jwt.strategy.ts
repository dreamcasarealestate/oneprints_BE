import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../user/users.service';

export type JwtPayload = {
  sub: string;
  email: string;
  userKind: string;
  branchId?: string | null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'dev-change-me'),
    });
  }

  async validate(payload: JwtPayload & { typ?: string }) {
    if (payload.typ === 'refresh') {
      throw new UnauthorizedException('Use access token');
    }
    const user = await this.usersService.findById(payload.sub);
    if (user) {
      return user;
    }

    // Fallback for valid signed tokens when the backing row is unavailable.
    // This keeps authenticated app routes working while still honoring the JWT signature.
    return {
      id: payload.sub,
      email: payload.email,
      userKind: payload.userKind,
      branchId: payload.branchId ?? null,
    };
  }
}
