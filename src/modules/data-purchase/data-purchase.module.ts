import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataPurchase } from '@entities/index';
import { BillModule } from '@modules/bill/bill.module';
import { UserModule } from '@modules/user/user.module';
import { TransactionModule } from '@modules/transaction/transaction.module';
import { DataPurchaseController } from './data-purchase.controller';
import { DataPurchaseService } from './data-purchase.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DataPurchase]),
    forwardRef(() => BillModule),
    UserModule,
    TransactionModule,
  ],
  controllers: [DataPurchaseController],
  providers: [DataPurchaseService],
  exports: [DataPurchaseService],
})
export class DataPurchaseModule {}
