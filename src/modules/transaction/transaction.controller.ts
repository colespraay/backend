import {
  Controller,
  Param,
  ParseUUIDPipe,
  Query,
  Get,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TransactionType } from '@utils/index';
import { Response } from 'express';
import { TransactionService } from './transaction.service';
import { FindStatementOfAccountDTO } from '@modules/wallet/dto/wallet.dto';
import {
  FindTransactionDTO,
  TransactionResponseDTO,
  TransactionsResponseDTO,
} from './dto/transaction.dto';
import { RolesGuard } from '@schematics/index';

@ApiTags('transaction')
@Controller('transaction')
export class TransactionController {
  constructor(private readonly transactionSrv: TransactionService) {}

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
}
