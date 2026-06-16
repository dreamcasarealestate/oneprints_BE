import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import type { Request, Response } from 'express';

/**
 * Patterns that identify a *transient* Postgres connection problem we
 * can safely tell the client to retry. The user-visible behaviour is
 * a clean 503 with a `Retry-After` header instead of a 500 + scary
 * stack trace.
 *
 * Most of these surface when a serverless Postgres (Neon, Supabase
 * free tier, RDS aurora-serverless) is waking from its idle-suspend
 * state — the first few requests after ~5 minutes of silence race
 * the compute node's cold-start and time out. They're not bugs;
 * they're a fact of life with pause-on-idle databases. We log them
 * once at `warn` level and back off so the dev console doesn't
 * scroll past with stack traces every time the customer opens a
 * tab in the morning.
 */
const TRANSIENT_PG_ERROR_PATTERNS: readonly RegExp[] = [
  /Connection terminated due to connection timeout/i,
  /Connection terminated unexpectedly/i,
  /Client network socket disconnected before secure TLS/i,
  /timeout exceeded when trying to connect/i,
  /Connection terminated$/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /ENETUNREACH/i,
  /EAI_AGAIN/i,
  /Query read timeout/i,
  /statement timeout/i,
  /canceling statement due to statement timeout/i,
  /read ECONNRESET/i,
];

/**
 * Pg / TypeORM exception classes we look at. We don't import
 * QueryFailedError statically (avoids a hard typeorm coupling in
 * the filter) — instead we check by constructor name so the filter
 * keeps working even if the project swaps ORMs later.
 */
const DATABASE_ERROR_NAMES: ReadonlySet<string> = new Set([
  'Error',
  'QueryFailedError',
  'CannotConnectAlreadyConnectedError',
  'ConnectionNotFoundError',
  'TypeORMError',
  'TimeoutError',
]);

function isTransientDatabaseError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; message?: string; code?: string };
  if (!DATABASE_ERROR_NAMES.has(e.name ?? 'Error')) return false;
  const message = `${e.message ?? ''}`;
  if (!message) return false;
  if (TRANSIENT_PG_ERROR_PATTERNS.some((rx) => rx.test(message))) return true;
  // node-pg surfaces some failures as a bare `code` string — catch
  // the well-known transient ones here too.
  const code = e.code ?? '';
  return code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'EAI_AGAIN';
}

/**
 * Global filter that turns transient Postgres connection failures
 * into 503 responses with a short `Retry-After` so callers (the FE,
 * other services, monitoring) back off briefly instead of treating
 * the request as a real server bug.
 *
 * Non-transient errors are re-raised so Nest's default exception
 * handling still owns them — we deliberately *don't* swallow real
 * bugs.
 */
@Catch()
export class DatabaseExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(DatabaseExceptionFilter.name);
  // Last time we warned about a transient DB error. Throttles log
  // output so a wake-up storm produces ONE warning line, not 20.
  private lastWarnAt = 0;
  private readonly WARN_THROTTLE_MS = 5_000;

  constructor(adapterHost: HttpAdapterHost) {
    super(adapterHost.httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    if (!isTransientDatabaseError(exception)) {
      // Not ours — re-throw so the default Nest filter logs / formats it.
      return super.catch(exception, host);
    }

    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const now = Date.now();
    if (now - this.lastWarnAt > this.WARN_THROTTLE_MS) {
      this.lastWarnAt = now;
      const message = (exception as Error).message ?? 'database unavailable';
      this.logger.warn(
        `Database unavailable — likely a cold-start / pool reconnect. ` +
          `Returning 503 for ${request?.method ?? '?'} ${
            request?.originalUrl ?? request?.url ?? '?'
          } (${message})`,
      );
    }

    // Tell well-behaved clients to retry in 2 seconds. Browsers and
    // most HTTP libs honour this.
    response.setHeader('Retry-After', '2');

    const body = {
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      error: 'Service Unavailable',
      message:
        'The database is reconnecting — please retry in a moment. ' +
        'This usually clears within 5–10 seconds.',
      retryAfterSeconds: 2,
    };

    if (response.headersSent) {
      // The error fired after we already started streaming — nothing
      // we can do at the HTTP layer. Just end the connection.
      try {
        response.end();
      } catch {
        /* best-effort */
      }
      return;
    }

    response.status(HttpStatus.SERVICE_UNAVAILABLE).json(body);
  }
}

/**
 * Smaller helper: when callers want to opt out of the global filter
 * for a specific code-path that already handles retries internally,
 * wrap the thrown error in `HttpException` so this filter ignores it.
 */
export function isHandledByDatabaseFilter(err: unknown): boolean {
  if (err instanceof HttpException) return false;
  return isTransientDatabaseError(err);
}
