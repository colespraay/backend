import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserAccount } from '@entities/index';
import { WalletModule } from '@modules/wallet/wallet.module';
import { UserAccountController } from './user-account.controller';
import { UserAccountService } from './user-account.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserAccount]),
    forwardRef(() => WalletModule),
  ],
  controllers: [UserAccountController],
  providers: [UserAccountService],
  exports: [UserAccountService],
})
export class UserAccountModule {}
