import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletModule } from '@modules/wallet/wallet.module';
import { TransactionModule } from '@modules/transaction/transaction.module';
import { UserModule } from '@modules/user/user.module';
import { BillModule } from '@modules/bill/bill.module';
import { GiftcardController } from './giftcard.controller';
import { GiftcardService } from './giftcard.service';
import { GiftCard } from '@entities/index';

@Module({
  imports: [
    TypeOrmModule.forFeature([GiftCard]),
    // forwardRef(() => BillModule),
    UserModule,
    WalletModule,
    TransactionModule,
  ],
  controllers: [GiftcardController],
  providers: [GiftcardService],
  exports: [GiftcardService],
})
export class GiftcardModule {}

