import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Gifting } from '@entities/index';
import { GiftingService } from './gifting.service';
import { GiftingController } from './gifting.controller';
import { TransactionModule, UserModule, WalletModule } from '../index';

@Module({
  imports: [
    TypeOrmModule.forFeature([Gifting]),
    UserModule,
    TransactionModule,
    WalletModule,
  ],
  controllers: [GiftingController],
  providers: [GiftingService],
  exports: [GiftingService],
})
export class GiftingModule {}
