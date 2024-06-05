import { ApiProperty, OmitType } from '@nestjs/swagger';
import { BaseResponseTypeDTO, CableProvider } from '@utils/index';
import { CreateAirtimePurchaseDTO } from '@modules/airtime-purchase/dto/airtime-purchase.dto';
import { DataPurchase } from '@entities/index';

export class CreateDataPurchaseDTO {
  @ApiProperty()
  providerId: string;

  @ApiProperty()
  phoneNumber: string;

  @ApiProperty()
  dataPlanId: number;

  @ApiProperty()
  transactionPin: string;
}

export class CreateDataPurchaseDtoDemo {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  dataPlanId: number;

  @ApiProperty()
  phoneNumber: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  providerId: string;
}

export class CreateFlutterwaveDataPurchaseDTO extends OmitType(
  CreateAirtimePurchaseDTO,
  ['providerId'] as const,
) {
  @ApiProperty()
  operatorServiceId: string;

  @ApiProperty()
  type: string;
}

export class CreateFlutterwaveCablePlanPurchaseDTO extends OmitType(
  CreateAirtimePurchaseDTO,
  ['phoneNumber', 'providerId'] as const,
) {
  @ApiProperty()
  smartCardNumber: string;

  @ApiProperty({ enum: CableProvider })
  provider: CableProvider;
}

export class DataPurchaseResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => DataPurchase })
  data: DataPurchase;
}

export class DataPurchasesResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => [DataPurchase] })
  data: DataPurchase[];
}
