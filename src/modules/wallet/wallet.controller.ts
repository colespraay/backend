import { Controller, Get, Res, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser, RolesGuard } from '@schematics/index';
import { DecodedTokenKey } from '@utils/index';
import { WalletService } from './wallet.service';
import {
  FindStatementOfAccountDTO,
  BankAccountStatementDTO,
} from './dto/wallet.dto';

@ApiTags('wallet')
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletSrv: WalletService) {}

  @UseGuards(RolesGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ description: 'Get statement of accounts for logged in user' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: BankAccountStatementDTO })
  @Get('/get-statement-of-accounts')
  async getStatementOfAccounts(
    @CurrentUser(DecodedTokenKey.VIRTUAL_ACCOUNT_NUMBER) accountNumber: string,
    @Query() payload: FindStatementOfAccountDTO,
  ): Promise<BankAccountStatementDTO> {
    return await this.walletSrv.getStatementOfAccounts(accountNumber, payload);
  }

  @Post('/webhook')
  async wemaBankWebhook(@Res() res: Response): Promise<void> {
    console.log({ res });
  }

  // URL: https://playground.alat.ng/api-transaction-notification
  @Post('/wallet-notifications')
  async notificationAPI(@Res() res: Response): Promise<void> {
    console.log({ res });

    // {
    //   "accountNumber": "{accountNumber}",
    //   "transactionType": "Credit",
    //   "amount": 10000,
    //   "narration": "Custom narration",
    //   "transactionDate": "1990-07-09T08:34:37.504Z"
    // }
  }
}
