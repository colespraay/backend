import { Body, Post, Controller, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiProduces,
  ApiConsumes,
} from '@nestjs/swagger';
import { CurrentUser, RolesGuard, SetRequestTimeout } from '@schematics/index';
import { DecodedTokenKey } from '@utils/index';
import { WithdrawalService } from './withdrawal.service';
import {
  CreateWithdrawalDTO,
  WithdrawalResponseDTO,
} from './dto/withdrawal.dto';

@UseGuards(RolesGuard)
@ApiBearerAuth('JWT')
@ApiTags('withdrawal')
@Controller('withdrawal')
export class WithdrawalController {
  constructor(private readonly withdrawalSrv: WithdrawalService) {}

  @ApiOperation({ description: 'Make withdrawal from wallet' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: WithdrawalResponseDTO })
  @SetRequestTimeout(1000000)
  @Post()
  async makeWithdrawal(
    @Body() payload: CreateWithdrawalDTO,
    @CurrentUser(DecodedTokenKey.USER_ID) userId: string,
  ): Promise<WithdrawalResponseDTO> {
    return await this.withdrawalSrv.makeWithdrawal(payload, userId);
  }
}
