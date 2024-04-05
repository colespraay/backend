import { Module } from '@nestjs/common';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AirtimePurchaseModule } from '@modules/airtime-purchase/airtime-purchase.module';
import { UserModule } from '@modules/user/user.module';
import { BankModule } from '@modules/bank/bank.module';
import { WalletModule } from '@modules/wallet/wallet.module';
import { ElectricityPurchaseModule } from '@modules/electricity-purchase/electricity-purchase.module';
import { DataPurchaseModule } from '@modules/data-purchase/data-purchase.module';
import { CablePurchaseModule } from '@modules/cable-purchase/cable-purchase.module';
import { BettingPurchaseModule } from '@modules/betting-purchase/betting-purchase.module';
import { TransactionModule } from '@modules/transaction/transaction.module';
import { AppProfitModule } from '@modules/app-profit/app-profit.module';
import { BillModule } from '@modules/bill/bill.module';
import { EventSpraayModule } from '@modules/event-spraay/event-spraay.module';
import { EventModule } from '@modules/event/event.module';
import { GiftingModule } from '@modules/gifting/gifting.module';




@Module({
  imports: [

    UserModule,
    BankModule,
    WalletModule,
    BillModule,
    ElectricityPurchaseModule,
    DataPurchaseModule,
    CablePurchaseModule,
    BettingPurchaseModule,
    AirtimePurchaseModule,
    TransactionModule,
    AppProfitModule,
    EventSpraayModule,
    GiftingModule,
    EventModule
  ],
  controllers: [AdminDashboardController],
  providers: [AdminDashboardService],
})
export class AdminDashboardModule {}
