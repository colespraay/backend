import { ApiProperty } from '@nestjs/swagger';

export class FindStatementOfAccountDTO {
  @ApiProperty()
  startDate: Date;

  @ApiProperty()
  endDate: Date;
}

export class BankStatementDataEntity {
  @ApiProperty()
  title: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  type: string; // Credit | Debit

  @ApiProperty()
  date: string;

  @ApiProperty()
  narration: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  creditType: string;

  @ApiProperty()
  sender: string;

  @ApiProperty()
  senderAccountNumber: string;

  @ApiProperty()
  destinationBank: string;

  @ApiProperty()
  destinationAccountNumber: string;

  @ApiProperty()
  recieverName: string;

  @ApiProperty()
  referenceId: string;

  @ApiProperty()
  isViewReceiptEnabled: boolean;

  @ApiProperty()
  tranId: string;
}

export class BankAccountStatementDTO {
  @ApiProperty()
  message: string;

  @ApiProperty()
  status: boolean;

  @ApiProperty({ type: () => [BankAccountStatementDTO], nullable: true })
  data?: BankAccountStatementDTO[];
}
