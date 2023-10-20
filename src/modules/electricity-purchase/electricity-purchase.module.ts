import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ElectricityPurchase } from '@entities/index';
import { TransactionModule } from '@modules/transaction/transaction.module';
import { BankModule } from '@modules/bank/bank.module';
import { UserModule } from '@modules/user/user.module';
import { BillModule } from '@modules/bill/bill.module';
import { WalletModule } from '@modules/wallet/wallet.module';
import { ElectricityPurchaseController } from './electricity-purchase.controller';
import { ElectricityPurchaseService } from './electricity-purchase.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ElectricityPurchase]),
    forwardRef(() => BillModule),
    UserModule,
    BankModule,
    WalletModule,
    TransactionModule,
  ],
  controllers: [ElectricityPurchaseController],
  providers: [ElectricityPurchaseService],
  exports: [ElectricityPurchaseService],
})
export class ElectricityPurchaseModule {}
