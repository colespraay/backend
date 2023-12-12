import { ApiProperty } from '@nestjs/swagger';
import { AirtimePurchase } from '@entities/index';
import { AirtimeProvider, BaseResponseTypeDTO } from '@utils/index';

export class CreateAirtimePurchaseDTO {
  @ApiProperty({ enum: AirtimeProvider })
  provider: AirtimeProvider;

  @ApiProperty()
  phoneNumber: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  transactionPin: string;
}

export class AirtimePurchaseResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => AirtimePurchase })
  data: AirtimePurchase;
}

export class AirtimePurchasesResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => [AirtimePurchase] })
  data: AirtimePurchase[];
}
