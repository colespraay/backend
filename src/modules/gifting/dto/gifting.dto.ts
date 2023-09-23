import { ApiProperty } from '@nestjs/swagger';
import { Gifting } from '@entities/index';
import { BaseResponseTypeDTO, PaginationResponseType } from '@utils/index';

export class SendGiftDTO {
  @ApiProperty()
  amount: number;

  @ApiProperty()
  receiverTag: string;

  @ApiProperty()
  transactionPin: string;
}

export class GiftingResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => Gifting })
  data: Gifting;
}

export class GiftingsResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => [Gifting] })
  data: Gifting[];

  @ApiProperty({ type: () => PaginationResponseType })
  paginationControl?: PaginationResponseType;
}
