import { ApiProperty } from '@nestjs/swagger';
import { TransactionRecord } from '@entities/index';
import {
  BaseResponseTypeDTO,
  FileExportDataResponseDTO,
  PaginationRequestType,
  PaginationResponseType,
  PaymentStatus,
  TransactionType,
  TransactionTypeAction,
} from '@utils/index';
import { IsDate, IsInt, IsOptional, Min } from 'class-validator';

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

export class TransactionDateRangeDto {
  @ApiProperty({ default: new Date().toISOString() }) // Default value for startDate
  @IsDate()
  @IsOptional()
  startDate?: Date = new Date();

  @ApiProperty({ default: new Date().toISOString() }) // Default value for endDate
  @IsDate()
  @IsOptional()
  endDate?: Date = new Date();
}

export class TransPaginationDto {
  @ApiProperty({ default: 1 })
  @IsInt()
  @Min(1)
  page: number;

  @ApiProperty({ default: 10 })
  @IsInt()
  @Min(1)
  limit: number;
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

  @ApiProperty({ enum: PaymentStatus, nullable: true })
  transactionStatus?: PaymentStatus;

  @ApiProperty({ nullable: true })
  currency?: string;

  @ApiProperty({ enum: TransactionTypeAction })
  typeAction?: TransactionTypeAction;

  @ApiProperty({ nullable: true })
  receiverUserId?: string;

  @ApiProperty({ nullable: true })
  reference?: string;

  @ApiProperty({ nullable: true })
  jsonResponse?: any;


    // 👉 NEW OPTIONAL BANK FIELDS
  @ApiProperty({ nullable: true })
  bankName?: string;

  @ApiProperty({ nullable: true })
  accountName?: string;

  @ApiProperty({ nullable: true })
  accountNumber?: string;
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

export enum Month {
  JANUARY = 'JANUARY',
  FEBRUARY = 'FEBRUARY',
  MARCH = 'MARCH',
  APRIL = 'APRIL',
  MAY = 'MAY',
  JUNE = 'JUNE',
  JULY = 'JULY',
  AUGUST = 'AUGUST',
  SEPTEMBER = 'SEPTEMBER',
  OCTOBER = 'OCTOBER',
  NOVEMBER = 'NOVEMBER',
  DECEMBER = 'DECEMBER',
}

export class TransactionListHistoryGraphPartial {
  @ApiProperty({ enum: Month })
  month: Month;

  @ApiProperty()
  monthCode: number;

  @ApiProperty()
  totalAmount: number;
}

export class TransactionListHistoryGraphDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => [TransactionListHistoryGraphPartial] })
  data: TransactionListHistoryGraphPartial[];
}
