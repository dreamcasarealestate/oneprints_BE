import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Defensive, idempotent schema bootstrap for the `design_templates`
 * table.
 *
 * TypeORM's `synchronize: true` is supposed to ALTER the table on a
 * full process boot, but in practice it has misfired against
 * serverless / pooled Postgres (Neon, Supabase pgbouncer, ...) when
 * new columns are added mid-development. The result is a running
 * server that crashes on the first read of the column with
 * `column "..." does not exist`.
 *
 * Mirrors {@link UserSchemaBootstrapService}: enumerate every
 * column we expect to exist for the template feature, query
 * `information_schema.columns` to find the gaps, and run an
 * idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for each
 * missing one. Safe to re-run on every boot — Postgres no-ops
 * when the column already exists.
 *
 * Only columns added AFTER the table was first created live here.
 * The base table (`id`, `title`, `canvasState`, etc.) is still
 * created by TypeORM's initial synchronize pass.
 */
type RequiredColumn = {
  name: string;
  /** The exact `ADD COLUMN` clause body (no leading/trailing whitespace). */
  ddl: string;
};

const REQUIRED_COLUMNS: RequiredColumn[] = [
  // Optional per-template side override (front / back / wrap / ...).
  { name: 'sides', ddl: '"sides" jsonb NULL' },
  // Template-level custom sections (mirror of Product.customSections).
  {
    name: 'customSections',
    ddl: `"customSections" jsonb NOT NULL DEFAULT '[]'::jsonb`,
  },
  // Admin-authored "From ₹X" price override.
  {
    name: 'priceFromOverride',
    ddl: '"priceFromOverride" numeric NULL',
  },
  // Override canvas dimensions (px); fall back to category default.
  { name: 'width', ddl: '"width" integer NULL' },
  { name: 'height', ddl: '"height" integer NULL' },
];

@Injectable()
export class TemplateSchemaBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(TemplateSchemaBootstrapService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    try {
      const tableExists = await this.designTemplatesTableExists();
      if (!tableExists) {
        // TypeORM's synchronize hasn't created the base table yet.
        // It runs after `onModuleInit` for the schema, so on a
        // fresh DB we have nothing to ALTER — exit cleanly and let
        // synchronize do its job.
        this.logger.log(
          'design_templates table not present yet; deferring schema bootstrap to TypeORM synchronize.',
        );
        return;
      }

      const before = await this.fetchExistingColumns();
      const missing = REQUIRED_COLUMNS.filter((c) => !before.has(c.name));

      if (missing.length === 0) {
        this.logger.log(
          'design_templates schema already up-to-date, no migration needed.',
        );
        return;
      }

      this.logger.log(
        `Bootstrapping ${missing.length} missing design_templates column(s): ${missing
          .map((c) => c.name)
          .join(', ')}`,
      );

      // Run each statement individually — some pooled Postgres setups
      // silently drop subsequent clauses in a multi-clause `ALTER TABLE`.
      for (const col of missing) {
        try {
          await this.dataSource.query(
            `ALTER TABLE "design_templates" ADD COLUMN IF NOT EXISTS ${col.ddl};`,
          );
        } catch (err) {
          this.logger.error(
            `Failed to add column "${col.name}" on design_templates table.`,
            err instanceof Error ? err.stack : String(err),
          );
        }
      }

      const after = await this.fetchExistingColumns();
      const stillMissing = REQUIRED_COLUMNS.filter((c) => !after.has(c.name));

      if (stillMissing.length === 0) {
        this.logger.log('design_templates schema columns verified.');
      } else {
        this.logger.error(
          `design_templates columns are STILL missing after bootstrap: ${stillMissing
            .map((c) => c.name)
            .join(
              ', ',
            )}. Run the SQL manually against your database, or check that POSTGRES_URL points at the correct database.`,
        );
      }
    } catch (err) {
      this.logger.error(
        'Failed to bootstrap design_templates schema',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private async designTemplatesTableExists(): Promise<boolean> {
    const rows = await this.dataSource.query<Array<{ exists: boolean }>>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_name = 'design_templates'
       ) AS exists;`,
    );
    return !!rows[0]?.exists;
  }

  private async fetchExistingColumns(): Promise<Set<string>> {
    const rows = await this.dataSource.query<Array<{ column_name: string }>>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'design_templates';`,
    );
    return new Set(rows.map((r) => r.column_name));
  }
}
