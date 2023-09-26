import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Withdrawal } from '@entities/index';
import { WithdrawalService } from './withdrawal.service';
import { WithdrawalController } from './withdrawal.controller';
import {
  TransactionModule,
  UserAccountModule,
  UserModule,
  WalletModule,
} from '../index';

@Module({
  imports: [
    TypeOrmModule.forFeature([Withdrawal]),
    UserModule,
    WalletModule,
    TransactionModule,
    forwardRef(() => UserAccountModule),
  ],
  controllers: [WithdrawalController],
  providers: [WithdrawalService],
  exports: [WithdrawalService],
})
export class WithdrawalModule {}
