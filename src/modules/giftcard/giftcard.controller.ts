import { Body, Controller, Get, HttpException, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CreateGiftCardProviderDTO, GiftCardDto } from './dto/giftcard-purchase.dto';
import { RolesGuard, SetRequestTimeout } from '@schematics/index';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiParam, ApiProduces, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GiftcardService } from './giftcard.service';

// @ApiBearerAuth('JWT')
// @UseGuards(RolesGuard)
@ApiTags('giftcards')
@Controller('giftcard')
export class GiftcardController {


    constructor(private readonly giftCardService: GiftcardService) {}

    @Get('/access-token')
    @ApiOperation({ summary: 'Get Reloadly Access Token' })
    @ApiResponse({ status: 500, description: 'Internal Server Error' })
    async getAccessToken() {
      try {
        const result = await this.giftCardService.getAccessToken();
        return result
      } catch (error) {
        if (error instanceof HttpException) {
          throw error;
        }
        throw new HttpException('Error retrieving access token', HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }
    @Get('balance')
    @ApiOperation({
      summary: 'Get gift card balance',
      description: 'Fetches the balance of a gift card from Reloadly.',
    })
    async getGiftCardBalance(): Promise<number> {
      return this.giftCardService.getGiftCardBalance();
    }
  
    @Get('countries')
    @ApiResponse({
      status: 200,
      description: 'List of countries fetched successfully.',
    })
    @ApiResponse({
      status: 500,
      description: 'Failed to fetch countries from Reloadly.',
    })
    async getCountries(): Promise<any> {
      try {
        return await this.giftCardService.getCountries();
      } catch (error) {
        throw error;
      }
    }
  
    // @Get('products')
    // @ApiResponse({ status: 200, description: 'Successfully retrieved products.' })
    // @ApiResponse({ status: 401, description: 'Unauthorized.' })
    // @ApiResponse({ status: 500, description: 'Internal server error.' })
    // async getProducts(): Promise<any> {
    //   return await this.giftCardService.getProducts();
    // }
  
    @Get('display-all-giftcard/all-gift-card/:countryCode')
    @ApiOperation({ summary: 'Get products by country code' })
    @ApiParam({
      name: 'countryCode',
      description: 'Country code to filter products',
      example: 'NG',
    })
    // @ApiBearerAuth()
    @ApiResponse({ status: 200, description: 'Successfully retrieved products' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    async getCountryProducts(
      @Param('countryCode') countryCode: string,
    ): Promise<any> {
      return this.giftCardService.getCountryProducts(countryCode);
    }
  

  
    @Get('categories/fetch-all-categories')
    @ApiOperation({ summary: 'Get products by country code' })
    // @ApiBearerAuth()
    @ApiResponse({
      status: 200,
      description: 'Successfully retrieved products categories',
    })
    @ApiResponse({ status: 400, description: 'Bad request' })
    async getallproductcategories(): Promise<any> {
      return this.giftCardService.getAllProductCategories();
    }
  
    @Get('/filter/filter-giftcard-by-category')
    @ApiOperation({ summary: 'Filter giftcards by category' })
    @ApiResponse({ status: 200, description: 'Giftcards filtered successfully' })
    @ApiResponse({ status: 400, description: 'Invalid category name' })
    @ApiQuery({
      name: 'countryCode',
      description: 'Country code to filter products',
      example: 'NG',
    })
    async filterGiftcardsByCategory(
      @Query('category') category: string,
      @Query('countryCode') countryCode: string,
    ) {
      try {
        const result = await this.giftCardService.filterGiftcardsByCategory(
          category,
          countryCode,
        );
        return result
      } catch (error) {
        throw new HttpException(
          {
            success: false,
            code: HttpStatus.BAD_REQUEST,
            message: error.message || 'Internal server error',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  
    @Get('search')
    @ApiQuery({
      name: 'countryCode',
      description: 'Country code to filter products',
      example: 'NG',
    })
    @ApiQuery({
      name: 'wildcardName',
      description: 'search products by wildcard name',
    })
    async searchProductsByName(
      @Query('wildcardName') wildcardName: string,
      @Query('countryCode') countryCode: string,
    ): Promise<{ success: boolean; data: GiftCardDto[] }> {
      const result = await this.giftCardService.searchProductsByName(
        wildcardName,
        countryCode,
      );
      return {
        success: true,
        data: result,
      };
    }
  
    @Get('products/:productId')
    @ApiOperation({ summary: 'Get Product by ID' })
    @ApiParam({
      name: 'productId',
      description: 'Product ID',
      example: '123456789',
    })
    // @ApiBearerAuth()
    async getProductById(@Param('productId') productId: string): Promise<any> {
      return this.giftCardService.getProductById(productId);
    }
  
  
    @Get('fx-rate')
    @ApiOperation({ summary: 'Get Foreign Exchange Rate' })
    @ApiQuery({
      name: 'currencyCode',
      description: 'Currency code (e.g., USD, EUR)',
    })
    @ApiQuery({ name: 'amount', description: 'Amount in currency' })
    async getFxRate(
      @Query('currencyCode') currencyCode: string,
      @Query('amount') amount: number,
    ): Promise<any> {
      return this.giftCardService.getFxRate(currencyCode, amount);
    }
  
    @ApiOperation({ description: 'Pay for GiftCard' })
    @ApiProduces('json')
    @ApiConsumes('application/json')
    // @ApiResponse({ type: InternetPurchaseResponseDTO })
    @SetRequestTimeout(1000000)
    @Post('/GiftCard-purchase')
    async createInternetPurchase(
      @Body() payload: CreateGiftCardProviderDTO,
    ): Promise<any> {
      return await this.giftCardService.createGiftCardPurchase(payload);
    }
  
    // @ApiOperation({ description: 'Pay for GiftCard' })
    // @ApiProduces('json')
    // @ApiConsumes('application/json')
    // // @ApiResponse({ type: InternetPurchaseResponseDTO })
    // @SetRequestTimeout(1000000)
    // @Post('testing/GiftCard-purchase')
    // async TcreateInternetPurchase(
    //   @Body() payload: CreateGiftCardProviderDTO,
    // ): Promise<any> {
    //   return await this.giftCardService.TestcreateGiftCardPurchase(payload);
    // }
}
