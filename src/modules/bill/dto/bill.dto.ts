import { ApiProperty } from '@nestjs/swagger';
import { BaseResponseTypeDTO } from '@utils/index';

export class BillProviderPartial {
  @ApiProperty()
  name: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  displayName: string;
}

export class BillProviderDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => [BillProviderPartial] })
  data: BillProviderPartial[];
}

export class FlutterwaveBillItemVerificationPartial {
  @ApiProperty()
  response_code: string;

  @ApiProperty()
  address: string;

  @ApiProperty()
  response_message: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  biller_code: string;

  @ApiProperty()
  customer: string;

  @ApiProperty()
  product_code: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  fee: number;

  @ApiProperty()
  maximum: number;

  @ApiProperty()
  minimum: number;
}

export class FlutterwaveBillItemVerificationResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => FlutterwaveBillItemVerificationPartial })
  data: FlutterwaveBillItemVerificationPartial;

  selectedOne?: any;
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

export class PagaCablePaymentPartial {
  @ApiProperty()
  reference: string;

  @ApiProperty()
  amount: string;

  @ApiProperty()
  decoderNumber: string;

  @ApiProperty()
  transactionId: string;
}

export class PagaCablePaymentResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => PagaCablePaymentPartial })
  data: PagaCablePaymentPartial;
}

export class FlutterwaveBillPaymentResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => FlutterwaveBillPaymentResponsePartial })
  data: FlutterwaveBillPaymentResponsePartial;

  @ApiProperty({ nullable: true })
  token?: string;
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

export class FlutterwaveCableBillingOptionPartial {
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
  is_airtime: boolean;

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

export class FlutterwaveCableBillingOptionResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => [FlutterwaveCableBillingOptionPartial] })
  data: FlutterwaveCableBillingOptionPartial[];
}

export class PagaDataPlanPartial {
  @ApiProperty()
  validityPeriod: string;

  @ApiProperty()
  mobileOperatorId: number;

  @ApiProperty()
  servicePrice: number;

  @ApiProperty()
  dataValue: string;

  @ApiProperty()
  serviceName: string;

  @ApiProperty()
  serviceId: number;
}

export class PagaDataPlanDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => [PagaDataPlanPartial] })
  data: PagaDataPlanPartial[];
}

export class PagaMerchantPlanPartial {
  @ApiProperty()
  name: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  price: number;

  @ApiProperty()
  shortCode: string;
}

export class PagaMerchantPlanResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => [PagaMerchantPlanPartial] })
  data: PagaMerchantPlanPartial[];
}


export class CablePaymentRequestDTO {
  @ApiProperty()
  merchantServiceCode: string;

  @ApiProperty()
  decoderNumber: string;

  @ApiProperty({ description: 'Provider UUID, I.E Gotv, DSTV' })
  providerId: string;
}

export class PagaMeterDetailDTO {
  @ApiProperty()
  deviceName: string;

  @ApiProperty()
  meterNumber: string;
}
