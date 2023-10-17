import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { User } from '@entities/index';
import { CurrentUser, RolesGuard } from '@schematics/index';
import { DecodedTokenKey } from '@utils/index';
import { AirtimePurchaseService } from '@modules/airtime-purchase/airtime-purchase.service';
import {
  AirtimePurchaseResponseDTO,
  CreateAirtimePurchaseDTO,
} from '@modules/airtime-purchase/dto/airtime-purchase.dto';
import { BillService } from './bill.service';
import { BillProviderDTO } from './dto/bill.dto';

@ApiBearerAuth('JWT')
@UseGuards(RolesGuard)
@ApiTags('bill')
@Controller('bill')
export class BillController {
  constructor(
    private readonly billSrv: BillService,
    private readonly airtimePurchaseSrv: AirtimePurchaseService,
  ) {}

  @ApiOperation({ description: 'Sign up with email and password' })
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
