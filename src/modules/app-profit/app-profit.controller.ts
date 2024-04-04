import { Controller, Get, HttpStatus, UseGuards } from '@nestjs/common';
import {
    ApiResponse, 
    ApiTags,
    ApiOperation,
    ApiProduces,
    ApiConsumes,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { BaseResponseTypeDTO, DecodedTokenKey } from '@utils/index';
import { CurrentUser, RolesGuard } from '@schematics/index';
import { AppProfitService } from './app-profit.service';
import { CurrentAppProfitDTO } from './dto/app-profit.dto';

@ApiBearerAuth('JWT')
@UseGuards(RolesGuard)
@ApiTags('app-profit')
@Controller('app-profit')
export class AppProfitController {
    constructor(private readonly appProfitSrv: AppProfitService) {}

    @ApiOperation({ description: 'Clear payouts and restart profit tracking cycle' })
    @ApiProduces('json')
    @ApiConsumes('application/json')
    @ApiResponse({ type: BaseResponseTypeDTO })
    @Get('/clear-payouts')
    async clearPayouts(@CurrentUser(DecodedTokenKey.USER_ID) userId: string): Promise<BaseResponseTypeDTO> { 
        return await this.appProfitSrv.clearPayouts(userId);
    }

    @ApiOperation({ description: 'Find profits available for withdrawal as app-profits' })
    @ApiProduces('json')
    @ApiConsumes('application/json')
    @ApiResponse({ type: CurrentAppProfitDTO })
    @Get('/profits/available-for-withdrawal')
    async getCurrentAppProfitsAvailableForWithdrawal(): Promise<CurrentAppProfitDTO> {
        return await this.appProfitSrv.getCurrentAppProfitsAvailableForWithdrawal();
    }

    // @Get('sum-up')
    // @ApiResponse({
    //   status: HttpStatus.OK,
    //   description: 'Summed up app profit retrieved successfully',
    //   type: Number,
    // })
    // @ApiResponse({
    //   status: HttpStatus.INTERNAL_SERVER_ERROR,
    //   description: 'Failed to sum up app profit',
    // })
    // async sumUpAppProfitAndReturn(): Promise<number> {
    //   const totalAppProfit = await this.appProfitService.sumUpAppProfit();
    //   return totalAppProfit;
    // }


    @Get('admin/get-total-revenue')
    @ApiResponse({
      status: HttpStatus.OK,
      description: 'Summed up app profit retrieved successfully',
      type: Number,
    })
    @ApiResponse({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      description: 'Failed to sum up app profit',
    })
    async sumUpAppProfitAndReturn(): Promise<number> {
      const totalAppProfit = await this.appProfitSrv.sumUpAppProfitAndReturn();
      return totalAppProfit;
    }
}
