import { ApiProperty } from '@nestjs/swagger';
import { BaseResponseTypeDTO, CableProvider } from '@utils/index';
import { CablePurchase } from '@entities/index';

export class CreateCableProviderDTO {
  @ApiProperty({ example: 'GOHAN' })
  cablePlanId: string;

  @ApiProperty({ enum: CableProvider })
  providerId: CableProvider;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  smartCardNumber: string;

  @ApiProperty()
  transactionPin: string;
}

export class CablePurchaseResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => CablePurchase })
  data: CablePurchase;
}

export class CablePurchasesResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => [CablePurchase] })
  data: CablePurchase[];
}
