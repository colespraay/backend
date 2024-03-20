import { ApiProperty } from '@nestjs/swagger';
import { BaseResponseTypeDTO, PaginationResponseType } from '@utils/index';
import { ElectricityPurchase } from '@entities/index';

export class VerifyElectricityPurchaseDTO {
  @ApiProperty()
  providerId: string;

  @ApiProperty()
  meterNumber: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  merchantPlan: string;
}

export class ElectricityPurchaseVerificationPartial {
  @ApiProperty()
  meterNumber: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  billerName: string;
}

export class ElectricityPurchaseVerificationDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => ElectricityPurchaseVerificationPartial })
  data: ElectricityPurchaseVerificationPartial;
}

export class CreateElectricityPurchaseDTO extends VerifyElectricityPurchaseDTO {
  @ApiProperty()
  transactionPin: string;
}

export class ElectricityPurchaseResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => ElectricityPurchase })
  data: ElectricityPurchase;
}

export class ElectricityPurchasesResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => [ElectricityPurchase] })
  data: ElectricityPurchase[];

  @ApiProperty({ type: () => PaginationResponseType })
  paginationControl?: PaginationResponseType;
}
