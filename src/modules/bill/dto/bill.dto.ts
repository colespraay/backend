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
