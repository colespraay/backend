import { Body, Post, Controller, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, RolesGuard } from '@schematics/index';
import { DecodedTokenKey } from '@utils/index';
import { GiftingService } from './gifting.service';
import { SendGiftDTO, GiftingResponseDTO } from './dto/gifting.dto';

@ApiBearerAuth('JWT')
@UseGuards(RolesGuard)
@ApiTags('gifting')
@Controller('gifting')
export class GiftingController {
  constructor(private readonly giftingSrv: GiftingService) {}

  @ApiOperation({ description: 'Send gift to user' })
  @ApiResponse({ type: () => GiftingResponseDTO })
  @Post('/send-gift')
  async sendGift(
    @Body() payload: SendGiftDTO,
    @CurrentUser(DecodedTokenKey.USER_ID) userId: string,
  ): Promise<GiftingResponseDTO> {
    return await this.giftingSrv.sendGift(payload, userId);
  }
}
