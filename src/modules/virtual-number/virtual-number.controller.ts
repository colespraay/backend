import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
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
import { RolesGuard, SetRequestTimeout } from '@schematics/index';

import { BuyVirtualNumberDto, CancelOrderDto, GetPriceDto, ListOrdersDto } from './dto/virtual-number.dto';
import { VirtualNumberService } from './virtual-number.service';

// @ApiBearerAuth('JWT')
// @UseGuards(RolesGuard)
@ApiTags('virtual-numbers')
@Controller('virtual-number')
export class VirtualNumberController {
  constructor(private readonly virtualNumberSrv: VirtualNumberService) {}

  // ---------------------------------------------------------------------
  // Provider / ops
  // ---------------------------------------------------------------------

  @Get('provider-balance')
  @ApiOperation({ summary: 'Get GrizzlySMS provider account balance' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async getProviderBalance() {
    try {
      return await this.virtualNumberSrv.getProviderBalance();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Error retrieving provider balance', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ---------------------------------------------------------------------
  // "Buy Virtual Number" screen — service/country pickers + amount preview
  // ---------------------------------------------------------------------

  @Get('services')
  @ApiOperation({ summary: 'List all available services (Select service modal)' })
  @ApiResponse({ status: 200, description: 'List of services fetched successfully.' })
  async getServices() {
    return this.virtualNumberSrv.getServices();
  }

  @Get('services/search')
  @ApiOperation({ summary: 'Search services by name (Select service modal search bar)' })
  @ApiQuery({ name: 'q', description: 'Search term', required: true })
  async searchServices(@Query('q') q: string) {
    return this.virtualNumberSrv.searchServices(q);
  }

  @Get('countries')
  @ApiOperation({ summary: 'List all available countries (Select Country modal)' })
  @ApiResponse({ status: 200, description: 'List of countries fetched successfully.' })
  async getCountries() {
    return this.virtualNumberSrv.getCountries();
  }

  @Get('countries/search')
  @ApiOperation({ summary: 'Search countries by name (Select Country modal search bar)' })
  @ApiQuery({ name: 'q', description: 'Search term', required: true })
  async searchCountries(@Query('q') q: string) {
    return this.virtualNumberSrv.searchCountries(q);
  }

  @Get('price')
  @ApiOperation({ summary: 'Get the final NGN price (provider cost + $1 markup) for the Amount field' })
  @ApiQuery({ name: 'service', description: 'Service code', example: 'wa' })
  @ApiQuery({ name: 'country', description: 'Country code', required: false, example: '74' })
  async getPrice(@Query() query: GetPriceDto) {
    try {
      return await this.virtualNumberSrv.getPrice(query.service, query.country);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { success: false, code: HttpStatus.BAD_REQUEST, message: error.message || 'Failed to fetch price' },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @ApiOperation({ summary: 'Buy a virtual number' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @SetRequestTimeout(1000000)
  @Post('buy')
  async buyNumber(@Body() payload: BuyVirtualNumberDto) {
    return this.virtualNumberSrv.purchaseNumber(payload);
  }

  // ---------------------------------------------------------------------
  // "Virtual Numbers" home screen — wallet balance, stat cards, recent orders
  // ---------------------------------------------------------------------

  @Get('dashboard/:userid')
  @ApiOperation({ summary: 'Get wallet balance, verification counts and recent orders for the home screen' })
  @ApiParam({ name: 'userid', description: 'User ID' })
  @ApiQuery({ name: 'recentLimit', required: false, description: 'How many recent orders to include, default 5' })
  async getDashboard(@Param('userid') userid: string, @Query('recentLimit') recentLimit?: number) {
    return this.virtualNumberSrv.getDashboard(userid, recentLimit ? Number(recentLimit) : undefined);
  }

  // ---------------------------------------------------------------------
  // "Recent Orders" / "Verification history" screens
  // ---------------------------------------------------------------------

  @Get('orders/:userid')
  @ApiOperation({ summary: 'List a user\'s virtual number orders (paginated, filterable by status)' })
  @ApiParam({ name: 'userid', description: 'User ID' })
  async listOrders(@Param('userid') userid: string, @Query() query: ListOrdersDto) {
    return this.virtualNumberSrv.listOrders(userid, query);
  }

  @Get('order/:id/:userid')
  @ApiOperation({ summary: 'Get a single order, refreshing its status from the provider first' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiParam({ name: 'userid', description: 'User ID' })
  async getOrderDetail(@Param('id') id: string, @Param('userid') userid: string) {
    return this.virtualNumberSrv.getOrderDetail(id, userid);
  }

  // ---------------------------------------------------------------------
  // Cancel / resend
  // ---------------------------------------------------------------------

  @Post('order/:id/cancel')
  @ApiOperation({ summary: 'Cancel a pending/waiting order and refund the wallet' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  async cancelOrder(@Param('id') id: string, @Body() body: CancelOrderDto) {
    try {
      return await this.virtualNumberSrv.cancelOrder(id, body.userid);
    } catch (error: any) {
      throw new HttpException(
        { success: false, code: HttpStatus.BAD_REQUEST, message: error.message || 'Unable to cancel order' },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('order/:id/resend')
  @ApiOperation({ summary: 'Request another code on the same number (provider status=3)' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  async resendCode(@Param('id') id: string, @Body() body: CancelOrderDto) {
    try {
      return await this.virtualNumberSrv.resendCode(id, body.userid);
    } catch (error: any) {
      throw new HttpException(
        { success: false, code: HttpStatus.BAD_REQUEST, message: error.message || 'Unable to resend code' },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}