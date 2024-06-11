import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventSpraay } from '@entities/index';
import { EventSpraayController } from './event-spraay.controller';
import { EventSpraayService } from './event-spraay.service';
import {
  EventInviteModule,
  EventModule,
  TransactionModule,
  UserModule,
  WalletModule,
} from '../index';

@Module({
  imports: [
    TypeOrmModule.forFeature([EventSpraay]),
    UserModule,
    EventModule,
    EventInviteModule,
    forwardRef(() => WalletModule),
    forwardRef(() => TransactionModule),
  ],
  providers: [EventSpraayService],
  controllers: [EventSpraayController],
  exports: [EventSpraayService],
})
export class EventSpraayModule {}
