import { Body, Post, Controller, UseGuards, Get, Query, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiProduces,
  ApiConsumes,
  ApiQuery,
} from '@nestjs/swagger';
import { CurrentUser, Roles, RolesGuard, SetRequestTimeout } from '@schematics/index';
import { AppRole, DecodedTokenKey } from '@utils/index';
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

  // --- NEW ADMIN ENDPOINTS ---

  @ApiOperation({ description: 'Get pending withdrawals (Admin)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @Get('pending')
@Roles(AppRole.ADMIN) 
  async getPendingWithdrawals(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return await this.withdrawalSrv.getPendingWithdrawals(page, limit);
  }

  @ApiOperation({ description: 'Approve a pending withdrawal (Admin)' })
  @Post('approve/:id')
@Roles(AppRole.ADMIN) 
  async approveWithdrawal(@Param('id') id: string) {
    return await this.withdrawalSrv.approveWithdrawal(id);
  }

  @ApiOperation({ description: 'Decline a pending withdrawal (Admin)' })
  @Post('decline/:id')
  @Roles(AppRole.ADMIN) 
  async declineWithdrawal(@Param('id') id: string) {
    return await this.withdrawalSrv.declineWithdrawal(id);
  }
}