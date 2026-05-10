import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { agents, agentRuns } from '../../../db/schema';
import { AgentRegistryService } from './agent-registry.service';
import { AgentRuntimeService } from './agent-runtime.service';

@Injectable()
export class AgentRouteDispatcherService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AgentRouteDispatcherService.name);

  constructor(
    private readonly registry: AgentRegistryService,
    private readonly runtime: AgentRuntimeService,
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly jwt: JwtService,
    private readonly db: DbService,
  ) {}

  onApplicationBootstrap() {
    const fastify = this.httpAdapterHost.httpAdapter.getInstance();
    const agentList = this.registry.getAll();
    let mounted = 0;

    for (const agent of agentList) {
      const routes = agent.apiRoutes();

      for (const route of routes) {
        const preHandler = route.requiresAuth
          ? [this.buildJwtPreHandler()]
          : [];

        // Identify if this route should also fire a WEBHOOK trigger
        const isWebhookTrigger =
          route.method === 'POST' &&
          agent.triggers().some(
            (t) => t.type === 'WEBHOOK' && t.webhookPath === route.path,
          );

        const handler = async (request: any, reply: any) => {
          try {
            if (route.verifySignature && route.method === 'POST') {
              const rawBody = (request.rawBody as string | undefined) ?? '';
              const receivedHeaderKeys = Object.keys(request.headers ?? {});
              this.logger.log(`Webhook arrived: ${route.path} from ${request.ip ?? 'unknown'} headers=[${receivedHeaderKeys.join(', ')}]`);
              const ok = await route.verifySignature(rawBody, request.headers ?? {}, request.query ?? {});
              if (!ok) {
                this.logger.warn(`Webhook signature rejected: ${route.path} — received headers: [${receivedHeaderKeys.join(', ')}]. Check that x-webhook-secret header is sent and support_webhook_secret setting matches.`);
                // Write a FAILED run so the rejection is visible in the debug page
                try {
                  const [agentRecord] = await this.db.db
                    .select({ id: agents.id })
                    .from(agents)
                    .where(eq(agents.key, agent.key));
                  if (agentRecord) {
                    await this.db.db.insert(agentRuns).values({
                      agentId: agentRecord.id,
                      triggerType: 'WEBHOOK',
                      triggerPayload: { path: route.path, receivedHeaderKeys },
                      status: 'FAILED',
                      error: 'Webhook signature rejected — check x-webhook-secret header and support_webhook_secret setting',
                      finishedAt: new Date(),
                    });
                  }
                } catch { /* best-effort */ }
                reply.status(401).send({ error: 'Invalid webhook signature' });
                return;
              }
              this.logger.log(`Webhook signature OK: ${route.path}`);
            }
            const params = { ...(request.query ?? {}), ...(request.body ?? {}) };
            this.logger.debug(
              `${route.method} ${route.path} params=${JSON.stringify(params)}`,
            );
            const result = await route.handler(params, reply);

            // Fire-and-forget webhook agent run
            if (isWebhookTrigger) {
              this.runtime
                .triggerAgent(agent.key, 'WEBHOOK', request.body ?? {})
                .catch(async (err) => {
                  const msg = err instanceof Error ? err.message : String(err);
                  this.logger.warn(`Webhook trigger failed for ${agent.key}: ${msg}`);
                  try {
                    const [agentRecord] = await this.db.db
                      .select({ id: agents.id })
                      .from(agents)
                      .where(eq(agents.key, agent.key));
                    if (agentRecord) {
                      await this.db.db.insert(agentRuns).values({
                        agentId: agentRecord.id,
                        triggerType: 'WEBHOOK',
                        triggerPayload: request.body ?? {},
                        status: 'FAILED',
                        error: msg,
                        finishedAt: new Date(),
                      });
                    }
                  } catch { /* best-effort */ }
                });
            }

            reply.send(result ?? { ok: true });
          } catch (err) {
            this.logger.error(
              `Agent route error [${agent.key} ${route.method} ${route.path}]: ${err}`,
            );
            const msg = err instanceof Error ? err.message : String(err);
            reply.status(500).send({ ok: false, error: msg });
          }
        };

        try {
          fastify.route({
            method: route.method,
            url: route.path,
            preHandler,
            handler,
          });
          mounted++;
          this.logger.log(
            `Mounted ${route.method} ${route.path} → ${agent.key}${isWebhookTrigger ? ' [webhook]' : ''}${route.requiresAuth ? ' [auth]' : ''}`,
          );
        } catch (err) {
          // Duplicate route registration (e.g. two agents sharing a prefix) — skip
          this.logger.warn(
            `Skipped duplicate route ${route.method} ${route.path}: ${err}`,
          );
        }
      }
    }

    this.logger.log(`Agent route dispatcher: ${mounted} routes mounted`);
  }

  private buildJwtPreHandler() {
    return async (request: any, reply: any) => {
      const auth = request.headers['authorization'];
      if (!auth?.startsWith('Bearer ')) {
        reply.status(401).send({ error: 'Unauthorized' });
        return;
      }
      try {
        const payload = this.jwt.verify(auth.slice(7));
        request.user = payload;
      } catch {
        reply.status(401).send({ error: 'Invalid token' });
      }
    };
  }
}
