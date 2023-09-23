import { ApiProperty, PickType } from '@nestjs/swagger';
import { BaseResponseTypeDTO, TransactionType } from '@utils/index';

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

export class BankListPartialDTO {
  @ApiProperty()
  bankName: string;

  @ApiProperty()
  bankCode: string;
}

export class BankListDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => [BankListPartialDTO] })
  data: BankListPartialDTO[];
}

export class InterbankTransferChargeDTO {
  @ApiProperty()
  id: number;

  @ApiProperty()
  chargeFeeName: string;

  @ApiProperty()
  transactionType: number;

  @ApiProperty()
  charge: number;

  @ApiProperty()
  lower: number;

  @ApiProperty()
  upper: number;
}

export class FindTransferChargeDTO extends BaseResponseTypeDTO {
  @ApiProperty()
  termsAndConditions: string;

  @ApiProperty()
  termsAndConditionsUrl: string;

  @ApiProperty({ type: () => [InterbankTransferChargeDTO] })
  data: InterbankTransferChargeDTO[];
}

export class MakeWalletDebitTypeDTO {
  @ApiProperty({ nullable: true })
  securityInfo?: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  destinationBankCode: string;

  @ApiProperty()
  destinationBankName: string;

  @ApiProperty()
  destinationAccountNumber: string;

  @ApiProperty()
  destinationAccountName: string;

  @ApiProperty()
  narration: string;
}

export class VerifyAccountExistenceDTO extends PickType(
  MakeWalletDebitTypeDTO,
  [
    'destinationAccountName',
    'destinationAccountNumber',
    'destinationBankCode',
  ] as const,
) {}

export class VerifyAccountExistenceResponsePartial {
  @ApiProperty()
  bankCode: string;

  @ApiProperty()
  bankName: string;

  @ApiProperty()
  accountName: string;

  @ApiProperty()
  accountNumber: string;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  termsAndConditions: string;

  @ApiProperty()
  termsAndConditionsUrl: string;

  @ApiProperty({ type: () => [InterbankTransferChargeDTO] })
  chargeFee: InterbankTransferChargeDTO[];
}

export class VerifyAccountExistenceResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => VerifyAccountExistenceResponsePartial })
  data: VerifyAccountExistenceResponsePartial;
}

// TODO: Probably change to carmelCase
export class WebhookData {
  @ApiProperty()
  Email: string;

  @ApiProperty()
  Nuban: string;

  @ApiProperty()
  NubanName: string;

  @ApiProperty()
  Type: number;

  @ApiProperty()
  CustomerID: string;

  @ApiProperty()
  NubanStatus: string;

  @ApiProperty()
  PhoneNumber: string;

  @ApiProperty()
  RequestId: string;
}

export class WebhookResponseDTO {
  @ApiProperty()
  Title: string;

  @ApiProperty()
  Message: string;

  @ApiProperty({ type: () => WebhookData })
  Data: WebhookData;

  @ApiProperty()
  Request: number;
}

export class TransactionNotificationResponseDTO {
  @ApiProperty()
  accountNumber: string;

  @ApiProperty({ enum: TransactionType })
  transactionType: TransactionType;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  narration: string;

  @ApiProperty()
  transactionDate: Date;
}

export class TransferResponsePartial {
  @ApiProperty()
  narration: string;

  @ApiProperty()
  transactionReference: string;

  @ApiProperty()
  platformTransactionReference: string;

  @ApiProperty()
  orinalTxnTransactionDate: string;
}

export class TransferResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => TransferResponsePartial })
  data: TransferResponsePartial;
}
