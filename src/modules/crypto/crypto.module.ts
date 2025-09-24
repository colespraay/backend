import { Module } from '@nestjs/common';
import { CryptoController } from './crypto.controller';
import { CryptoService } from './crypto.service';
import { QuidaxorderModule } from '@modules/quidaxorder/quidaxorder.module';
import { UserModule } from '@modules/user/user.module';
import { WalletModule } from '@modules/wallet/wallet.module';
import { TransactionModule } from '@modules/transaction/transaction.module';

@Module({
    imports: [

      // forwardRef(() => BillModule),
      QuidaxorderModule,
      UserModule,
      WalletModule,
      TransactionModule,
    ],
  controllers: [CryptoController],
  providers: [CryptoService]
})
export class CryptoModule {}
