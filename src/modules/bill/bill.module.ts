import { Module } from '@nestjs/common';
import { BillController } from './bill.controller';
import { BillService } from './bill.service';
import { AirtimePurchaseModule } from '@modules/airtime-purchase/airtime-purchase.module';
import { UserModule } from '@modules/user/user.module';
import { WalletModule } from '@modules/wallet/wallet.module';
import { BankModule } from '@modules/bank/bank.module';
import { DataPurchaseModule } from '@modules/data-purchase/data-purchase.module';
import { ElectricityPurchaseModule } from '@modules/electricity-purchase/electricity-purchase.module';
import { CablePurchaseModule } from '@modules/cable-purchase/cable-purchase.module';

@Module({
  imports: [
    AirtimePurchaseModule,
    UserModule,
    BankModule,
    WalletModule,
    ElectricityPurchaseModule,
    DataPurchaseModule,
    CablePurchaseModule,
  ],
  controllers: [BillController],
  providers: [BillService],
  exports: [BillService],
})
export class BillModule {}
