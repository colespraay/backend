import { Module, forwardRef } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { UserAccountModule } from '@modules/user-account/user-account.module';
import { BankModule, UserModule } from '../index';

@Module({
  imports: [
    forwardRef(() => UserModule),
    forwardRef(() => BankModule),
    UserAccountModule,
  ],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
