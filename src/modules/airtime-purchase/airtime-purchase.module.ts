import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AirtimePurchase } from '@entities/index';
import { UserModule } from '@modules/user/user.module';
import { BankModule } from '@modules/bank/bank.module';
import { BillModule } from '@modules/bill/bill.module';
import { WalletModule } from '@modules/wallet/wallet.module';
import { TransactionModule } from '@modules/transaction/transaction.module';
import { AirtimePurchaseController } from './airtime-purchase.controller';
import { AirtimePurchaseService } from './airtime-purchase.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AirtimePurchase]),
    forwardRef(() => BillModule),
    UserModule,
    BankModule,
    WalletModule,
    TransactionModule,
  ],
  controllers: [AirtimePurchaseController],
  providers: [AirtimePurchaseService],
  exports: [AirtimePurchaseService],
})
export class AirtimePurchaseModule {}
