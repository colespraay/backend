import {
  Body,
  Controller,
  Param,
  Get,
  Post,
  UseGuards,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { User } from '@entities/index';
import { CurrentUser, RolesGuard, SetRequestTimeout } from '@schematics/index';
import { CableProvider, DecodedTokenKey } from '@utils/index';
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
import { CablePurchaseService } from '@modules/cable-purchase/cable-purchase.service';
import {
  CreateElectricityPurchaseDTO,
  ElectricityPurchaseResponseDTO,
  ElectricityPurchaseVerificationDTO,
  VerifyElectricityPurchaseDTO,
} from '@modules/electricity-purchase/dto/electricity-purchase.dto';
import { ElectricityPurchaseService } from '@modules/electricity-purchase/electricity-purchase.service';
import {
  CablePurchaseResponseDTO,
  CreateCableProviderDTO,
} from '@modules/cable-purchase/dto/cable-purchase.dto';
import { BillService } from './bill.service';
import {
  BillProviderDTO,
  FlutterwaveCableBillingOptionResponseDTO,
  PagaDataPlanDTO,
  PagaMerchantPlanResponseDTO,
} from './dto/bill.dto';
import { BettingPurchaseService } from '@modules/betting-purchase/betting-purchase.service';
import {
  CreateBettingPurchaseDTO,
  BettingPurchaseResponseDTO,
} from '@modules/betting-purchase/dto/betting-purchase.dto';

@ApiBearerAuth('JWT')
@UseGuards(RolesGuard)
@ApiTags('bill')
@Controller('bill')
export class BillController {
  constructor(
    private readonly billSrv: BillService,
    private readonly electricityPurchaseSrv: ElectricityPurchaseService,
    private readonly dataPurchaseSrv: DataPurchaseService,
    private readonly airtimePurchaseSrv: AirtimePurchaseService,
    private readonly cablePurchaseSrv: CablePurchaseService,
    private readonly bettingPurchaseSrv: BettingPurchaseService,
  ) {}

  @ApiOperation({ description: 'Fund betting wallet' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: BettingPurchaseResponseDTO })
  @SetRequestTimeout(1000000)
  @Post('/fund-betting-wallet')
  async fundBettingWallet(
    @Body() payload: CreateBettingPurchaseDTO,
    @CurrentUser(DecodedTokenKey.USER) user: User,
  ): Promise<BettingPurchaseResponseDTO> {
    return await this.bettingPurchaseSrv.fundBettingWallet(payload, user);
  }

  @ApiOperation({ description: 'Pay for cable plans' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: CablePurchaseResponseDTO })
  @SetRequestTimeout(1000000)
  @Post('/cable-purchase')
  async createCablePurchase(
    @Body() payload: CreateCableProviderDTO,
    @CurrentUser(DecodedTokenKey.USER) user: User,
  ): Promise<CablePurchaseResponseDTO> {
    return await this.cablePurchaseSrv.createCablePurchase(payload, user);
  }

  @ApiParam({ enum: CableProvider, name: 'provider' })
  @ApiOperation({
    description: 'View plans for cable providers',
    deprecated: true,
  })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: FlutterwaveCableBillingOptionResponseDTO })
  @Get('/cable-purchase/provider-options/:provider')
  async findCableProviderOptions(
    @Param('provider') provider: CableProvider,
  ): Promise<FlutterwaveCableBillingOptionResponseDTO> {
    return await this.billSrv.findCableProviderOptions(provider);
  }

  @ApiOperation({ description: 'Buy electricity unit tokens' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: ElectricityPurchaseResponseDTO })
  @SetRequestTimeout(1000000)
  @Post('/electricity-unit-purchase')
  async createElectricityPurchase(
    @Body() payload: CreateElectricityPurchaseDTO,
    @CurrentUser(DecodedTokenKey.USER) user: User,
  ): Promise<ElectricityPurchaseResponseDTO> {
    return await this.electricityPurchaseSrv.createElectricityPurchase(
      payload,
      user,
    );
  }

  @ApiOperation({
    description: 'Verify meter-number and details before purchase',
  })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: ElectricityPurchaseVerificationDTO })
  @Post('/electricity-unit-purchase/verify')
  async verifyElectricityPurchase(
    @Body() payload: VerifyElectricityPurchaseDTO,
    @CurrentUser(DecodedTokenKey.USER) user: User,
  ): Promise<ElectricityPurchaseVerificationDTO> {
    return await this.electricityPurchaseSrv.verifyElectricityPurchase(
      payload,
      user,
    );
  }

  @ApiOperation({ description: 'Buy airtime' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: AirtimePurchaseResponseDTO })
  @SetRequestTimeout(1000000)
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
  @SetRequestTimeout(1000000)
  @Post('/data-purchase')
  async createDataPurchase(
    @Body() payload: CreateDataPurchaseDTO,
    @CurrentUser(DecodedTokenKey.USER) user: User,
  ): Promise<DataPurchaseResponseDTO> {
    return await this.dataPurchaseSrv.createDataPurchase(payload, user);
  }

  @ApiOperation({ description: 'Find data plans for a specific provider' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: PagaDataPlanDTO })
  @Get('/data-purchase/find-plans/:providerId')
  async findDataPlansForProvider(
    @Param('providerId', ParseUUIDPipe) providerId: string,
  ): Promise<PagaDataPlanDTO> {
    return await this.billSrv.findDataPlansForProvider(providerId);
  }

  @ApiOperation({
    summary:
      'Find plans for a specific merchant. I.E plans for cable-TV provider',
    description:
      'Find plans for a specific merchant. I.E plans for cable-TV provider',
  })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: PagaMerchantPlanResponseDTO })
  @Get('/merchants/find-plans/:merchantPublicId')
  async findMerchantPlans(
    @Param('merchantPublicId', ParseUUIDPipe) merchantPublicId: string,
  ): Promise<PagaMerchantPlanResponseDTO> {
    return await this.billSrv.findMerchantPlans(merchantPublicId);
  }

  @ApiOperation({
    summary: 'Find plans for a electricity merchants',
    description: 'Find plans for a electricity merchants',
  })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: PagaMerchantPlanResponseDTO })
  @Get('/merchants/electricity/find-plans/:merchantPublicId')
  async findPlansForElectricityProvider(
    @Param('merchantPublicId', ParseUUIDPipe) merchantPublicId: string,
  ): Promise<PagaMerchantPlanResponseDTO> {
    return await this.billSrv.findPlansForElectricityProvider(merchantPublicId);
  }

  @ApiOperation({
    summary:
      'Find plans for a specific merchant. I.E plans for betting provider',
    description:
      'Find plans for a specific merchant. I.E plans for betting provider',
  })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: PagaMerchantPlanResponseDTO })
  @Get('/merchants/betting/find-plans/:merchantPublicId')
  async findBettingMerchantPlans(
    @Param('merchantPublicId', ParseUUIDPipe) merchantPublicId: string,
  ): Promise<PagaMerchantPlanResponseDTO> {
    return await this.billSrv.findBettingMerchantPlans(merchantPublicId);
  }

  @ApiOperation({ description: 'Find cable providers' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: BillProviderDTO })
  @Get('/cable-providers')
  async findCableProviders(): Promise<BillProviderDTO> {
    return await this.billSrv.findCableProviders();
  }

  @ApiOperation({ description: 'Find bet providers' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: BillProviderDTO })
  @Get('/betting-providers')
  async findBettingProviders(): Promise<BillProviderDTO> {
    return await this.billSrv.findBettingProviders();
  }

  @ApiQuery({ name: 'searchTerm', required: false })
  @ApiOperation({ description: 'Find airtime providers' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: BillProviderDTO })
  @Get('/airtime-providers')
  async findAirtimeProviders(
    @Query('searchTerm') searchTerm?: string,
  ): Promise<BillProviderDTO> {
    return await this.billSrv.findAirtimeProviders(searchTerm);
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
  // @ApiOperation({ description: 'Find internet providers' })
  // @ApiProduces('json')
  // @ApiConsumes('application/json')
  // @ApiResponse({ type: BillProviderDTO })
  // @Get('/internet-providers')
  // async findInternetProviders(): Promise<BillProviderDTO> {
  //   return await this.billSrv.findElectricityProviders();
  // }

  // @Get('admin/admin/aggregate-total-sum-per-day')
  // async gettoatlsumedupbillingperday(): Promise<any> {
  //   const services = [
  //     this.electricityPurchaseSrv,
  //     this.dataPurchaseSrv,
  //     this.airtimePurchaseSrv,
  //     this.cablePurchaseSrv,
  //     this.bettingPurchaseSrv,
  //   ];
  //   return await this.billSrv.aggregateBillingPerDay(services);
  // }
}
