import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

/**
 * Lightweight `SELECT 1` ping that keeps the Postgres compute warm.
 *
 * Why this exists
 * ────────────────
 * Serverless Postgres providers (Neon, Supabase free tier, RDS
 * aurora-serverless v2) **pause the compute node** after a few
 * minutes of idle to save money. The very next request after that
 * pause has to wait for the compute to boot back up — typically
 * 5–15 seconds — and during that window other in-flight requests
 * surface as `Connection terminated due to connection timeout`,
 * `Client network socket disconnected before secure TLS connection
 * was established`, and friends. (You saw exactly that cluster of
 * errors in the dev console.)
 *
 * The cleanest user-facing fix is to never *let* the compute pause:
 * fire a 50-byte `SELECT 1` every few minutes from the backend. The
 * query is cheap, fires regardless of human traffic, and resets the
 * provider's "idle" timer — so customers + admins always hit a hot
 * instance.
 *
 * The pinger is deliberately opt-in. Production deployments that
 * run multiple replicas, or that use a managed plan with no
 * idle-suspend (Neon Pro, RDS provisioned), should leave it off
 * via `POSTGRES_KEEPALIVE_ENABLED=false` — extra pings just add
 * noise to the audit log without buying anything. In dev (and on
 * any free-tier prod), set it to `true` and forget about it.
 *
 * Env knobs (all optional):
 *   - `POSTGRES_KEEPALIVE_ENABLED` (default: `true` in dev,
 *     `false` in prod)
 *   - `POSTGRES_KEEPALIVE_INTERVAL_MS` (default: 240_000 — 4 minutes,
 *     well under Neon's 5-minute idle threshold)
 *
 * The service is safe to start before the DB has booted; the first
 * tick will simply fail with the same transient error we're trying
 * to avoid, get logged once at `debug`, and the next tick will
 * succeed.
 */
@Injectable()
export class DatabaseKeepAliveService
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(DatabaseKeepAliveService.name);
  private timer: NodeJS.Timeout | null = null;
  private inFlight = false;
  private warnedThisCycle = false;

  constructor(
    @Optional() @Inject(DataSource) private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    if (!this.dataSource) {
      // No DataSource bound (rare — typically only in test fixtures).
      // Nothing to ping; quietly skip.
      return;
    }

    const enabled = this.resolveEnabled();
    if (!enabled) {
      this.logger.log(
        'Keep-alive disabled (set POSTGRES_KEEPALIVE_ENABLED=true to turn on).',
      );
      return;
    }

    const intervalMs = this.resolveIntervalMs();
    this.logger.log(
      `Keep-alive enabled — pinging Postgres every ${Math.round(
        intervalMs / 1000,
      )}s to prevent compute suspend.`,
    );

    // Fire one immediately so a freshly-booted process doesn't have
    // to wait `intervalMs` before its first warm-up. The result is
    // also a free "DB reachable on boot?" smoke test.
    void this.ping();

    this.timer = setInterval(() => {
      void this.ping();
    }, intervalMs);

    // Don't keep the Node event loop alive purely for the timer —
    // shutdown hooks should be able to stop the process cleanly.
    if (typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  onApplicationShutdown(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private resolveEnabled(): boolean {
    const raw = (
      this.config.get<string>('POSTGRES_KEEPALIVE_ENABLED') ?? ''
    ).trim();
    if (raw) return raw.toLowerCase() === 'true' || raw === '1';
    // Default ON in non-production so devs benefit automatically; off
    // in production to avoid surprising paid-tier deployments that
    // never suspend.
    return process.env.NODE_ENV !== 'production';
  }

  private resolveIntervalMs(): number {
    const raw = (
      this.config.get<string>('POSTGRES_KEEPALIVE_INTERVAL_MS') ?? ''
    ).trim();
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed >= 30_000) return parsed;
    return 240_000; // 4 minutes — comfortably under Neon's 5-minute idle.
  }

  private async ping(): Promise<void> {
    if (!this.dataSource) return;
    if (this.inFlight) return; // Skip if the last tick is still resolving.
    this.inFlight = true;
    try {
      if (!this.dataSource.isInitialized) {
        // App is still booting — try again on the next tick.
        return;
      }
      await this.dataSource.query('SELECT 1');
      // Reset the "already warned" flag so the *next* outage gets a
      // fresh log line.
      this.warnedThisCycle = false;
    } catch (err) {
      // Don't spam — the global DatabaseExceptionFilter already
      // shouts when user-facing requests hit the same problem. Log
      // once per outage at `debug` so a quiet console stays quiet.
      if (!this.warnedThisCycle) {
        this.warnedThisCycle = true;
        const message =
          err instanceof Error ? err.message : String(err ?? 'unknown');
        this.logger.debug(`Keep-alive ping failed: ${message}`);
      }
    } finally {
      this.inFlight = false;
    }
  }
}
