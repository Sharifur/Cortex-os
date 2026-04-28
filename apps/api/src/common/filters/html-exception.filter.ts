import { ArgumentsHost, Catch, ExceptionFilter, ForbiddenException, HttpException, HttpStatus, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { forbiddenPage, notFoundPage } from '../pages';

@Catch(NotFoundException, ForbiddenException, UnauthorizedException)
export class HtmlExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<FastifyRequest>();
    const res = ctx.getResponse<FastifyReply>();

    const status = exception.getStatus();
    const accept = (req.headers['accept'] ?? '') as string;
    const wantsHtml = accept.includes('text/html');

    if (!wantsHtml) {
      const payload = exception.getResponse();
      res.status(status).send(typeof payload === 'string' ? { message: payload, statusCode: status } : payload);
      return;
    }

    const body = status === HttpStatus.NOT_FOUND
      ? notFoundPage(req.url)
      : forbiddenPage();

    res.status(status).header('Content-Type', 'text/html; charset=utf-8').send(body);
  }
}
