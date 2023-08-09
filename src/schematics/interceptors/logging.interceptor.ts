import {
  CallHandler,
  ExecutionContext,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { saveLogToFile } from '@utils/functions/utils.function';
import { catchError, throwError, tap, Observable } from 'rxjs';

export class LoggingInterceptor implements NestInterceptor {
  private logger: Logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    try {
      const ctx = context.switchToHttp();
      const request = ctx.getRequest<Request>();
      const httpInfo: any = {
        timestamp: new Date().toISOString(),
        path: request.url,
        action: request.method,
        host: request['hostname'],
        userAgent: request.headers['user-agent'],
        ipAddress:
          request.headers['x-forwarded-for'] ??
          request['connection']['remoteAddress'],
      };
      if (httpInfo.action === 'POST') {
        httpInfo['body'] = request['body'];
      } else {
        httpInfo['params'] = request['params'];
        httpInfo['query'] = request['query'];
        httpInfo['headers'] = request['headers'];
      }
      const now = Date.now();
      return next.handle().pipe(
        tap((response) => {
          httpInfo['requestStatus'] = 'success';
          httpInfo['duration'] = `${Date.now() - now}ms`;
          httpInfo['response'] = response;
          saveLogToFile(httpInfo);
        }),
        catchError((error: any) => {
          httpInfo['requestStatus'] = 'error';
          httpInfo['duration'] = `${Date.now() - now}ms`;
          httpInfo['error'] = error;
          this.logger.error(httpInfo);
          saveLogToFile(httpInfo);
          return throwError(() => error);
        }),
      );
    } catch (ex) {
      this.logger.debug(ex);
      throw ex;
    }
  }
}
