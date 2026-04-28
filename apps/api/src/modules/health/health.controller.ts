import { Controller, Get, Header } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DbService } from '../../db/db.service';

@Controller()
export class RootController {
  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  index(): string {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Cortex OS API</title>
<meta name="robots" content="noindex">
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center;
         font-family: system-ui, sans-serif; background: #0b0c10; color: #e6e6e6; }
  .card { text-align: center; padding: 2rem 2.5rem; border: 1px solid #222;
          border-radius: 12px; background: #111317; }
  h1 { margin: 0 0 .25rem; font-size: 1.25rem; font-weight: 600; }
  p  { margin: 0; color: #888; font-size: .9rem; }
</style>
</head>
<body><div class="card"><h1>Cortex OS API</h1><p>Service is running.</p></div></body>
</html>`;
  }
}

@Controller('health')
export class HealthController {
  constructor(private db: DbService) {}

  @Get()
  async check() {
    let postgres: 'ok' | 'error' | 'not_configured';

    if (!process.env.DATABASE_URL) {
      postgres = 'not_configured';
    } else {
      try {
        await this.db.db.execute(sql`SELECT 1`);
        postgres = 'ok';
      } catch {
        postgres = 'error';
      }
    }

    return {
      status: postgres === 'ok' ? 'ok' : 'degraded',
      postgres,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
