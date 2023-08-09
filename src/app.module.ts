import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import {
  JsonMaskInterceptor,
  HideObjectPropertyInterceptor,
  LoggingInterceptor,
  TimeoutInterceptor,
  HttpExceptionFilter,
} from '@schematics/index';
import { UserModule, AuthModule } from '@modules/index';
import { AppService } from './app.service';
import ormConfig from './orm.config';

@Module({
  imports: [
    MulterModule.register({ dest: './uploads' }),
    ThrottlerModule.forRoot({ ttl: 60, limit: 40 }),
    TypeOrmModule.forRoot(ormConfig),
    PrometheusModule.register(),
    UserModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: JsonMaskInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HideObjectPropertyInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TimeoutInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
