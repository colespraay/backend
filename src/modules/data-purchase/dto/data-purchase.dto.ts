import { ApiProperty } from '@nestjs/swagger';
import { DataPurchase } from '@entities/index';
import { AirtimeProvider, BaseResponseTypeDTO } from '@utils/index';
import { CreateAirtimePurchaseDTO } from '@modules/airtime-purchase/dto/airtime-purchase.dto';

export class CreateDataPurchaseDTO {
  @ApiProperty({ enum: AirtimeProvider })
  provider: AirtimeProvider;

  @ApiProperty()
  phoneNumber: string;

  @ApiProperty()
  dataPlanId: number;

  @ApiProperty()
  transactionPin: string;
}

export class CreateFlutterwaveDataPurchaseDTO extends CreateAirtimePurchaseDTO {
  @ApiProperty()
  type: string;
}

export class DataPurchaseResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => DataPurchase })
  data: DataPurchase;
}

export class DataPurchasesResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => [DataPurchase] })
  data: DataPurchase[];
}
