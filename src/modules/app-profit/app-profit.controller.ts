import { Controller, Get, UseGuards } from '@nestjs/common';
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
}
