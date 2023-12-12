import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CablePurchase } from '@entities/index';
import { TransactionModule } from '@modules/transaction/transaction.module';
import { UserModule } from '@modules/user/user.module';
import { BillModule } from '@modules/bill/bill.module';
import { BankModule } from '@modules/bank/bank.module';
import { WalletModule } from '@modules/wallet/wallet.module';
import { CablePurchaseService } from './cable-purchase.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CablePurchase]),
    forwardRef(() => BillModule),
    UserModule,
    BankModule,
    WalletModule,
    TransactionModule,
  ],
  providers: [CablePurchaseService],
  exports: [CablePurchaseService],
})
export class CablePurchaseModule {}
