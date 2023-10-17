import { Body, Controller, Param, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { User } from '@entities/index';
import { CurrentUser, RolesGuard } from '@schematics/index';
import { AirtimeProvider, DecodedTokenKey } from '@utils/index';
import { AirtimePurchaseService } from '@modules/airtime-purchase/airtime-purchase.service';
import {
  AirtimePurchaseResponseDTO,
  CreateAirtimePurchaseDTO,
} from '@modules/airtime-purchase/dto/airtime-purchase.dto';
import { DataPurchaseService } from '@modules/data-purchase/data-purchase.service';
import {
  CreateDataPurchaseDTO,
  DataPurchaseResponseDTO,
} from '@modules/data-purchase/dto/data-purchase.dto';
import { BillService } from './bill.service';
import { BillProviderDTO, FlutterwaveDataPlanDTO } from './dto/bill.dto';

@ApiBearerAuth('JWT')
@UseGuards(RolesGuard)
@ApiTags('bill')
@Controller('bill')
export class BillController {
  constructor(
    private readonly billSrv: BillService,
    private readonly dataPurchaseSrv: DataPurchaseService,
    private readonly airtimePurchaseSrv: AirtimePurchaseService,
  ) {}

  @ApiOperation({ description: 'Buy airtime' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: AirtimePurchaseResponseDTO })
  @Post('/airtime-purchase')
  async createAirtimePurchase(
    @Body() payload: CreateAirtimePurchaseDTO,
    @CurrentUser(DecodedTokenKey.USER) user: User,
  ): Promise<AirtimePurchaseResponseDTO> {
    return await this.airtimePurchaseSrv.createAirtimePurchase(payload, user);
  }

  @ApiOperation({ description: 'Buy data plan' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: DataPurchaseResponseDTO })
  @Post('/data-purchase')
  async createDataPurchase(
    @Body() payload: CreateDataPurchaseDTO,
    @CurrentUser(DecodedTokenKey.USER) user: User,
  ): Promise<DataPurchaseResponseDTO> {
    return await this.dataPurchaseSrv.createDataPurchase(payload, user);
  }

  @ApiParam({ enum: AirtimeProvider, name: 'provider' })
  @ApiOperation({ description: 'Find data plans for a specific provider' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: FlutterwaveDataPlanDTO })
  @Get('/data-purchase/find-plans/:provider')
  async findDataPlansForProvider(
    @Param('provider') provider: AirtimeProvider,
  ): Promise<FlutterwaveDataPlanDTO> {
    return await this.billSrv.findDataPlansForProvider(provider);
  }

  @ApiOperation({ description: 'Find cable providers' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: BillProviderDTO })
  @Get('/cable-providers')
  async findCableProviders(): Promise<BillProviderDTO> {
    return await this.billSrv.findCableProviders();
  }

  @ApiOperation({ description: 'Find airtime providers' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: BillProviderDTO })
  @Get('/airtime-providers')
  async findAirtimeProviders(): Promise<BillProviderDTO> {
    return await this.billSrv.findAirtimeProviders();
  }

  @ApiOperation({ description: 'Find electricity providers' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: BillProviderDTO })
  @Get('/electricity-providers')
  async findElectricityProviders(): Promise<BillProviderDTO> {
    return await this.billSrv.findElectricityProviders();
  }

  @ApiOperation({ description: 'Find internet providers' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: BillProviderDTO })
  @Get('/internet-providers')
  async findInternetProviders(): Promise<BillProviderDTO> {
    return await this.billSrv.findElectricityProviders();
  }
}
