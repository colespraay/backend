import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BettingPurchase } from '@entities/index';
import { BillModule } from '@modules/bill/bill.module';
import { WalletModule } from '@modules/wallet/wallet.module';
import { TransactionModule } from '@modules/transaction/transaction.module';
import { BettingPurchaseController } from './betting-purchase.controller';
import { BettingPurchaseService } from './betting-purchase.service';
import { UserModule } from '@modules/user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BettingPurchase]),
    forwardRef(() => BillModule),
    TransactionModule,
    UserModule,
    WalletModule,
  ],
  controllers: [BettingPurchaseController],
  providers: [BettingPurchaseService],
  exports: [BettingPurchaseService],
})
export class BettingPurchaseModule {}
