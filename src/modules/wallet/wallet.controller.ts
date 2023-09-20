import {
  Controller,
  Get,
  Res,
  Post,
  Query,
  UseGuards,
  Body,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Response, Request } from 'express';
import { CurrentUser, RolesGuard } from '@schematics/index';
import { BaseResponseTypeDTO, DecodedTokenKey } from '@utils/index';
import { WalletService } from './wallet.service';
import {
  FindStatementOfAccountDTO,
  BankAccountStatementDTO,
  BankListDTO,
  FindTransferChargeDTO,
  VerifyAccountExistenceDTO,
  VerifyAccountExistenceResponseDTO,
  MakeWalletDebitTypeDTO,
} from './dto/wallet.dto';

@ApiTags('wallet')
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletSrv: WalletService) {}

  @UseGuards(RolesGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ description: 'Get list of banks' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: BankListDTO })
  @Get('/list-of-banks')
  async getBankLists(): Promise<BankListDTO> {
    return await this.walletSrv.getBankLists();
  }

  @UseGuards(RolesGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ description: 'Get list of charges for interbank transfers' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: FindTransferChargeDTO })
  @Get('/charges/inter-bank-transfers')
  async getListOfInterbankTransferCharges(): Promise<FindTransferChargeDTO> {
    return await this.walletSrv.getListOfInterbankTransferCharges();
  }

  @UseGuards(RolesGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({
    description:
      'Verify existence of users wallet number and destination account number',
  })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: VerifyAccountExistenceResponseDTO })
  @Post('/verify/account-existence')
  async verifyAccountExistence(
    @CurrentUser(DecodedTokenKey.VIRTUAL_ACCOUNT_NUMBER)
    sourceAccountNumber: string,
    @Body() payload: VerifyAccountExistenceDTO,
  ): Promise<VerifyAccountExistenceResponseDTO> {
    return await this.walletSrv.verifyAccountExistence(
      sourceAccountNumber,
      payload,
    );
  }

  @UseGuards(RolesGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({
    description: 'Make debit transfer from wallet to external bank account',
  })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: BaseResponseTypeDTO })
  @Post('/make-transfer')
  async makeTransferFromWallet(
    @CurrentUser(DecodedTokenKey.VIRTUAL_ACCOUNT_NUMBER)
    sourceAccountNumber: string,
    @Body() payload: MakeWalletDebitTypeDTO,
  ): Promise<BaseResponseTypeDTO> {
    return await this.walletSrv.makeTransferFromWallet(
      sourceAccountNumber,
      payload,
    );
  }

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
  async wemaBankWebhook(
    // @Req() req: Request,
    @Body() body: any,
  ): Promise<void> {
    console.log({ body });
  }

  // URL: https://playground.alat.ng/api-transaction-notification
  @Post('/wallet-notifications')
  async notificationAPI(
    // @Req() req: Request,
    @Body() body: any,
  ): Promise<void> {
    console.log({ body });

    // {
    //   "accountNumber": "{accountNumber}",
    //   "transactionType": "Credit",
    //   "amount": 10000,
    //   "narration": "Custom narration",
    //   "transactionDate": "1990-07-09T08:34:37.504Z"
    // }
  }
}
