import { ApiProperty, OmitType } from '@nestjs/swagger';
import { BettingPurchase } from '@entities/index';
import { BaseResponseTypeDTO } from '@utils/index';
import { VerifyElectricityPurchaseDTO } from '@modules/electricity-purchase/dto/electricity-purchase.dto';

export class VerifyBettingPurchaseDTO extends OmitType(
  VerifyElectricityPurchaseDTO,
  ['meterNumber'] as const,
) {
  @ApiProperty()
  bettingWalletId: string;
}

export class CreateBettingPurchaseDTO extends OmitType(
  VerifyBettingPurchaseDTO,
  ['merchantPlan'] as const,
) {
  @ApiProperty()
  transactionPin: string;

  @ApiProperty({ nullable: true })
  merchantPlan?: string;
}

export class BettingPurchaseResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => BettingPurchase })
  data: BettingPurchase;
}

export class BettingPurchasesResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => [BettingPurchase] })
  data: BettingPurchase[];
}
