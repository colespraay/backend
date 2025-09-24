import { Module } from '@nestjs/common';
import { QuidaxorderController } from './quidaxorder.controller';
import { QuidaxorderService } from './quidaxorder.service';
import { QuidaxOrder } from '@entities/quidax-order.entity';
import { UserModule } from '@modules/user/user.module';
import { WalletModule } from '@modules/wallet/wallet.module';
import { TransactionModule } from '@modules/transaction/transaction.module';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forFeature([QuidaxOrder]),
    // forwardRef(() => BillModule),
    UserModule,
    WalletModule,
    TransactionModule,
  ],
  controllers: [QuidaxorderController],
  providers: [QuidaxorderService],
  exports: [QuidaxorderService],
})
export class QuidaxorderModule {}
