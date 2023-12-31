import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CablePurchase } from '@entities/index';
import { TransactionModule } from '@modules/transaction/transaction.module';
import { UserModule } from '@modules/user/user.module';
import { BillModule } from '@modules/bill/bill.module';
import { CablePurchaseService } from './cable-purchase.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CablePurchase]),
    forwardRef(() => BillModule),
    UserModule,
    TransactionModule,
  ],
  providers: [CablePurchaseService],
  exports: [CablePurchaseService],
})
export class CablePurchaseModule {}
