import { Cron, CronExpression } from '@nestjs/schedule';
import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  Body,
  ParseFloatPipe
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiQuery,
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
  TransactionFeeType,
  TransactionFeeBreakdownDTO,
} from './dto/wallet.dto';

@ApiTags('wallet')
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletSrv: WalletService) {}

  @UseGuards(RolesGuard)
  @ApiQuery({ name: 'searchTerm', required: false })
  @ApiBearerAuth('JWT')
  @ApiOperation({ description: 'Get list of banks' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: BankListDTO })
  @Get('/list-of-banks')
  async getBankLists(
    @Query('searchTerm') searchTerm?: string
  ): Promise<BankListDTO> {
    return await this.walletSrv.getBankLists(searchTerm);
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

  @ApiQuery({ name: 'amount' })
  @ApiQuery({ name: 'type', enum: TransactionFeeType, required: false })
  @Get('/fees/find-transaction-fees')
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: () => TransactionFeeBreakdownDTO })
  async calculateTransactionFee(
    @Query('amount', ParseFloatPipe) amount: number,
    @Query('type') type: TransactionFeeType
  ): Promise<TransactionFeeBreakdownDTO> { 
    return await this.walletSrv.calculateTransactionFee(amount, type);
  }

  @Post('/webhook')
  async pagaWebhook(@Body() body: any): Promise<void> {
    await this.walletSrv.webhookHandler(body);
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async checkTransactions(): Promise<void> { 
    await this.walletSrv.checkTransactions();
  }
}
