import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    HttpException,
    HttpStatus,
    Query,
} from '@nestjs/common';
import { CryptoService } from './crypto.service';
import {
    AddCoinToWatchlistDto,
    BuyCryptoDto,
    ConfirmSwapDto,
    CreateCryptoDto,
    FetchKlineDataResponseDto,
    FetchKlineDto,
    GetMarketTickerDto,
    GetMarketTickerResponseDto,
    GetUserWalletDto,
    QuidaxQueryDto,
    RemoveFromWatchlistDto,
    SellCryptoDto,
    SendCryptoDto,
    SwapQuotationDto,
    WithdrawDto,
} from './dto/crypto.dto';
import {
    ApiBody,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { BaseResponseTypeDTO } from 'src/utils';


@Controller('crypto')
@ApiTags('Crypto')
export class CryptoController {
    constructor(
        private readonly cryptoService: CryptoService,

    ) { }

    @Get('quidax/base-coins')
    @ApiOperation({ summary: 'List base coin symbols from market summary' })
    @ApiResponse({
        status: 200,
        description: 'List of base coins',
        type: [String],
    })
    @ApiResponse({ status: 500, description: 'Server error' })
    async getBaseCoins(): Promise<string[]> {
        return this.cryptoService.listBaseCoins();
    }


    @Get('quidax/detailed/market-summary/:userId')
    @ApiOperation({ summary: 'Get market summary with watchlist flag' })
    async getMarketSummaryWithWatchFlag(@Param('userId') userId: string) {
        return this.cryptoService.getMarketSummary(userId);
    }




    @ApiOperation({ summary: 'Fetch all wallets associated with a user' })
    @ApiResponse({ status: 200, description: 'Wallets fetched successfully.' })
    @ApiResponse({ status: 404, description: 'User not found.' })
    @Get(':userId/wallets')
    async fetchUserWallets(@Param('userId') userId: string): Promise<any> {
        try {
            return await this.cryptoService.fetchUserWallets(userId);
        } catch (error) {
            throw new HttpException(
                error.message,
                error.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @ApiOperation({
        summary: 'Fetch all wallet addresses for a specified currency',
    })
    @ApiResponse({
        status: 200,
        description: 'Wallet addresses fetched successfully.',
    })
    @ApiResponse({ status: 404, description: 'User or currency not found.' })
    @Get(':userId/:currency/addresses')
    async fetchPaymentAddresses(
        @Param('userId') userId: string,
        @Param('currency') currency: string,
    ): Promise<any> {
        try {
            return await this.cryptoService.fetchPaymentAddresses(userId, currency);
        } catch (error) {
            throw new HttpException(
                error.message,
                error.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @ApiOperation({
        summary: 'Fetch specific wallet details by user ID and currency',
    })
    @ApiResponse({ status: 200, description: 'Wallet fetched successfully.' })
    @ApiResponse({ status: 404, description: 'Wallet or user not found.' })
    @Get('user-wallet')
    async getUserWallet(
        @Query() getUserWalletDto: GetUserWalletDto,
    ): Promise<any> {
        try {
            return await this.cryptoService.getUserWallet(getUserWalletDto);
        } catch (error) {
            throw new HttpException(
                error.message,
                error.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    // @Get('get-all-markets/prices/markets')
    // @ApiOperation({ summary: 'Fetch available Quidax markets' })
    // @ApiResponse({
    //   status: 200,
    //   description: 'Returns a list of available cryptocurrency markets on Quidax',
    // })
    // async getMarkets() {
    //   return this.cryptoService.getMarkets();
    // }

    @Get('all/prices/get-all-markets/prices/markets')
    @ApiOperation({
        summary:
            'Fetch the latest prices and percentage change of cryptocurrencies',
    })
    @ApiResponse({
        status: 200,
        description: 'Returns latest crypto market prices',
        schema: {
            example: [
                {
                    id: 'bitcoin',
                    name: 'Bitcoin',
                    symbol: 'BTC',
                    currentPrice: 59000,
                    marketCap: 1150000000000,
                    volume: 32000000000,
                    percentageChange24h: 2.5,
                    highestPrice24h: 60000,
                    lowestPrice24h: 58000,
                    image:
                        'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
                },
            ],
        },
    })
    async getCryptoMarketPrices() {
        return this.cryptoService.getCryptoMarketPrices();
    }
    @Get('top-movers/prices/get-all-markets/prices/markets')
    @ApiOperation({
        summary: 'Fetch the top movers based on 24-hour percentage change',
    })
    @ApiResponse({
        status: 200,
        description:
            'Returns top gaining and losing cryptos based on price change percentage',
    })
    async getTopMovers() {
        return this.cryptoService.getTopMovers();
    }

    @Get('details/:symbol')
    @ApiOperation({ summary: 'Fetch full details of a cryptocurrency by symbol' })
    @ApiParam({
        name: 'symbol',
        description: 'Symbol of the cryptocurrency (e.g., BTC, ETH, DOGE)',
    })
    @ApiResponse({
        status: 200,
        description: 'Returns full details of the requested cryptocurrency',
    })
    async getCryptoDetails(@Param('symbol') symbol: string) {
        return this.cryptoService.getCryptoDetailsBySymbol(symbol);
    }

    @Get('crypto-graphs/markets/:market')
    @ApiResponse({ type: () => FetchKlineDataResponseDto })
    async getKlineData(
        @Param('market') market: string,
        @Query() fetchKlineDto: FetchKlineDto,
    ): Promise<FetchKlineDataResponseDto> {
        return await this.cryptoService.fetchKlineData(fetchKlineDto, market);
    }

    @Get('tickers/:currency')
    async getMarketTicker(
        @Param() getMarketTickerDto: GetMarketTickerDto,
    ): Promise<GetMarketTickerResponseDto> {
        return await this.cryptoService.getMarketTicker(getMarketTickerDto);
    }


    @Post('buy/sell-crypto/user-sell-crypto')
    @ApiOperation({ summary: 'Sell cryptocurrency' })
    @ApiBody({
        description: 'Payload to sell cryptocurrency',
        type: SellCryptoDto,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Sell initiated successfully',
        type: BaseResponseTypeDTO,
    })
    async sellCrypto(
        @Body() sellCryptoDto: SellCryptoDto,
    ): Promise<BaseResponseTypeDTO> {
        try {
            return this.cryptoService.UserSellCrypto(sellCryptoDto);
        } catch (error) {
            throw new HttpException(
                error.response?.data?.message || error.message,
                error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Post('buy/user-buy-crypto')
    // @ApiBearerAuth('JWT')
    // // @Roles(AppRole.ADMIN)
    // @UseGuards(RolesGuard)
    @ApiOperation({
        summary: 'Buy Cryptocurrency',
        description:
            'Allows a user to buy cryptocurrency. The transaction is processed by verifying the transaction pin and checking account balance before placing an order.',
    })
    @ApiBody({
        description: 'Details required to initiate a cryptocurrency purchase.',
        type: BuyCryptoDto,
    })
    @ApiResponse({
        status: 200,
        description: 'The cryptocurrency purchase was successfully processed.',
        type: BaseResponseTypeDTO,
    })
    async buyCrypto(
        @Body() buyCryptoDto: BuyCryptoDto,
    ): Promise<BaseResponseTypeDTO> {
        return this.cryptoService.UserBuyCrypto(buyCryptoDto);
    }

    @Post('send/withdraw')
    @ApiOperation({ summary: 'Send cryptocurrency from user wallet via Quidax' })
    @ApiResponse({ status: 200, description: 'Withdrawal successful' })
    @ApiResponse({ status: 400, description: 'Error performing withdrawal' })
    @ApiBody({ type: SendCryptoDto })
    async sendCrypto(@Body() withdrawDto: SendCryptoDto) {
        return this.cryptoService.UserSendCrypto(withdrawDto);
    }

    @Post('swap/swap-quotation')
    @ApiOperation({ summary: 'Get crypto swap quotation from Quidax' })
    @ApiResponse({
        status: 200,
        description: 'Swap quotation returned successfully',
    })
    @ApiResponse({ status: 400, description: 'Bad request or invalid data' })
    async getSwapQuotation(@Body() dto: SwapQuotationDto) {
        return this.cryptoService.getSwapQuotation(dto);
    }

    @Post('swap-quotation/confirm')
    @ApiOperation({ summary: 'Confirm a previously quoted swap on Quidax' })
    @ApiResponse({ status: 200, description: 'Swap confirmed successfully' })
    @ApiResponse({ status: 400, description: 'Invalid swap ID or request' })
    async confirmSwap(@Body() dto: ConfirmSwapDto) {
        return this.cryptoService.confirmSwapQuotation(
            dto.quidax_userId,
            dto.swapId,
        );
    }

    @Get('user/transactions')
    @ApiOperation({
        summary:
            'Fetch user withdrawals, deposits, and swap transactions from Quidax',
    })
    @ApiQuery({
        name: 'userId',
        required: true,
        description: 'User ID from your system',
    })
    @ApiQuery({
        name: 'currency',
        required: true,
        description: 'Currency code (e.g., btc, usdt)',
    })
    async getAllUserTransactions(
        @Query('userId') userId: string,
        @Query('currency') currency: string,
    ) {
        return this.cryptoService.getAllUserTransactions(userId, currency);
    }

    @Get('user/:userId/data')
    @ApiOperation({
        summary: 'Fetch user Quidax data (withdraws, deposits, swaps)',
    })
    @ApiParam({
        name: 'userId',
        required: true,
        description: 'User ID in your system',
    })
    @ApiQuery({
        name: 'type',
        enum: ['withdraws', 'deposits', 'swap_transactions'],
        required: true,
    })
    @ApiQuery({ name: 'currency', required: false, example: 'btc' })
    @ApiQuery({
        name: 'state',
        required: false,
        enum: ['submitted', 'processing', 'done', 'rejected'],
    })
    @ApiQuery({
        name: 'orderBy',
        required: false,
        enum: ['asc', 'desc'],
        example: 'asc',
    })
    async getUserQuidaxData(
        @Param('userId') userId: string,
        @Query() query: QuidaxQueryDto,
    ) {
        return this.cryptoService.getUserQuidaxData(
            userId,
            query.type,
            query.currency,
            query.state,
            query.orderBy || 'asc',
        );
    }



    @Get("/transaction-fees/get-all-transaction-fees")
    @ApiOperation({ summary: 'Get all transaction fees' })
    @ApiResponse({
        status: 200,
        description: 'Successfully fetched transaction fees',
        schema: {
            example: {
                success: true,
                message: 'Transaction fees fetched successfully.',
                status: 200,
                code: 200,
                data: {
                    depositFee: '$2',
                    cashWithdrawalFee: '₦100',
                    cryptoWithdrawalFee: '$2',
                },
            },
        },
    })
    getTransactionFees() {
        return {
            success: true,
            message: 'Transaction fees fetched successfully.',
            status: HttpStatus.OK,
            code: HttpStatus.OK,
            data: {
                depositFee: '$2',
                cashWithdrawalFee: '₦100',
                cryptoWithdrawalFee: '$2',
            },
        };
    }


    @Post('/quidaxwebhook')
    async quidaxwebhook(@Body() payload: any) {
        return await this.cryptoService.quidaxWebhook(payload);
    }
}
