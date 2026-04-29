import { ArgumentsHost, Catch, ExceptionFilter, ForbiddenException, HttpException, HttpStatus, Inject, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { forbiddenPage, notFoundPage } from '../../common/pages';
import { RequestLogService } from './request-log.service';

@Catch()
@Injectable()
export class RequestLogExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(RequestLogExceptionFilter.name);

  constructor(@Inject(RequestLogService) private readonly logs: RequestLogService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<FastifyRequest>();
    const res = ctx.getResponse<FastifyReply>();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const payload = exception instanceof HttpException
      ? exception.getResponse()
      : { statusCode: status, message: 'Internal server error' };

    const errorMessage = (exception as Error)?.message ?? String(exception);
    const errorStack = (exception as Error)?.stack;

    const path = stripQuery(req.url ?? '');
    const isAuthRoute = path.startsWith('/auth/');
    const isScannerNoise = isInternetScannerProbe(path);

    if (!isScannerNoise) void this.logs.record({
      method: req.method ?? 'GET',
      path,
      statusCode: status,
      requestId: (req.headers['x-request-id'] as string | undefined),
      ip: ((req as unknown as { ip?: string }).ip) ?? (req.headers['x-forwarded-for'] as string | undefined),
      userAgent: req.headers['user-agent'] as string | undefined,
      queryString: extractQuery(req.url ?? ''),
      requestBody: isAuthRoute ? '[redacted: auth route]' : safeStringify(redactBody(req.body)),
      responseBody: isAuthRoute ? '[redacted: auth route]' : safeStringify(payload),
      errorMessage,
      errorStack,
    });

    const accept = (req.headers['accept'] ?? '') as string;
    const wantsHtml = accept.includes('text/html');
    if (wantsHtml && (exception instanceof NotFoundException || exception instanceof ForbiddenException || exception instanceof UnauthorizedException)) {
      const body = status === HttpStatus.NOT_FOUND ? notFoundPage(req.url ?? '/') : forbiddenPage();
      res.status(status).header('Content-Type', 'text/html; charset=utf-8').send(body);
      return;
    }

    res.status(status).send(typeof payload === 'string' ? { message: payload, statusCode: status } : payload);
  }
}

// Internet bots constantly probe public IPs for vulnerable apps (WordPress,
// phpMyAdmin, env files, etc.). They have nothing to do with our app — drop
// them from debug logs so the error list stays focused on real issues.
const SCANNER_PATTERNS = [
  /^\/wp-/i,                              // /wp-login.php, /wp-admin/, /wp-content/
  /^\/wordpress\b/i,
  /^\/xmlrpc\.php/i,
  /^\/phpmyadmin\b/i,
  /^\/pma\b/i,
  /^\/myadmin\b/i,
  /^\/administrator\b/i,                  // joomla
  /^\/admin\.php/i,
  /^\/\.env\b/i,
  /^\/\.git\b/i,
  /^\/\.aws\b/i,
  /^\/\.well-known\/security\.txt$/i,
  /^\/(boaform|cgi-bin|hudson|jenkins|owa|ews|autodiscover|sftp-config|setup\.php|shell\.php|webdav|webmail|backup\.zip|\.DS_Store|sitemap\.xml\.gz)/i,
  /\.(php|asp|aspx|cgi|do|jsp|jspx)(?:$|\?|\/)/i, // any path ending in .php / .asp / etc
];

function isInternetScannerProbe(path: string): boolean {
  if (!path || path === '/') return false;
  return SCANNER_PATTERNS.some((re) => re.test(path));
}

function stripQuery(url: string): string {
  const i = url.indexOf('?');
  return i >= 0 ? url.slice(0, i) : url;
}

function extractQuery(url: string): string | undefined {
  const i = url.indexOf('?');
  return i >= 0 ? url.slice(i + 1) : undefined;
}

const REDACT_KEYS = new Set(['password', 'token', 'secret', 'authorization', 'apiKey', 'api_key', 'refreshToken', 'refresh_token']);
function redactBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  if (Array.isArray(body)) return body.map(redactBody);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    if (REDACT_KEYS.has(k)) {
      out[k] = '[redacted]';
    } else if (v && typeof v === 'object') {
      out[k] = redactBody(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function safeStringify(v: unknown): string | undefined {
  if (v === undefined) return undefined;
  try {
    return typeof v === 'string' ? v : JSON.stringify(v);
  } catch {
    return String(v);
  }
}
