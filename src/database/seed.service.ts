import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../user/users.service';

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(
    private readonly users: UsersService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    const adminEmail = this.config.get<string>('SEED_ADMIN_EMAIL', 'admin@oneprint.local');
    const adminPassword = this.config.get<string>('SEED_ADMIN_PASSWORD', 'Admin12345!');
    const adminHash = await bcrypt.hash(adminPassword, 10);
    await this.users.ensureSeedAdmin(adminEmail, adminHash);

    const staffEmail = this.config.get<string>('SEED_STAFF_EMAIL', 'staff@oneprint.local');
    const staffPassword = this.config.get<string>('SEED_STAFF_PASSWORD', 'Staff12345!');
    const staffHash = await bcrypt.hash(staffPassword, 10);
    await this.users.ensureSeedStaff(staffEmail, staffHash);
  }
}
