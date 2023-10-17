import { ApiProperty } from '@nestjs/swagger';
import { BaseResponseTypeDTO } from '@utils/index';

export class BillProviderPartial {
  @ApiProperty()
  name: string;
}

export class BillProviderDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => [String] })
  data: string[];
}

export class FlutterwaveBillPaymentResponsePartial {
  @ApiProperty()
  phone_number: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  network: string;

  @ApiProperty()
  flw_ref: string;

  @ApiProperty()
  tx_ref: string;

  @ApiProperty()
  reference: string;
}

export class FlutterwaveBillPaymentResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => FlutterwaveBillPaymentResponsePartial })
  data: FlutterwaveBillPaymentResponsePartial;
}

export class FlutterwaveDataPlanPartial {
  @ApiProperty()
  id: number;

  @ApiProperty()
  biller_code: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  default_commission: number;

  @ApiProperty()
  date_added: Date;

  @ApiProperty()
  country: string;

  @ApiProperty()
  biller_name: string;

  @ApiProperty()
  item_code: string;

  @ApiProperty()
  short_name: string;

  @ApiProperty()
  fee: number;

  @ApiProperty()
  commission_on_fee: boolean;

  @ApiProperty()
  label_name: string;

  @ApiProperty()
  amount: number;
}

export class FlutterwaveDataPlanDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => [FlutterwaveDataPlanPartial] })
  data: FlutterwaveDataPlanPartial[];
}
