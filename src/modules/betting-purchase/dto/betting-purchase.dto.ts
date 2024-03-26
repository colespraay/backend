import { ApiProperty, OmitType } from '@nestjs/swagger';
import { VerifyElectricityPurchaseDTO } from '@modules/electricity-purchase/dto/electricity-purchase.dto';
import { BettingPurchase } from '@entities/index';
import { BaseResponseTypeDTO } from '@utils/index';

export class VerifyBettingPurchaseDTO extends OmitType(
  VerifyElectricityPurchaseDTO,
  ['meterNumber'] as const,
) {
  @ApiProperty()
  bettingWalletId: string;
}

export class CreateBettingPurchaseDTO extends VerifyBettingPurchaseDTO {
  @ApiProperty()
  transactionPin: string;
}

export class BettingPurchaseResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => BettingPurchase })
  data: BettingPurchase;
}

export class BettingPurchasesResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => [BettingPurchase] })
  data: BettingPurchase[];
}
