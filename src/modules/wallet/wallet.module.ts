import { Module, forwardRef } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { BankModule, UserModule } from '../index';

@Module({
  imports: [UserModule, forwardRef(() => BankModule)],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
