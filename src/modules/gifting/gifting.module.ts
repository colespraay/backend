import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Gifting } from '@entities/index';
import { GiftingService } from './gifting.service';
import { GiftingController } from './gifting.controller';
import {
  BankModule,
  TransactionModule,
  UserModule,
  WalletModule,
} from '../index';

@Module({
  imports: [
    TypeOrmModule.forFeature([Gifting]),
    forwardRef(() => BankModule),
    UserModule,
    TransactionModule,
    WalletModule,
  ],
  controllers: [GiftingController],
  providers: [GiftingService],
  exports: [GiftingService],
})
export class GiftingModule {}
