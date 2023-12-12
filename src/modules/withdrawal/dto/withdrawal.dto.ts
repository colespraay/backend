import { ApiProperty } from '@nestjs/swagger';
import { Withdrawal } from '@entities/index';
import { BaseResponseTypeDTO, PaginationResponseType } from '@utils/index';

export class CreateWithdrawalDTO {
  @ApiProperty()
  bankName: string;

  @ApiProperty()
  bankCode: string;

  @ApiProperty()
  accountNumber: string;

  @ApiProperty()
  transactionPin: string;

  @ApiProperty()
  amount: number;
}

export class WithdrawalResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => Withdrawal })
  data: Withdrawal;
}

export class WithdrawalsResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => [Withdrawal] })
  data: Withdrawal[];

  @ApiProperty({ type: () => PaginationResponseType })
  paginationControl?: PaginationResponseType;
}
