import { ApiProperty } from '@nestjs/swagger';
import {
  BaseResponseTypeDTO,
  ElectricityPlan,
  ElectricityProvider,
  PaginationResponseType,
} from '@utils/index';
import { ElectricityPurchase } from '@entities/index';

export class VerifyElectricityPurchaseDTO {
  @ApiProperty({ enum: ElectricityProvider })
  provider: ElectricityProvider;

  @ApiProperty()
  meterNumber: string;

  @ApiProperty()
  amount: number;

  @ApiProperty({ enum: ElectricityPlan, nullable: true })
  plan: ElectricityPlan;
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

  @ApiProperty()
  billerName: string;
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
