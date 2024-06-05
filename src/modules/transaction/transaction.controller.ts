import {
  Controller,
  Param,
  ParseUUIDPipe,
  Query,
  Get,
  Res,
  UseGuards,
  HttpStatus,
  Post,
  Body,
  BadRequestException,
  HttpCode,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import {
  BaseResponseTypeDTO,
  DecodedTokenKey,
  PaginationRequestType,
  TransactionType,
} from '@utils/index';
import { CurrentUser, RolesGuard } from '@schematics/index';
import { UsersResponseDTO } from '@modules/user/dto/user.dto';
import { FindStatementOfAccountDTO } from '@modules/wallet/dto/wallet.dto';
import { TransactionService } from './transaction.service';
import {
  CreateTransactionDTO,
  FindTransactionDTO,
  TransPaginationDto,
  TransactionListHistoryDTO,
  TransactionListHistoryFilter,
  TransactionListHistoryGraphDTO,
  TransactionResponseDTO,
  TransactionsResponseDTO,
} from './dto/transaction.dto';
import { TransactionRecord } from '@entities/transaction-record.entity';

@ApiTags('transaction')
@Controller('transaction')
export class TransactionController {
  constructor(private readonly transactionSrv: TransactionService) {}

  @ApiBearerAuth('JWT')
  @UseGuards(RolesGuard)
  @ApiProduces('json')
  @ApiParam({
    enum: TransactionListHistoryFilter,
    name: 'filter',
    required: true,
  })
  @ApiOperation({
    description: 'Find breakdown of transactions, total, expense, income',
  })
  @ApiResponse({ type: () => TransactionListHistoryDTO })
  @Get('/history-summary/:filter')
  async findTransactionSummary(
    @Param('filter') filter: TransactionListHistoryFilter,
    @CurrentUser(DecodedTokenKey.USER_ID) userId: string,
  ): Promise<TransactionListHistoryDTO> {
    return await this.transactionSrv.findTransactionSummary(filter, userId);
  }

  @ApiBearerAuth('JWT')
  @UseGuards(RolesGuard)
  @ApiProduces('json')
  @ApiOperation({
    description: 'Find breakdown of transactions viewed via graph',
  })
  @ApiResponse({ type: () => TransactionListHistoryGraphDTO })
  @Get('/graph/history-summary')
  async transactionGraphSummary(
    @CurrentUser(DecodedTokenKey.USER_ID) userId: string,
  ): Promise<TransactionListHistoryGraphDTO> {
    return await this.transactionSrv.transactionGraphSummary(userId);
  }

  @ApiBearerAuth('JWT')
  @UseGuards(RolesGuard)
  @ApiProduces('json')
  @ApiOperation({ description: 'Find transaction by reference' })
  @ApiResponse({ type: () => TransactionResponseDTO })
  @Get('/find-transaction-by-ref/:reference')
  async findTransactionByReference(
    @Param('reference') reference: string,
  ): Promise<TransactionResponseDTO> {
    return await this.transactionSrv.findTransactionByReference(reference);
  }

  @ApiBearerAuth('JWT')
  @UseGuards(RolesGuard)
  @ApiProduces('json')
  @ApiOperation({
    description: 'Export statement of account to mailbox',
  })
  @ApiResponse({ type: () => BaseResponseTypeDTO })
  @Get('/export-soa')
  async exportStatementOfAccounts(
    @Query() payload: FindStatementOfAccountDTO,
    @CurrentUser(DecodedTokenKey.USER_ID) userId: string,
  ): Promise<BaseResponseTypeDTO> {
    return await this.transactionSrv.exportStatementOfAccounts(payload, userId);
  }

  @ApiBearerAuth('JWT')
  @UseGuards(RolesGuard)
  @ApiProduces('json')
  @ApiOperation({ description: 'Find transaction by ID' })
  @ApiResponse({ type: () => TransactionResponseDTO })
  @Get('/:transactionId')
  async findTransactionById(
    @Param('transactionId') transactionId: string,
  ): Promise<TransactionResponseDTO> {
    return await this.transactionSrv.findTransactionById(transactionId);
  }

  @ApiBearerAuth('JWT')
  @UseGuards(RolesGuard)
  @ApiQuery({ name: 'searchTerm', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'date', required: false })
  @ApiQuery({ name: 'time', required: false })
  @ApiQuery({ enum: TransactionType, name: 'type', required: false })
  @ApiQuery({ name: 'pageNumber', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiProduces('json')
  @ApiOperation({ description: 'Find and filter transactions' })
  @ApiResponse({ type: () => TransactionsResponseDTO })
  @Get()
  async findTransactions(
    @Query() payload: FindTransactionDTO,
  ): Promise<TransactionsResponseDTO> {
    return await this.transactionSrv.findTransactions(payload);
  }

  @ApiBearerAuth('JWT')
  @UseGuards(RolesGuard)
  @ApiQuery({ name: 'pageNumber', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiProduces('json')
  @ApiOperation({
    description: 'Find recent recipients logged-in user has made payments to',
  })
  @ApiResponse({ type: () => UsersResponseDTO })
  @Get('/find/recent-recipients')
  async findRecentRecipients(
    @CurrentUser(DecodedTokenKey.USER_ID) userId: string,
    @Query() pagination: PaginationRequestType,
  ): Promise<UsersResponseDTO> {
    return await this.transactionSrv.findRecentRecipients(userId, pagination);
  }

  @ApiOperation({
    description: 'Download SOA for date range in pdf format',
  })
  @ApiOperation({ description: 'Download Account list' })
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
  @ApiProduces('application/pdf')
  @Get('/download-soa/:userId')
  async downloadStatementOfAccounts(
    @Query() payload: FindStatementOfAccountDTO,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Res() response: Response,
  ) {
    const filePath = await this.transactionSrv.downloadStatementOfAccounts(
      payload,
      userId,
    );
    if (filePath?.fileName) {
      response.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filePath.fileName}"`,
      });
      response.download(filePath.path);
    }
  }

  @ApiOperation({ description: 'Download Transaction receipt' })
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
  @ApiProduces('application/pdf')
  @Get('/download-receipt/:transactionId')
  async downloadTransactionReceipt(
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
    @Res() response: Response,
  ) {
    const filePath = await this.transactionSrv.downloadTransactionReceipt(
      transactionId,
    );
    if (filePath?.fileName) {
      response.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filePath.fileName}"`,
      });
      response.download(filePath.path);
    }
  }

  @ApiBearerAuth('JWT')
  @UseGuards(RolesGuard)
  @ApiProduces('json')
  @ApiOperation({
    description: 'Export transaction receipt to mailbox',
  })
  @ApiResponse({ type: () => BaseResponseTypeDTO })
  @Get('/export-receipt/:transactionId')
  async exportTransactionReceiptToEmail(
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
    @CurrentUser(DecodedTokenKey.USER_ID) userId: string,
  ): Promise<BaseResponseTypeDTO> {
    return await this.transactionSrv.exportTransactionReceiptToEmail(
      transactionId,
      userId,
    );
  }

  @Get('user-all-transactions/:userId')
  @ApiOperation({ summary: 'Get transactions for a user with pagination' })
  @ApiResponse({ status: 200, description: 'Returns transactions and total count' })
  @ApiBadRequestResponse({ description: 'Invalid request parameters' })
  @HttpCode(200)
  async getTransactionsByUserId(
    @Param('userId') userId: string,
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 10,
  ): Promise<{ transactions: TransactionRecord[]; totalTransactions: number }> {
    return this.transactionSrv.getTransactionsByUserId(userId, page, limit);
  }


  @Get('search/:reference')
  @ApiOperation({ summary: 'Search transactions by reference (wildcard)' })
  @ApiResponse({ status: 200, type: [TransactionRecord], description: 'Found transactions' })
  async searchTransactionsByReference(
    @Param('reference') reference: string,
  ): Promise<TransactionRecord[]> {
    const transactions = await this.transactionSrv.findTransactionsByWildcardReference(reference);
    return transactions;
  }

  // @Post('dummy/create')
  // @ApiResponse({
  //   status: HttpStatus.CREATED,
  //   description: 'Transaction logged successfully',
  //   type: TransactionResponseDTO,
  // })
  // @ApiBadRequestResponse({
  //   description: 'Bad request. Check the request payload.',
  // })
  // async createTransaction(
  //   @Body() payload: CreateTransactionDTO,
  // ): Promise<TransactionResponseDTO> {
  //   try {
  //     const result = await this.transactionSrv.createTransaction(payload);
  //     return result;
  //   } catch (error) {
  //     if (error instanceof BadRequestException) {
  //       throw error;
  //     } else {
  //       throw new BadRequestException('Failed to create transaction.');
  //     }
  //   }
  // }

  // @Get('/admin/total-amount')
  // @ApiResponse({
  //   status: HttpStatus.OK,
  //   description: 'Total transaction amount calculated successfully',
  // })
  // @ApiResponse({
  //   status: HttpStatus.INTERNAL_SERVER_ERROR,
  //   description: 'Failed to calculate total transaction amount',
  // })
  // async getTotalTransactionAmount(): Promise<any> {
  //   return await this.transactionSrv.calculateTotalTransactionAmount();
  // }

  // @Get('/admin/aggregate-total')
  // @ApiResponse({
  //   status: HttpStatus.OK,
  //   description: 'Total transaction sum aggregated per day for the past 10 days',
  // })
  // @ApiResponse({
  //   status: HttpStatus.INTERNAL_SERVER_ERROR,
  //   description: 'Failed to aggregate total transaction sum per day',
  // })
  // async aggregateTotalTransactionSumPerDay(): Promise<any> {
  //   return await this.transactionSrv.aggregateTotalTransactionSumPerDay();
  // }


  // @Get("admin/get-all-transaction")
  // @ApiOperation({ summary: 'Get all transactions with pagination' })
  // @ApiResponse({
  //   status: HttpStatus.OK,
  //   description: 'Returns all transactions with pagination',
  //   type: [TransactionRecord],
  // })
  // @ApiResponse({
  //   status: HttpStatus.INTERNAL_SERVER_ERROR,
  //   description: 'Internal server error',
  // })
  // async getAllTransactions(
  //   @Query() paginationDto: TransPaginationDto,
  // ): Promise<any> {
  //   return await this.transactionSrv.getAllTransactions(paginationDto);
  // }


}
