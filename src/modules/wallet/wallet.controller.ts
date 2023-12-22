import { Controller, Get, Post, Query, UseGuards, Body } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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
  TransactionNotificationResponseDTO,
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

  // @Post('/webhook')
  // async wemaBankWebhook(@Body() body: WebhookResponseDTO): Promise<void> {
  //   await this.walletSrv.webhookHandler(body);
  // }

  // URL: https://playground.alat.ng/api-transaction-notification
  // @Post('/wallet-notifications')
  // async transactionNotificationWebhook(
  //   @Body() body: TransactionNotificationResponseDTO,
  // ): Promise<void> {
  //   await this.walletSrv.transactionNotificationWebhookHandler(body);
  // }

  @Post('/webhook')
  async flutterwaveWebhook(@Body() body: any): Promise<void> {
    await this.walletSrv.webhookHandler(body);
  }
}
