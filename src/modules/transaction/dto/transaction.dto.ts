import { ApiProperty } from '@nestjs/swagger';
import { TransactionRecord } from '@entities/index';
import {
  BaseResponseTypeDTO,
  FileExportDataResponseDTO,
  PaginationRequestType,
  PaginationResponseType,
  TransactionType,
} from '@utils/index';

export class TransactionResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => TransactionRecord })
  data: TransactionRecord;
}

export class TransactionsResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => [TransactionRecord] })
  data: TransactionRecord[];

  @ApiProperty({ type: () => PaginationResponseType })
  paginationControl?: PaginationResponseType;
}

export class CreateTransactionDTO {
  @ApiProperty()
  amount: number;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  currentBalanceBeforeTransaction: number;

  @ApiProperty()
  narration: string;

  @ApiProperty({ enum: TransactionType })
  type: TransactionType;

  @ApiProperty()
  transactionDate: string;

  @ApiProperty({ nullable: true })
  reference?: string;
}

export class FindTransactionDTO extends PaginationRequestType {
  @ApiProperty()
  date: string;

  @ApiProperty()
  time: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  searchTerm: string;

  @ApiProperty({ enum: TransactionType })
  type: TransactionType;
}

export class ExportSOADTO extends FileExportDataResponseDTO {
  @ApiProperty()
  recipients: string[];

  @ApiProperty()
  startDate: Date;

  @ApiProperty()
  endDate: Date;
}

export class ExportReceiptDTO extends FileExportDataResponseDTO {
  @ApiProperty()
  recipients: string[];

  @ApiProperty({ type: () => TransactionRecord })
  transaction: TransactionRecord;
}

export class TransactionListHistoryDTO {
  @ApiProperty()
  income: number;

  @ApiProperty()
  expense: number;

  @ApiProperty()
  total: number;
}

export enum TransactionListHistoryFilter {
  LAST_6_MONTHS = 'LAST_6_MONTHS',
  LAST_3_MONTHS = 'LAST_3_MONTHS',
  LAST_30_DAYS = 'LAST_30_DAYS',
  LAST_7_DAYS = 'LAST_7_DAYS',
}
