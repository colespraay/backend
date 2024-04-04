import { Body, Post, Controller, UseGuards, Get, HttpStatus } from '@nestjs/common';
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



  // @Get('aggregateTotalGiftingumPerDay')
  // @ApiOperation({ summary: 'Aggregate Total Gifting Sum Per Day for the Past 10 Days' })
  // @ApiResponse({ status: HttpStatus.OK, description: 'Success', type: Object })
  // @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal Server Error' })
  // async aggregateTotalGiftingumPerDay(): Promise<any> {
  //   return this.giftingService.aggregateTotalGiftingumPerDay();
  // }

  @Get('admin/aggregateTotalGiftingumPerDay')
  @ApiOperation({ summary: 'Aggregate Total Gifting Sum Per Day for the Past 10 Days' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Success', type: Object })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal Server Error' })
  async aggregateTotalGiftingumPerDay(): Promise<any> {
    return this.giftingSrv.aggregateTotalGiftingumPerDay();
  }
}
