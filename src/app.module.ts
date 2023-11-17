import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { MulterModule } from '@nestjs/platform-express';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import {
  JsonMaskInterceptor,
  HideObjectPropertyInterceptor,
  LoggingInterceptor,
  TimeoutInterceptor,
  HttpExceptionFilter,
} from '@schematics/index';
import {
  UserModule,
  AuthModule,
  BillModule,
  WalletModule,
  EventCategoryModule,
  GiftingModule,
  CablePurchaseModule,
  ElectricityPurchaseModule,
  UserAccountModule,
  BankModule,
  EventModule,
  EventInviteModule,
  EventSpraayModule,
  EventRSVPModule,
  TransactionModule,
  NotificationMessageModule,
  NotificationModule,
  WithdrawalModule,
  AirtimePurchaseModule,
  DataPurchaseModule,
} from '@modules/index';
import { AppService } from './app.service';
import ormConfig from './orm.config';

@Module({
  imports: [
    TypeOrmModule.forRoot(ormConfig),
    PrometheusModule.register(),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    MulterModule.register({ dest: './uploads' }),
    ThrottlerModule.forRoot({ ttl: 60, limit: 40 }),
    AuthModule,
    UserModule,
    GiftingModule,
    WithdrawalModule,
    EventCategoryModule,
    UserAccountModule,
    BankModule,
    EventModule,
    EventInviteModule,
    EventSpraayModule,
    EventRSVPModule,
    WalletModule,
    TransactionModule,
    NotificationMessageModule,
    BillModule,
    AirtimePurchaseModule,
    DataPurchaseModule,
    ElectricityPurchaseModule,
    CablePurchaseModule,
    NotificationModule,
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
