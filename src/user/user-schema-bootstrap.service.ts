import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Defensive, idempotent schema bootstrap for the `users` table.
 *
 * TypeORM's `synchronize: true` only runs on a full process boot — not on
 * hot-reloads — so when we add new entity columns mid-session the running
 * server can start crashing with "column does not exist". Some serverless
 * Postgres providers (e.g. Neon's pooler) have also been seen to silently
 * drop multi-statement DDL inside a single `query()` call, so we run each
 * statement separately and then explicitly verify the result via
 * `information_schema`.
 */
type RequiredColumn = {
  name: string;
  /** The exact `ADD COLUMN` clause body (no leading/trailing whitespace). */
  ddl: string;
};

const REQUIRED_COLUMNS: RequiredColumn[] = [
  { name: 'isActive', ddl: '"isActive" boolean NOT NULL DEFAULT true' },
  { name: 'deactivatedAt', ddl: '"deactivatedAt" timestamptz NULL' },
  {
    name: 'deletionScheduledAt',
    ddl: '"deletionScheduledAt" timestamptz NULL',
  },
  { name: 'deletedAt', ddl: '"deletedAt" timestamptz NULL' },
  { name: 'deletionReason', ddl: '"deletionReason" varchar(512) NULL' },
];

@Injectable()
export class UserSchemaBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(UserSchemaBootstrapService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    try {
      const before = await this.fetchExistingColumns();
      const missing = REQUIRED_COLUMNS.filter((c) => !before.has(c.name));

      if (missing.length === 0) {
        this.logger.log(
          'User lifecycle columns already present, no migration needed.',
        );
        return;
      }

      this.logger.log(
        `Bootstrapping ${missing.length} missing user lifecycle column(s): ${missing
          .map((c) => c.name)
          .join(', ')}`,
      );

      // Run each statement individually — some pooled Postgres setups silently
      // drop subsequent clauses in a multi-clause `ALTER TABLE`.
      for (const col of missing) {
        try {
          await this.dataSource.query(
            `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS ${col.ddl};`,
          );
        } catch (err) {
          this.logger.error(
            `Failed to add column "${col.name}" on users table.`,
            err instanceof Error ? err.stack : String(err),
          );
        }
      }

      const after = await this.fetchExistingColumns();
      const stillMissing = REQUIRED_COLUMNS.filter((c) => !after.has(c.name));

      if (stillMissing.length === 0) {
        this.logger.log('User lifecycle columns verified.');
      } else {
        this.logger.error(
          `User lifecycle columns are STILL missing after bootstrap: ${stillMissing
            .map((c) => c.name)
            .join(
              ', ',
            )}. Run the SQL manually against your database, or check that POSTGRES_URL points at the correct database.`,
        );
      }
    } catch (err) {
      this.logger.error(
        'Failed to bootstrap users lifecycle columns',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private async fetchExistingColumns(): Promise<Set<string>> {
    const rows = await this.dataSource.query<Array<{ column_name: string }>>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'users';`,
    );
    return new Set(rows.map((r) => r.column_name));
  }
}
