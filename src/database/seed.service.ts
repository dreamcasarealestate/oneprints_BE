import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { CatalogueService } from '../catalogue/catalogue.service';
import { UsersService } from '../user/users.service';
import { TemplateCategoriesService } from '../templates/template-categories.service';
import { TemplatesService } from '../templates/templates.service';

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(
    private readonly users: UsersService,
    private readonly config: ConfigService,
    private readonly catalogue: CatalogueService,
    private readonly templateCategories: TemplateCategoriesService,
    private readonly templates: TemplatesService,
  ) {}

  async onModuleInit() {
    await this.users.ensureRoleRows();
    await this.users.normalizeLegacyUserKinds();

    const adminEmail = this.config.get<string>('SEED_ADMIN_EMAIL', 'admin@oneprint.local');
    const adminPassword = this.config.get<string>('SEED_ADMIN_PASSWORD', 'Admin12345!');
    const adminHash = await bcrypt.hash(adminPassword, 10);
    await this.users.ensureSeedAdmin(adminEmail, adminHash);

    const staffEmail = this.config.get<string>('SEED_STAFF_EMAIL', 'staff@oneprint.local');
    const staffPassword = this.config.get<string>('SEED_STAFF_PASSWORD', 'Staff12345!');
    const staffHash = await bcrypt.hash(staffPassword, 10);
    await this.users.ensureSeedStaff(staffEmail, staffHash);

    await this.users.syncAllUserRoleIds();
    await this.catalogue.ensureDefaultCategories();

    // Template taxonomy + back-link any legacy DesignTemplate rows that
    // only have a `categorySlug` (from the pre-FK schema) to the new
    // TemplateCategory rows. Both calls are idempotent.
    await this.templateCategories.ensureDefaults();
    await this.templates.backfillCategoryIds();
  }
}
