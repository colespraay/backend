import { Module, forwardRef } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { UserAccountModule } from '@modules/user-account/user-account.module';
import { TransactionModule } from '@modules/transaction/transaction.module';
import { WithdrawalModule } from '@modules/withdrawal/withdrawal.module';
import { BankModule } from '@modules/bank/bank.module';
import { UserModule } from '@modules/user/user.module';

@Module({
  imports: [
    WithdrawalModule,
    UserModule,
    forwardRef(() => BankModule),
    UserAccountModule,
    TransactionModule
  ],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
