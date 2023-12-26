import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Withdrawal } from '@entities/index';
import { UserAccountModule } from '@modules/user-account/user-account.module';
import { UserModule } from '@modules/user/user.module';
import { WalletModule } from '@modules/wallet/wallet.module';
import { TransactionModule } from '@modules/transaction/transaction.module';
import { WithdrawalService } from './withdrawal.service';
import { WithdrawalController } from './withdrawal.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Withdrawal]),
    UserModule,
    forwardRef(() => TransactionModule),
    forwardRef(() => WalletModule),
    forwardRef(() => UserAccountModule),
  ],
  controllers: [WithdrawalController],
  providers: [WithdrawalService],
  exports: [WithdrawalService],
})
export class WithdrawalModule {}
