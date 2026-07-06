import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { WalletModule } from '@modules/wallet/wallet.module';
import { TransactionModule } from '@modules/transaction/transaction.module';
import { UserModule } from '@modules/user/user.module';
import { VirtualNumberController } from './virtual-number.controller';

import { VirtualNumberOrder } from '@entities/index';
import { VirtualNumberService } from './virtual-number.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([VirtualNumberOrder]),
    // ScheduleModule.forRoot() only needs to run once, application-wide.
    // If AppModule (or another module) already calls it, this line is a harmless no-op —
    // remove it here if you'd rather keep the registration centralized in AppModule.
    ScheduleModule.forRoot(),
    UserModule,
    WalletModule,
    TransactionModule,
  ],
  controllers: [VirtualNumberController],
  providers: [VirtualNumberService],
  exports: [VirtualNumberService],
})
export class VirtualNumberModule {}