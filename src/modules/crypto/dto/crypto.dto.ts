import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsEmail,
    IsEnum,
    IsIn,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
} from 'class-validator';
import { BaseResponseTypeDTO } from 'src/utils';

export class CreateSubAccountDto {
    @ApiProperty({
        description: 'The email of your sub user',
        example: 'test@gmail.com',
    })
    @IsEmail()
    email: string;

    @ApiProperty({
        description: 'The first name of your sub user',
        example: 'test',
    })
    @IsString()
    first_name: string;

    @ApiProperty({
        description: 'The last name of your sub user',
        example: 'user',
    })
    @IsString()
    last_name: string;
}
export class GetUserWalletDto {
    @ApiProperty()
    @IsString()
    user_id: string;

    @ApiProperty()
    @IsString()
    currency: string;
}
export class CreateCryptoDto { }
export class FetchKlineDto {
    @ApiProperty({
        example: '2024-01-01T00:00:00Z',
        description: 'The date from which to start fetching K-line data.',
    })
    @IsString()
    @IsNotEmpty()
    date: string;

    @ApiProperty({
        example: 15,
        description:
            'Time period of K line. You can choose between 1, 5, 15, 30, 60, 120, 240, 360, 720, 1440, 4320, 10080. Default to 1.',
    })
    @IsOptional()
    period?: number;

    @ApiProperty({
        example: 30,
        description: 'Limit the number of returned data points.',
    })
    @IsOptional()
    limit?: number;
}

class KlineEntryDto {
    @ApiProperty({
        example: '2024-08-24T13:57:25.000Z',
        description: 'ISO formatted date of the entry',
    })
    date: string;

    @ApiProperty({ example: 1692895045, description: 'Timestamp in seconds' })
    timestamp: number;

    @ApiProperty({ example: 29000.45, description: 'Opening price' })
    open: number;

    @ApiProperty({
        example: 29100.55,
        description: 'Highest price during the period',
    })
    high: number;

    @ApiProperty({
        example: 28900.25,
        description: 'Lowest price during the period',
    })
    low: number;

    @ApiProperty({ example: 29050.75, description: 'Closing price' })
    close: number;

    @ApiProperty({
        example: 120.4567,
        description: 'Volume of assets traded during the period',
    })
    volume: number;
}

export class FetchKlineDataResponseDto {
    @ApiProperty({ example: 'success', description: 'Status of the request' })
    status: string;

    @ApiProperty({
        example: 'K-line data fetched successfully',
        description: 'Response message',
    })
    message: string;

    @ApiProperty({
        type: [KlineEntryDto],
        description: 'Array of K-line data entries',
    })
    data: KlineEntryDto[];
}
export class GetMarketTickerDto {
    @ApiProperty({
        description:
            'Allowed Currencies values: qdxusdt, btcusdt, btcngn, ethngn, qdxngn, xrpngn, dashngn, ltcngn, usdtngn, btcghs, usdtghs, trxngn, dogeusdt, bnbusdt, maticusdt, safemoonusdt, aaveusdt, shibusdt,  dotusdt, linkusdt, cakeusdt, xlmusdt, xrpusdt, ltcusdt, ethusdt, trxusdt, axsusdt, wsgusdt, afenusdt, blsusdt, dashusdt.',
        example: 'usdtngn',
    })
    @IsString()
    currency: string;
}
class TickerDto {
    @ApiProperty({
        description: 'The current buy price of the asset.',
        example: '1600.19',
    })
    buy: string;

    @ApiProperty({
        description: 'The current sell price of the asset.',
        example: '1606.42',
    })
    sell: string;

    @ApiProperty({
        description: 'The lowest price of the asset in the given period.',
        example: '1595.2',
    })
    low: string;

    @ApiProperty({
        description: 'The highest price of the asset in the given period.',
        example: '1607.99',
    })
    high: string;

    @ApiProperty({
        description: 'The opening price of the asset at the start of the period.',
        example: '1601.23',
    })
    open: string;

    @ApiProperty({
        description: 'The last traded price of the asset.',
        example: '1600.19',
    })
    last: string;

    @ApiProperty({
        description: 'The total volume of the asset traded in the given period.',
        example: '76841.3972441196500992',
    })
    vol: string;
}

class MarketTickerDataDto {
    @ApiProperty({
        description: 'Unix timestamp of the data.',
        example: 1724673233,
    })
    at: number;

    @ApiProperty({
        description: 'Ticker information for the market.',
        type: TickerDto,
    })
    ticker: TickerDto;

    @ApiProperty({
        description: 'The market pair associated with the ticker.',
        example: 'usdtngn',
    })
    market: string;
}

export class GetMarketTickerResponseDto {
    @ApiProperty({
        description: 'The status of the API call.',
        example: 'success',
    })
    status: string;

    @ApiProperty({
        description:
            'A message providing additional information about the response.',
        example: 'Successful',
    })
    message: string;

    @ApiProperty({
        description:
            'The data returned by the API, containing market ticker information.',
        type: MarketTickerDataDto,
    })
    data: MarketTickerDataDto;
}

export class SendCryptoDto {
    @ApiProperty({
        description:
            'The User ID. Use "me" for the main authenticated user, or provide a specific user ID for sub-account.',
        example: '25e2ea8e-afff-48f9-9767-7a01fe5402d1',
    })
    @IsString()
    userId: string;

    @ApiProperty({
        description:
            'wallet address, or user id where you are planning to send the crypto.',
        example: '25e2ea8e-afff-48f9-9767-7a01fe5402d1',
    })
    @IsString()
    fund_uid: string;

    @ApiProperty({
        description: 'The cryptocurrency to withdraw.',
        example: 'btc',
    })
    @IsString()
    @IsNotEmpty()
    currency: string;

    @ApiProperty({
        description: 'The amount of cryptocurrency to withdraw.',
        example: '0.0000004',
    })
    @IsString()
    @IsNotEmpty()
    amount: string;

    // @ApiProperty({
    //   description: 'The blockchain network to use for the withdrawal.',
    //   example: 'trc20',
    // })
    // @IsString()
    // @IsOptional()
    // network?: string;
}

export class WithdrawDto {
    @ApiProperty({
        description:
            'The User ID. Use "me" for the main authenticated user, or provide a specific user ID for sub-account.',
        example: 'holdup',
    })
    @IsString()
    userId: string;

    @ApiProperty({
        description:
            'wallet address, or user id where you are planning to send the crypto.',
        example: 'holdup',
    })
    @IsString()
    fund_uid: string;

    @ApiProperty({
        description: 'The cryptocurrency to withdraw.',
        example: 'btc',
    })
    @IsString()
    @IsNotEmpty()
    currency: string;

    @ApiProperty({
        description: 'The amount of cryptocurrency to withdraw.',
        example: '0.0000004',
    })
    @IsString()
    @IsNotEmpty()
    amount: string;

    @ApiProperty({
        description: 'Transaction note for the withdrawal.',
        example: 'Stay safe',
    })
    @IsString()
    @IsNotEmpty()
    transaction_note: string;

    @ApiProperty({
        description: 'Narration for the withdrawal.',
        example: 'We love you.',
    })
    @IsString()
    @IsNotEmpty()
    narration: string;

    @ApiProperty({
        description: 'The blockchain network to use for the withdrawal.',
        example: 'trc20',
    })
    @IsString()
    @IsOptional()
    network?: string;

    @ApiProperty({
        description: 'A unique reference for the transaction.',
        example: 'unique_reference',
    })
    @IsString()
    @IsOptional()
    reference?: string;
}

export class SwapQuotationDto {
    @ApiProperty({
        description:
            'The User ID. Use "me" for the main authenticated user, or provide a specific user ID for sub-account.',
        example: '25e2ea8e-afff-48f9-9767-7a01fe5402d1',
    })
    @IsString()
    quidax_userId: string;

    @ApiProperty({ example: 'btc', description: 'Currency to swap from' })
    @IsString()
    @IsNotEmpty()
    from_currency: string;

    @ApiProperty({ example: 'usdt', description: 'Currency to swap to' })
    @IsString()
    @IsNotEmpty()
    to_currency: string;

    @ApiProperty({
        example: '100',
        description: 'Amount of from_currency to swap',
    })
    @IsString()
    from_amount: string;

    @ApiProperty({
        example: '700',
        description: 'Expected amount of to_currency (optional by Quidax)',
    })
    @IsString()
    to_amount: string;
}

export class ConfirmSwapDto {
    @ApiProperty({
        description:
            'The User ID. Use "me" for the main authenticated user, or provide a specific user ID for sub-account.',
        example: '25e2ea8e-afff-48f9-9767-7a01fe5402d1',
    })
    @IsString()
    quidax_userId: string;


    @ApiProperty({
        example: 'f4t556htrht66h',
        description: 'The ID of the swap to confirm',
    })
    @IsString()
    @IsNotEmpty()
    swapId: string;
}

export class GetQuidaxFeeDto {
    @ApiProperty({ example: 'usdt', description: 'Currency to check network fee for' })
    @IsNotEmpty()
    @IsString()
    currency: string;

    @ApiPropertyOptional({ example: 'btc', description: 'Blockchain network (optional)' })
    @IsOptional()
    @IsString()
    network?: string;
}

export class GetNetworkFeeUsdDto {
    @ApiProperty({ example: 'ltc', description: 'Currency to check network fee' })
    @IsNotEmpty()
    @IsString()
    currency: string;

    @ApiPropertyOptional({ example: 'ltcusdt', description: 'Ticker pair for USD price (e.g., btcusdt, ltcusdt)' })
    @IsOptional()
    @IsString()
    ticker?: string;

    @ApiPropertyOptional({ example: 'buy', enum: ['buy', 'sell'], description: 'Choose price type' })
    @IsOptional()
    @IsIn(['buy', 'sell'])
    priceType?: 'buy' | 'sell';

    @ApiPropertyOptional({ example: 'btc', description: 'Blockchain network (optional)' })
    @IsOptional()
    @IsString()
    network?: string;
}

export class BuyCryptoDto {
    @ApiProperty({
        description: 'The amount of cryptocurrency to buy.',
        example: 100.0,
    })
    @IsNumber({}, { message: 'Amount must be a number' })
    @IsNotEmpty({ message: 'Amount is required' })
    amount: number;

    // @ApiProperty({
    //   description: 'The transaction PIN for authorizing the purchase.',
    //   example: '1234',
    // })
    // @IsString({ message: 'Transaction PIN must be a string' })
    // @IsNotEmpty({ message: 'Transaction PIN is required' })
    // transactionPin: string;

    @ApiProperty({
        description:
            'The currency code for the cryptocurrency (e.g., "BTC", "ETH").',
        example: 'BTC',
    })
    @IsString({ message: 'Currency must be a string' })
    @IsNotEmpty({ message: 'Currency is required' })
    currency: string;

    @ApiProperty({
        description: 'The ID of the user making the purchase.',
        example: 'user123',
    })
    @IsString({ message: 'User ID must be a string' })
    @IsNotEmpty({ message: 'User ID is required' })
    userId: string;

    @ApiProperty()
    frequency: string;
}

export class SellCryptoDto {

    @ApiProperty({
        description: 'The ID of the user making the sale.',
        example: 'user123',
    })
    @IsString({ message: 'User ID must be a string' })
    @IsNotEmpty({ message: 'User ID is required' })
    userId: string;

    @ApiProperty({
        description: 'The amount of cryptocurrency to sell.',
        example: 0.0,
    })
    @IsNumber({}, { message: 'Amount must be a number' })
    @IsNotEmpty({ message: 'Amount is required' })
    amount: number;

    @ApiProperty({
        description:
            'The currency code for the cryptocurrency (e.g., "usdt", "btc").',
        example: 'usdt',
    })
    @IsString({ message: 'Currency must be a string' })
    @IsNotEmpty({ message: 'Currency is required' })
    currency: string;

    // @ApiProperty({ type: String, description: 'Refund address', example: '8758thu85hnjfrgurtyh', })
    // refunAddress: string;
}

export class ConfirmInstantOrderDto {
    @ApiProperty({
        description:
            'The User ID. Use "me" for the main authenticated user, or provide a specific user ID for sub-account.',
        example: 'me',
    })
    @IsString()
    userId: string;

    @ApiProperty({
        description: 'The ID of the instant order to be confirmed.',
        example: 'instant_order_id',
    })
    @IsString()
    instantOrderId: string;
}
export class CreateInstantOrderDto {
    @ApiProperty({
        description:
            'The currency you are using to buy the cryptocurrency, e.g., NGN (Nigerian Naira).',
        example: 'ngn',
    })
    @IsString()
    @IsNotEmpty()
    bid: string;

    @ApiProperty({
        description: 'The cryptocurrency you want to buy, e.g., BTC (Bitcoin).',
        example: 'btc',
    })
    @IsString()
    @IsNotEmpty()
    ask: string;

    @ApiProperty({
        description: 'The type of order, whether it is a buy or sell order.',
        example: 'buy',
    })
    @IsString()
    @IsNotEmpty()
    type: string;

    @ApiPropertyOptional({
        description:
            'The total amount to spend in the bid currency (e.g., NGN). Required if the order is measured in bid currency.',
        example: '5000',
    })
    @IsString()
    @IsOptional()
    total?: string;

    @ApiPropertyOptional({
        description:
            'The unit of measurement for the order. This can be either the bid or ask currency.',
        example: 'ngn',
    })
    @IsString()
    @IsOptional()
    unit?: string;

    // @ApiPropertyOptional({
    //   description: 'The volume of cryptocurrency to buy. Required if the order is measured in ask currency.',
    //   example: '0.01',
    // })
    // @IsString()
    // @IsOptional()
    // volume?: string;
}
export class WalletDataDto {
    @ApiProperty({ description: 'The currency of the wallet', example: 'usdt' })
    wallet: string;

    @ApiProperty({
        description: 'The adjusted balance of the wallet',
        example: '2.80487800',
    })
    balance: string;

    @ApiProperty({
        description: 'The deposit address for the wallet',
        example: '0x27bF8DEdd311f9EB829f330858015dAAD67e44a4',
    })
    deposit_address: string;

    @ApiProperty({
        description: 'The default network for transactions',
        example: 'bep20',
    })
    default_network: string;
}

export class QuidaxQueryDto {
    @ApiPropertyOptional({ enum: ['withdraws', 'deposits', 'swap_transactions'], example: 'withdraws' })
    @IsEnum(['withdraws', 'deposits', 'swap_transactions'])
    type: 'withdraws' | 'deposits' | 'swap_transactions';

    @ApiPropertyOptional({ example: 'btc' })
    @IsOptional()
    @IsString()
    currency?: string;

    @ApiPropertyOptional({ enum: ['submitted', 'processing', 'done', 'rejected'], example: 'submitted' })
    @IsOptional()
    @IsString()
    state?: string;

    @ApiPropertyOptional({ enum: ['asc', 'desc'], example: 'asc' })
    @IsOptional()
    @IsString()
    orderBy?: 'asc' | 'desc';
}


export class AddCoinToWatchlistDto {
    @ApiProperty({ example: 'user12345', description: 'The user ID' })
    userId: string;

    @ApiProperty({ example: 'BTC_USDT', description: 'Coin pair (e.g. BTC_USDT)' })
    coinPair: string;

    @ApiProperty({
        example: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
        description: 'Logo URL of the coin',
        required: false,
    })
    logo?: string;

    @ApiProperty({ example: 'Bitcoin', description: 'Name of the coin', required: false })
    name?: string;
}
export class RemoveFromWatchlistDto {
    @ApiProperty({ example: 'userId123', description: 'The ID of the user' })
    @IsString()
    userId: string;

    @ApiProperty({ example: 'BTC_USDT', description: 'The coin pair to remove' })
    @IsString()
    coinPair: string;
}
export class MainWalletResponseDto extends BaseResponseTypeDTO {
    @ApiProperty({ type: () => WalletDataDto })
    data: WalletDataDto;
}
