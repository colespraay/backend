import { ApiProperty } from '@nestjs/swagger';
import { Transaction } from '@entities/index';
import {
  BaseResponseTypeDTO,
  PaginationRequestType,
  PaginationResponseType,
  TransactionType,
} from '@utils/index';

export class TransactionResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => Transaction })
  data: Transaction;
}

export class TransactionsResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => [Transaction] })
  data: Transaction[];

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

  @ApiProperty()
  reference: string;

  @ApiProperty({ enum: TransactionType })
  type: TransactionType;
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
