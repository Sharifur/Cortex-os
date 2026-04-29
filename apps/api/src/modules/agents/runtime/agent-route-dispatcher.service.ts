import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
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
  ) {}

  onApplicationBootstrap() {
    const fastify = this.httpAdapterHost.httpAdapter.getInstance();
    const agents = this.registry.getAll();
    let mounted = 0;

    for (const agent of agents) {
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
              const ok = await route.verifySignature(rawBody, request.headers ?? {}, request.query ?? {});
              if (!ok) {
                reply.status(401).send({ error: 'Invalid webhook signature' });
                return;
              }
            }
            const body = request.body ?? {};
            const result = await route.handler(body, reply);

            // Fire-and-forget webhook agent run
            if (isWebhookTrigger) {
              this.runtime
                .triggerAgent(agent.key, 'WEBHOOK', body)
                .catch((err) =>
                  this.logger.warn(
                    `Webhook trigger failed for ${agent.key}: ${err}`,
                  ),
                );
            }

            reply.send(result ?? { ok: true });
          } catch (err) {
            this.logger.error(
              `Agent route error [${agent.key} ${route.method} ${route.path}]: ${err}`,
            );
            reply.status(500).send({ error: 'Internal server error' });
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
