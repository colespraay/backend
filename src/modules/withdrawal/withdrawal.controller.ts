import { Body, Post, Controller, UseGuards } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiProduces,
  ApiConsumes,
} from '@nestjs/swagger';
import { CurrentUser, RolesGuard } from '@schematics/index';
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

  @ApiOperation({ description: 'Make withdrawal' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: WithdrawalResponseDTO })
  @Post()
  async makeWithdrawal(
    @Body() payload: CreateWithdrawalDTO,
    @CurrentUser(DecodedTokenKey.USER_ID) userId: string,
  ): Promise<WithdrawalResponseDTO> {
    return await this.withdrawalSrv.makeWithdrawal(payload, userId);
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async confirmWithdrawals(): Promise<void> { 
    await this.withdrawalSrv.confirmWithdrawals();
  }
}
