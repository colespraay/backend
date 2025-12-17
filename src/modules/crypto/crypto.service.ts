import {
    ConflictException,
    HttpException,
    HttpStatus,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import {
    AddCoinToWatchlistDto,
    BuyCryptoDto,
    ConfirmInstantOrderDto,
    ConfirmSwapDto,
    CreateCryptoDto,
    CreateInstantOrderDto,
    CreateSubAccountDto,
    FetchKlineDataResponseDto,
    FetchKlineDto,
    GetMarketTickerDto,
    GetMarketTickerResponseDto,
    GetNetworkFeeUsdDto,
    GetQuidaxFeeDto,
    GetUserWalletDto,
    MainWalletResponseDto,
    QuidaxQueryDto,
    RemoveFromWatchlistDto,
    SellCryptoDto,
    SendCryptoDto,
    SwapQuotationDto,
    WithdrawDto,
} from './dto/crypto.dto';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import axios, { AxiosError } from 'axios';
import {
    BaseResponseTypeDTO,
    checkForRequiredFields,
    // CryptoCurrencyType,
    generateUniqueCode,
    httpPost,
    PaymentStatus,
    TransactionType,
    TransactionTypeAction,
} from 'src/utils';
import { TransactionService } from '@modules/transaction/transaction.service';
import { UserService } from '@modules/user/user.service';
import { QuidaxorderService } from '@modules/quidaxorder/quidaxorder.service';


@Injectable()
export class CryptoService {
    private logger = new Logger();
    private readonly coinLogos: Record<string, string> = {
        QDX: 'https://files.readme.io/d1d2eeb-small-quidax_emblem-skeumorphic.png',
        BTC: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
        ETH: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
        USDT: 'https://assets.coingecko.com/coins/images/325/large/Tether-logo.png',
        USDC: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png',
        BNB: 'https://assets.coingecko.com/coins/images/825/large/binance-coin-logo.png',
        XRP: 'https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png',
        ADA: 'https://assets.coingecko.com/coins/images/975/large/cardano.png',
        DOGE: 'https://assets.coingecko.com/coins/images/5/large/dogecoin.png',
        DOT: 'https://assets.coingecko.com/coins/images/12171/large/polkadot.png',
        LTC: 'https://assets.coingecko.com/coins/images/2/large/litecoin.png',
        TRX: 'https://assets.coingecko.com/coins/images/1094/large/tron.png',
        LINK: 'https://assets.coingecko.com/coins/images/877/large/chainlink-new-logo.png',
        SHIB: 'https://assets.coingecko.com/coins/images/11939/large/shiba.png',
        MATIC:
            'https://assets.coingecko.com/coins/images/4713/large/matic-token-icon.png',
        SOL: 'https://assets.coingecko.com/coins/images/4128/large/solana.png',
        XLM: 'https://assets.coingecko.com/coins/images/100/large/Stellar_symbol_black_RGB.png',
        AAVE: 'https://assets.coingecko.com/coins/images/12645/large/AAVE.png',
        CAKE: 'https://assets.coingecko.com/coins/images/12632/large/pancakeswap.png',
        FIL: 'https://assets.coingecko.com/coins/images/12817/large/filecoin.png',
        SAND: 'https://assets.coingecko.com/coins/images/12129/large/sandbox_logo.png',
        ENJ: 'https://assets.coingecko.com/coins/images/1103/large/enjin-coin-logo.png',
        LRC: 'https://assets.coingecko.com/coins/images/913/large/loopring.png',
        ALGO: 'https://assets.coingecko.com/coins/images/4380/large/download.png',
        ARB: 'https://assets.coingecko.com/coins/images/16547/large/photo_2023-03-29_21.47.00.jpeg',
        STX: 'https://assets.coingecko.com/coins/images/2069/large/stacks.png',
        NEAR: 'https://assets.coingecko.com/coins/images/10365/large/near.png',
        INJ: 'https://assets.coingecko.com/coins/images/12882/large/Injective_Protocol_logo.png',
        RNDR: 'https://assets.coingecko.com/coins/images/11636/large/rndr.png',
        TON: 'https://assets.coingecko.com/coins/images/17980/large/toncoin.png',
        // QDX: 'https://assets.coingecko.com/coins/images/12345/large/qdx.png',
        DASH: 'https://assets.coingecko.com/coins/images/19/large/dash-logo.png',
        ONE: 'https://assets.coingecko.com/coins/images/4344/large/Harmony.png',
        BCH: 'https://assets.coingecko.com/coins/images/780/large/bitcoin-cash-circle.png',
        XTZ: 'https://assets.coingecko.com/coins/images/976/large/Tezos-logo.png',
        SUSHI: 'https://assets.coingecko.com/coins/images/12271/large/sushi.png',
        ZIL: 'https://assets.coingecko.com/coins/images/2687/large/Zilliqa-logo.png',
        APE: 'https://assets.coingecko.com/coins/images/24383/large/apecoin.jpg',
        CFX: 'https://assets.coingecko.com/coins/images/12276/large/Conflux_Network_logo.png',
        WLD: 'https://assets.coingecko.com/coins/images/31069/large/worldcoin.png',
        PEPE: 'https://assets.coingecko.com/coins/images/29850/large/pepe-token.png',
        MEME: 'https://assets.coingecko.com/coins/images/32504/large/meme.png',
        BONK: 'https://assets.coingecko.com/coins/images/28752/large/bonk.png',
        SUI: 'https://assets.coingecko.com/coins/images/30161/large/sui.png',
        ORDI: 'https://assets.coingecko.com/coins/images/30161/large/ordi.png',
        ENS: 'https://assets.coingecko.com/coins/images/19785/large/ens.png',
        WIF: 'https://assets.coingecko.com/coins/images/33085/large/wif.png',
        JUP: 'https://assets.coingecko.com/coins/images/33085/large/jup.png',
        BLUR: 'https://assets.coingecko.com/coins/images/28453/large/blur.png',
        FET: 'https://assets.coingecko.com/coins/images/5681/large/fet.png',
        AI: 'https://assets.coingecko.com/coins/images/12345/large/ai.png',
        BOB: 'https://assets.coingecko.com/coins/images/12345/large/bob.png',
        SLERF: 'https://assets.coingecko.com/coins/images/12345/large/slerf.png',
        BOME: 'https://assets.coingecko.com/coins/images/12345/large/bome.png',
        MNT: 'https://assets.coingecko.com/coins/images/12345/large/mnt.png',
        BEAM: 'https://assets.coingecko.com/coins/images/12345/large/beam.png',
        STRK: 'https://assets.coingecko.com/coins/images/12345/large/strk.png',
        GNO: 'https://assets.coingecko.com/coins/images/662/large/gnosis.png',
        WAVES: 'https://assets.coingecko.com/coins/images/425/large/waves.png',
        XYO: 'https://assets.coingecko.com/coins/images/4519/large/XYO_Network-logo.png',
        TRUMP: 'https://assets.coingecko.com/coins/images/12345/large/trump.png',
        MELANIA:
            'https://assets.coingecko.com/coins/images/12345/large/melania.png',
        CNGN: 'https://assets.coingecko.com/coins/images/12345/large/cngn.png',
        FARTCOIN:
            'https://assets.coingecko.com/coins/images/12345/large/fartcoin.png',
        PNUT: 'https://assets.coingecko.com/coins/images/12345/large/pnut.png',
        HYPE: 'https://assets.coingecko.com/coins/images/12345/large/hype.png',
        // For tokens without official logos, consider using a placeholder image
        // Example: 'UNKNOWN': 'https://assets.coingecko.com/coins/images/1/large/placeholder.png',
    };

    private readonly apiUrl = 'https://app.quidax.io/api/v1/users';
    private readonly baseUrl = 'https://app.quidax.io/api/v1';

    private readonly COINGECKO_API_URL =
        'https://api.coingecko.com/api/v3/coins/markets';
    private readonly COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';

    constructor(
        private readonly userSrv: UserService,
        private readonly eventEmitterSrv: EventEmitter2,
        private readonly transactionSrv: TransactionService,
        private readonly QuidaxorderSrv: QuidaxorderService,
    ) { }

    // @OnEvent('create-crypto-wallet', { async: true })
    // async createWallet(payload: {
    //     userId: string;
    //     req?: Request;
    // }): Promise<void> {
    //     try {
    //         console.log('creating crypto wallet');
    //         console.log('creating crypto wallet');
    //         checkForRequiredFields(['userId'], payload);
    //         // validateUUIDField(payload.userId, 'userId');
    //         const user = await this.userSrv.findUserById(payload.userId);
    //         const {
    //             data: { firstName, lastName, email },
    //         } = user;
    //         if (firstName && lastName && email) {
    //             const headers = {
    //                 Authorization: `Bearer ${process.env.QUIDAX_Secrete_key}`,
    //                 'Content-Type': 'application/json',
    //                 Accept: 'application/json',
    //             };
    //             const response = await httpPost<any, any>(
    //                 this.apiUrl,
    //                 { email: email, first_name: firstName, last_name: lastName },
    //                 headers,
    //             );
    //             console.log(response);
    //             if (response?.status === 'success') {
    //                 console.log('user to update wallet for', payload.userId);
    //                 console.log('user to update wallet for', payload.userId);
    //                 // 🔑 directly update quidax_user_id in User table
    //                 await this.userSrv.getRepo().update(
    //                     { id: payload.userId },
    //                     { quidax_user_id: response.data.id },
    //                 );

    //                 const currencies = [
    //                     'usdt',
    //                     'btc',
    //                     'ltc',
    //                     'eth',
    //                     'xrp',
    //                     'usdt',
    //                     'dash',
    //                     'trx',
    //                     'doge',
    //                     'xrp',
    //                     'bnb',
    //                     'matic',
    //                     'shib',
    //                     'axs',
    //                     'safemoon',
    //                     'cake',
    //                     'xlm',
    //                     'aave',
    //                     'link',
    //                 ];
    //                 for (const currency of currencies) {
    //                     try {
    //                         await this.ActivatePaymentAddress(response.data.id, currency);
    //                     } catch (error) {
    //                         console.log(error);
    //                     }
    //                 }

    //                 const walletCurrencies = ['usdc', 'sol', 'busd'];
    //                 for (const currency of walletCurrencies) {
    //                     try {
    //                         await this.createPaymentAddress(response.data.id, currency);
    //                     } catch (error) {
    //                         console.log(error);
    //                     }
    //                 }
    //             }
    //         }
    //     } catch (ex) {
    //         console.log(ex);
    //         if (ex instanceof AxiosError) {
    //             const errorObject = ex.response.data;
    //             const message =
    //                 typeof errorObject === 'string'
    //                     ? errorObject
    //                     : errorObject.statusMessage;
    //             this.logger.error(message);
    //             throw new HttpException(
    //                 message,
    //                 Number(errorObject.statusCode) ?? HttpStatus.BAD_GATEWAY,
    //             );
    //         } else {
    //             this.logger.error(ex);
    //             throw ex;
    //         }
    //     }
    // }

    @OnEvent('create-crypto-wallet', { async: true })
    async createWallet(payload: {
        userId: string;
        req?: Request;
    }): Promise<void> {
        try {
            console.log('creating crypto wallet');
            checkForRequiredFields(['userId'], payload);

            const user = await this.userSrv.findUserById(payload.userId);
            const {
                data: { firstName, lastName, email },
            } = user;

            if (firstName && lastName && email) {
                const headers = {
                    Authorization: `Bearer ${process.env.QUIDAX_Secrete_key}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                };

                const response = await httpPost<any, any>(
                    this.apiUrl,
                    { email, first_name: firstName, last_name: lastName },
                    headers,
                );

                console.log(response);

                if (response?.status === 'success') {
                    console.log('user to update wallet for', payload.userId);

                    // update quidax_user_id
                    await this.userSrv.getRepo().update(
                        { id: payload.userId },
                        { quidax_user_id: response.data.id },
                    );

                    ///////////////////// --------------------------------------------------------
                    ///////////////////// Allowed currencies: btc, ltc, eth, usdt, bnb, xrp, trx
                    ///////////////////// --------------------------------------------------------
                    const currencies = ['btc', 'ltc', 'eth', 'usdt', 'bnb', 'xrp', 'trx'];

                    for (const currency of currencies) {
                        try {
                            await this.createAllPaymentAddresses(response.data.id, currency);
                        } catch (error) {
                            console.log(`Error creating wallet address for ${currency}`, error);
                        }
                    }
                    console.log('All payment addresses created 🎉');
                }
            }
        } catch (ex) {
            console.log(ex);

            if (ex instanceof AxiosError) {
                const errorObject = ex.response?.data;
                const message =
                    typeof errorObject === 'string'
                        ? errorObject
                        : errorObject?.statusMessage ?? 'Unknown Quidax error';

                this.logger.error(message);

                throw new HttpException(
                    message,
                    Number(errorObject?.statusCode) ?? HttpStatus.BAD_GATEWAY,
                );
            } else {
                this.logger.error(ex);
                throw ex;
            }
        }
    }


    async createSubAccount(
        createSubAccountDto: CreateSubAccountDto,
    ): Promise<any> {
        try {
            const response = await axios.post(this.apiUrl, createSubAccountDto, {
                headers: {
                    Authorization: `Bearer ${process.env.QUIDAX_Secrete_key}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
            });
            return response.data;
        } catch (error) {
            throw new HttpException(
                `Failed to create sub-account: ${error.response?.data?.message || error.message}`,
                error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async createAllPaymentAddresses(
        quidaxUserId: string,
        currency: string,
    ): Promise<any[]> {

        const NETWORKS = {
            btc: ['btc'], // Bitcoin native
            ltc: ['ltc'], // Litecoin native
            eth: ['erc20', 'trc20', 'bep20',], // Ethereum ERC20
            usdt: ['erc20', 'trc20', 'bep20', 'polygon', 'solana', 'celo', 'optimism', 'ton', 'arbitrum'], // all USDT networks supported
            bnb: ['bep20', 'trc20', 'bep20'], // Binance Smart Chain
            xrp: ['xrp'], // Ripple
            trx: ['trc20'], // TRON
        };


        const networks = NETWORKS[currency];

        if (!networks || networks.length === 0) {
            throw new HttpException(
                `No supported networks found for currency: ${currency}`,
                HttpStatus.BAD_REQUEST,
            );
        }

        const results = [];

        for (const network of networks) {
            try {
                const res = await this.createPaymentAddress(
                    quidaxUserId,
                    currency,
                    network,
                );
                console.log(`Created ${currency.toUpperCase()} address on ${network}`);
                results.push({ network, result: res });
            } catch (err) {
                console.log(`Failed to create ${currency} address on ${network}`, err);
                results.push({
                    network,
                    error: err.message,
                });
            }
        }

        return results;
    }


    async createPaymentAddress(
        userId: string,
        currency: string,
        network?: string,
    ): Promise<any> {
        const url = `${this.baseUrl}/users/${userId}/wallets/${currency}/addresses`;

        const params = network ? { network } : {};

        const options = {
            method: 'POST',
            headers: {
                accept: 'application/json',
                Authorization: `Bearer ${process.env.QUIDAX_Secrete_key}`,
            },
            params,
        };

        try {
            const response = await axios.post(url, null, options);
            return response.data;
        } catch (error) {
            if (error.response) {
                throw new HttpException(
                    `Failed to create payment address: ${error.response.data.message}`,
                    error.response.status,
                );
            } else {
                throw new HttpException(
                    `Failed to create payment address: ${error.message}`,
                    HttpStatus.INTERNAL_SERVER_ERROR,
                );
            }
        }
    }

    async ActivatePaymentAddress(
        userId: string,
        currency: string,
    ): Promise<BaseResponseTypeDTO> {
        const url = `${this.baseUrl}/users/${userId}/wallets/${currency}/address`;

        const options = {
            headers: {
                accept: 'application/json',
                Authorization: `Bearer ${process.env.QUIDAX_Secrete_key}`,
            },
        };

        try {
            const response = await axios.get(url, options);
            // return response.data;
            return {
                success: true,
                code: HttpStatus.OK,
                message: 'Wallet Created',
                data: 'WALLET CREATION IN PROGRESS',
            };
        } catch (error) {
            if (error.response) {
                throw new HttpException(
                    `Failed to fetch payment address: ${error.response.data.message}`,
                    error.response.status,
                );
            } else {
                throw new HttpException(
                    `Failed to fetch payment address: ${error.message}`,
                    HttpStatus.INTERNAL_SERVER_ERROR,
                );
            }
        }
    }

    async fetchPaymentAddresses(userId: string, currency: string): Promise<any> {
        const url = `${this.baseUrl}/users/${userId}/wallets/${currency}/addresses`;

        const options = {
            method: 'GET',
            headers: {
                accept: 'application/json',
                Authorization: `Bearer ${process.env.QUIDAX_Secrete_key}`,
            },
        };

        try {
            const response = await axios.get(url, options);
            return {
                success: true,
                message: 'Payment addresses fetched successfully.',
                status: HttpStatus.OK,
                data: response.data.data,
            };
        } catch (error) {
            if (error.response) {
                throw new HttpException(
                    `Failed to fetch payment addresses: ${error.response.data.message}`,
                    error.response.status,
                );
            } else {
                throw new HttpException(
                    `Failed to fetch payment addresses: ${error.message}`,
                    HttpStatus.INTERNAL_SERVER_ERROR,
                );
            }
        }
    }

    async listBaseCoins(): Promise<string[]> {
        try {
            const response = await axios.get(
                'https://app.quidax.io/api/v1/markets/summary/',
                {
                    headers: {
                        accept: 'application/json',
                    },
                },
            );

            const data = response.data?.data;
            if (!data || typeof data !== 'object') {
                throw new HttpException(
                    'Invalid response from Quidax',
                    HttpStatus.BAD_REQUEST,
                );
            }

            const baseCoins = new Set<string>();
            for (const key of Object.keys(data)) {
                const [base] = key.split('_');
                baseCoins.add(base);
            }

            return Array.from(baseCoins);
        } catch (error) {
            console.error('Error fetching base coins:', error.message || error);
            throw new HttpException(
                'Could not fetch base coins',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async getMarketSummary(userId: string): Promise<any> {
        try {
            // 2. Fetch market summary from external API
            const response = await axios.get(
                'https://app.quidax.io/api/v1/markets/summary/',
                {
                    headers: {
                        accept: 'application/json',
                    },
                },
            );

            const originalData = response.data.data;
            const formattedData = [];

            // 3. Build formatted array with isWatched and baseCoin fields
            for (const pair in originalData) {
                // Skip any pair containing NGN
                if (pair.includes('NGN')) continue;

                const [base] = pair.split('_');

                formattedData.push({
                    coinPair: pair,
                    baseCoin: base,
                    coinName: base,
                    ...originalData[pair],
                    logo: this.coinLogos[base] || null
                });
            }

            return {
                success: true,
                message: 'Market Summary fetched successfully.',
                status: HttpStatus.OK,
                code: HttpStatus.OK,
                data: formattedData,
            };
        } catch (error) {
            throw new HttpException(
                {
                    message: 'Failed to fetch market summary',
                    details: error.response?.data || error.message,
                },
                HttpStatus.BAD_REQUEST,
            );
        }
    }


    async fetchUserWallets(userId: string): Promise<any> {
        const url = `${this.baseUrl}/users/${userId}/wallets`;

        const options = {
            method: 'GET',
            headers: {
                accept: 'application/json',
                Authorization: `Bearer ${process.env.QUIDAX_Secrete_key}`,
            },
        };

        try {
            const response = await axios.get(url, options);
            const wallets = response.data.data;

            // Allowed coins list
            const allowedCurrencies = ['usdt', 'btc', 'eth', 'ltc', 'bch'];

            // Add image_url and filter unwanted items
            const enhancedWallets = wallets
                .map((wallet) => {
                    const symbol = wallet.currency?.toUpperCase();
                    return {
                        ...wallet,
                        image_url: this.coinLogos[symbol] || null,
                    };
                })
                .filter(
                    (wallet) =>
                        allowedCurrencies.includes(wallet.currency) &&
                        wallet.deposit_address &&
                        wallet.image_url
                );

            return {
                success: true,
                message: 'User wallets fetched successfully.',
                status: HttpStatus.OK,
                code: HttpStatus.OK,
                data: enhancedWallets,
            };
        } catch (error) {
            if (error.response) {
                throw new HttpException(
                    `Failed to fetch user wallets: ${error.response.data.message}`,
                    error.response.status,
                );
            } else {
                throw new HttpException(
                    `Failed to fetch user wallets: ${error.message}`,
                    HttpStatus.INTERNAL_SERVER_ERROR,
                );
            }
        }
    }


    async fetchUserWalletsForSwapping(userId: string): Promise<any> {
        const url = `${this.baseUrl}/users/${userId}/wallets`;

        const options = {
            method: 'GET',
            headers: {
                accept: 'application/json',
                Authorization: `Bearer ${process.env.QUIDAX_Secrete_key}`,
            },
        };

        try {
            // 🔹 Fetch Quidax wallets
            const response = await axios.get(url, options);
            const wallets = response.data.data;

            // 🔹 Get user to attach NGN balance
            const user = await this.userSrv.findUserByQuidaxId(userId);

            // If user has no balance field, default to 0
            const nairaBalance = user.data.walletBalance ?? 0;

            // Allowed crypto coins
            const allowedCurrencies = ['usdt', 'btc', 'eth', 'ltc', 'bch'];

            // Enhance crypto wallets
            const enhancedWallets = wallets
                .map((wallet) => {
                    const symbol = wallet.currency?.toUpperCase();
                    return {
                        ...wallet,
                        image_url: this.coinLogos[symbol] || null,
                    };
                })
                .filter(
                    (wallet) =>
                        allowedCurrencies.includes(wallet.currency) &&
                        wallet.deposit_address &&
                        wallet.image_url
                );

            // 🔥 Add hardcoded NAIRA Wallet

                    const tickerResponse = await this.getMarketTicker({ currency: "usdtngn" });

        const selectedPriceType ='buy';
        const usdPrice = parseFloat(tickerResponse.data.ticker[selectedPriceType]);

            const nairaWallet = {
                id: null,
                name: "Naira Wallet",
                currency: "ngn",
           balance: (nairaBalance / usdPrice).toFixed(2),
                locked: null,
                staked: null,
                user: {
                    id: userId,
                    email: user.data.email,
                    first_name: user.data.firstName || null,
                    last_name: user.data.lastName || null,
                },
                converted_balance: nairaBalance.toString(),
                reference_currency: "ngn",
                is_crypto: false,
                created_at: null,
                updated_at: null,
                blockchain_enabled: false,
                default_network: null,
                networks: [],
                deposit_address: null,
                destination_tag: null,

                // Realistic NGN image
                image_url:
                    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Flag_of_Nigeria.svg/2560px-Flag_of_Nigeria.svg.png",
            };

            // 🔹 Final result with NGN wallet at the top
            const finalWallets = [nairaWallet, ...enhancedWallets];

            return {
                success: true,
                message: "User wallets fetched successfully.",
                status: HttpStatus.OK,
                code: HttpStatus.OK,
                data: finalWallets,
            };

        } catch (error) {
            if (error.response) {
                throw new HttpException(
                    `Failed to fetch user wallets: ${error.response.data.message}`,
                    error.response.status,
                );
            } else {
                throw new HttpException(
                    `Failed to fetch user wallets: ${error.message}`,
                    HttpStatus.INTERNAL_SERVER_ERROR,
                );
            }
        }
    }


    async getUserWallet(getUserWalletDto: GetUserWalletDto): Promise<any> {
        const { user_id, currency } = getUserWalletDto;
        const url = `${this.baseUrl}/users/${user_id}/wallets/${currency}`;

        const options = {
            method: 'GET',
            headers: {
                accept: 'application/json',
                Authorization: `Bearer ${process.env.QUIDAX_Secrete_key}`,
            },
        };

        try {
            const response = await axios.get(url, options);
            return {
                success: true,
                message: 'User wallet fetched successfully',
                status: HttpStatus.OK,
                code: HttpStatus.OK,
                data: response.data.data,
            };
        } catch (error) {
            throw new HttpException(
                `Failed to fetch wallet: ${error.response?.data?.message || error.message}`,
                error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async getMarkets() {
        try {
            const response = await axios.get(
                'https://app.quidax.io/api/v1/markets/tickers',
                {
                    headers: {
                        accept: 'application/json',
                        'content-type': 'application/json',
                        Authorization: `Bearer ${process.env.QUIDAX_Secrete_key}`,
                    },
                },
            );

            return response.data;
        } catch (error) {
            throw new HttpException(
                error.response?.data || 'Failed to fetch markets from Quidax',
                error.response?.status || HttpStatus.BAD_REQUEST,
            );
        }
    }

    async getCryptoMarketPrices(vsCurrency: string = 'usd') {
        try {
            const response = await axios.get(this.COINGECKO_API_URL, {
                params: {
                    vs_currency: vsCurrency,
                    order: 'market_cap_desc',
                    per_page: 100,
                    page: 1,
                    sparkline: false,
                },
            });

            const data = response.data;

            if (!data || !Array.isArray(data)) {
                return {
                    success: false,
                    message: 'Invalid response from CoinGecko API',
                    status: HttpStatus.BAD_GATEWAY,
                    data: null,
                };
            }

            const transformed = data.map((coin: any) => ({
                id: coin.id,
                name: coin.name,
                symbol: coin.symbol?.toUpperCase(),
                currentPrice: coin.current_price,
                marketCap: coin.market_cap,
                volume: coin.total_volume,
                percentageChange24h: coin.price_change_percentage_24h,
                highestPrice24h: coin.high_24h,
                lowestPrice24h: coin.low_24h,
                image: coin.image,
            }));

            return {
                success: true,
                message: 'Cryptocurrency market data retrieved successfully',
                status: HttpStatus.OK,
                code: HttpStatus.OK,
                data: transformed,
            };
        } catch (error) {
            return {
                success: false,
                message: 'Failed to fetch cryptocurrency market data',
                status: error.response?.status || HttpStatus.BAD_REQUEST,
                data: error.response?.data || null,
            };
        }
    }

    async getTopMovers() {
        try {
            // Fetch the market data
            const marketData = await this.getCryptoMarketPrices();

            // Sort by percentage change (biggest movers up or down)
            const sortedData = marketData.data.sort(
                (a, b) => b.percentageChange24h - a.percentageChange24h,
            );

            // Return a structured response
            return {
                data: sortedData, // The sorted data
                success: true, // Indicates successful operation
                message: 'Top movers fetched successfully', // Success message
                status: HttpStatus.OK, // HTTP status code for success
                code: HttpStatus.OK,
            };
        } catch (error) {
            throw new HttpException(
                'Failed to fetch top movers',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async getCoinIdBySymbol(symbol: string): Promise<string> {
        try {
            const response = await axios.get(`${this.COINGECKO_BASE_URL}/coins/list`);
            const coin = response.data.find(
                (coin: any) => coin.symbol.toLowerCase() === symbol.toLowerCase(),
            );

            if (!coin) {
                throw new HttpException(
                    'Cryptocurrency symbol not found',
                    HttpStatus.NOT_FOUND,
                );
            }

            return coin.id; // Return CoinGecko ID
        } catch (error) {
            throw new HttpException(
                'Failed to fetch cryptocurrency list',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    // Step 2: Fetch Full Details by Symbol
    async getCryptoDetailsBySymbol(symbol: string) {
        try {
            const coinId = await this.getCoinIdBySymbol(symbol);
            const response = await axios.get(
                `${this.COINGECKO_BASE_URL}/coins/${coinId}`,
            );

            if (!response.data) {
                throw new HttpException(
                    'Failed to fetch cryptocurrency details',
                    HttpStatus.BAD_GATEWAY,
                );
            }

            const coin = response.data;
            return {
                id: coin.id,
                name: coin.name,
                symbol: coin.symbol.toUpperCase(),
                description: coin.description.en, // Full description
                homepage: coin.links.homepage[0], // Official website
                genesisDate: coin.genesis_date, // Launch date
                marketData: {
                    currentPrice: coin.market_data.current_price.usd,
                    marketCap: coin.market_data.market_cap.usd,
                    volume: coin.market_data.total_volume.usd,
                    high24h: coin.market_data.high_24h.usd,
                    low24h: coin.market_data.low_24h.usd,
                    percentageChange24h: coin.market_data.price_change_percentage_24h,
                },
                image: coin.image.large, // High-resolution logo
            };
        } catch (error) {
            throw new HttpException(
                error.response?.data || 'Failed to fetch cryptocurrency details',
                error.response?.status || HttpStatus.BAD_REQUEST,
            );
        }
    }

    async fetchKlineData(
        fetchKlineDto: FetchKlineDto,
        market: string,
    ): Promise<any> {
        const { period = 1, limit = 30 } = fetchKlineDto;

        // Construct the URL with query parameters
        const url = `${this.baseUrl}/markets/${market}/k?period=${period}&limit=${limit}`;

        const options = {
            method: 'GET',
            headers: {
                accept: 'application/json',
                Authorization: `Bearer ${process.env.QUIDAX_Secrete_key}`,
            },
        };

        try {
            const response = await axios.get(url, options);
            const klineData = response.data;

            // Add the dates to each K-line entry using the timestamp
            const result = klineData.data.map((entry: number[]) => {
                const entryDate = new Date(entry[0] * 1000); // Convert timestamp to milliseconds
                return {
                    date: entryDate.toISOString(), // Convert date to ISO format
                    timestamp: entry[0],
                    open: entry[1],
                    high: entry[2],
                    low: entry[3],
                    close: entry[4],
                    volume: entry[5],
                };
            });

            return {
                status: klineData.status,
                message: klineData.message,
                code: HttpStatus.OK,
                data: result,
            };
        } catch (error) {
            throw new HttpException(
                `Failed to fetch K-line data: ${error.response?.data?.message || error.message}`,
                error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async getMarketTicker(getMarketTickerDto: GetMarketTickerDto) {
        // // Allowed Currencies values: qdxusdt, btcusdt, btcngn, ethngn, qdxngn, xrpngn, dashngn,
        //  ltcngn, usdtngn, btcghs, usdtghs, trxngn, dogeusdt, bnbusdt, maticusdt, safemoonusdt, aaveusdt, shibusdt,
        //  dotusdt, linkusdt, cakeusdt, xlmusdt, xrpusdt, ltcusdt, ethusdt, trxusdt, axsusdt, wsgusdt, afenusdt, blsusdt, dashusdt.
        const apiUrl = 'https://app.quidax.io/api/v1/markets/tickers';
        const { currency } = getMarketTickerDto;

        try {
            const options = {
                method: 'GET',
                headers: {
                    accept: 'application/json',
                    Authorization: `Bearer ${process.env.QUIDAX_Secrete_key}`,
                },
            };
            const response = await axios.get(`${apiUrl}/${currency}`, options);
            return response.data;
        } catch (error) {
            console.log(error);
            throw new HttpException(
                'Error fetching market ticker',
                HttpStatus.BAD_REQUEST,
            );
        }
    }

    async getNetworkFee(dto: GetQuidaxFeeDto) {
        const { currency, network } = dto;

        // Build URL dynamically
        let apiUrl = `https://app.quidax.io/api/v1/fee?currency=${currency}`;
        if (network) {
            apiUrl += `&network=${network}`;
        }

        try {
            const response = await axios.get(apiUrl, {
                headers: {
                    accept: 'application/json',
                    Authorization: `Bearer ${process.env.QUIDAX_Secrete_key}`,
                },
            });

            return {
                success: true,
                code: HttpStatus.OK,
                message: 'Network fee fetched successfully.',
                data: response.data,
            };

        } catch (error) {
            console.error(
                '❌ Error in getNetworkFee:',
                error.response?.data || error.message,
            );

            const errorMessage =
                error.response?.data?.message ||
                error.response?.data?.error ||
                error.message ||
                'Unable to fetch fee';

            throw new HttpException(
                { message: 'Failed to fetch network fee', details: errorMessage },
                HttpStatus.BAD_REQUEST,
            );
        }
    }


    async getNetworkFeeWithUsdValue(dto: GetNetworkFeeUsdDto) {
        const { currency, priceType, network } = dto;

        // 🟢 Auto-set ticker for USDT
        let ticker = dto.ticker;
        if (currency.toLowerCase() === 'usdt') {
            ticker = 'usdtusd';
        }

        // 1. Fetch network fee
        const feeResponse = await this.getNetworkFee({ currency, network });
        const fee = feeResponse.data.data.fee;

        // 2. Fetch ticker for USD conversion
        if (!ticker) {
            throw new HttpException(
                'Ticker (e.g., btcusdt, ltcusdt) is required to calculate USD value.',
                HttpStatus.BAD_REQUEST,
            );
        }

        const tickerResponse = await this.getMarketTicker({ currency: ticker });

        const selectedPriceType = priceType || 'buy';
        const usdPrice = parseFloat(tickerResponse.data.ticker[selectedPriceType]);

        // 3. Calculate USD value
        const usdValue = fee * usdPrice;

        return {
            success: true,
            code: HttpStatus.OK,
            message: 'Network fee with USD value fetched successfully.',
            data: {
                fee_crypto: fee,
                fee_type: feeResponse.data.data.type,
                usd_per_unit: usdPrice,
                price_type_used: selectedPriceType,
                usd_value: parseFloat(usdValue.toFixed(5)),
                ticker_used: ticker,
                original_fee_response: feeResponse.data,
                original_ticker_response: tickerResponse,
            },
        };
    }




    async checkUserWalletBalance(
        getUserWalletDto: GetUserWalletDto,
        amountToCheck: number,
    ): Promise<MainWalletResponseDto> {
        const { user_id, currency } = getUserWalletDto;
        const url = `${this.baseUrl}/users/${user_id}/wallets/${currency}`;

        const options = {
            method: 'GET',
            headers: {
                accept: 'application/json',
                Authorization: `Bearer ${process.env.QUIDAX_Secrete_key}`, // Replace with your actual API key
            },
        };

        try {
            // Fetch wallet data from external API
            const response = await axios.get(url, options);
            const walletData = response.data.data;

            // Get user data from the database


            const user = await this.userSrv.getRepo().findOne({ where: { quidax_user_id: user_id } });

            if (!user) {
                throw new HttpException('User not found', HttpStatus.NOT_FOUND);
            }

            // Calculate the adjusted balance
            const adjustedBalance = parseFloat(walletData.balance);

            // Check if the balance is sufficient
            if (adjustedBalance < amountToCheck) {
                throw new ConflictException('Insufficient balance');
            }

            // Prepare the response data
            const data = {
                wallet: currency,
                balance: adjustedBalance.toFixed(8),
                deposit_address: walletData.deposit_address,
                default_network: walletData.default_network,
            };

            // Return the successful response following the BaseResponseTypeDTO structure
            return {
                success: true,
                code: HttpStatus.OK,
                message: 'Wallet fetched successfully',
                data: data,
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    code: error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
                    message: `Failed to fetch wallet: ${error.response?.data?.message || error.message}`,
                },
                error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async confirmInstantOrder(confirmInstantOrderDto: ConfirmInstantOrderDto) {
        const { userId, instantOrderId } = confirmInstantOrderDto;
        const apiUrl = `https://app.quidax.io/api/v1/users/${userId}/instant_orders/${instantOrderId}/confirm`;

        try {
            const options = {
                method: 'POST',
                headers: {
                    accept: 'application/json',
                    Authorization: `Bearer ${process.env.QUIDAX_Secrete_key}`, // Replace with your actual token
                },
            };

            const response = await axios.post(apiUrl, {}, options);
            return response.data;
        } catch (error) {
            console.log(error);
            throw new HttpException(
                'Error confirming instant order',
                HttpStatus.BAD_REQUEST,
            );
        }
    }

    async createInstantBuyOrder(
        user_id: string,
        createInstantOrderDto: CreateInstantOrderDto,
    ) {
        try {
            const options = {
                method: 'POST',
                headers: {
                    accept: 'application/json',
                    Authorization: `Bearer ${process.env.QUIDAX_Secrete_key}`,
                },
                data: createInstantOrderDto,
            };

            const response = await axios.post(
                `${this.apiUrl}/${user_id}/instant_orders`,
                createInstantOrderDto,
                options,
            );
            console.log(response);
            await this.confirmInstantOrder({
                userId: user_id,
                instantOrderId: response.data.data.id,
            });
            return response.data;
        } catch (error) {
            console.log(error);
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
        }
    }

    async getAllUserTransactions(userId: string, currency: string) {
        const user = await this.userSrv.findUserById(userId);

        if (!user?.data?.quidax_user_id) {
            throw new HttpException(
                'User not found or missing Quidax ID',
                HttpStatus.NOT_FOUND,
            );
        }

        const quidaxUserId = user.data.quidax_user_id;
        const headers = {
            accept: 'application/json',
            Authorization: `Bearer ${process.env.QUIDAX_Secrete_key}`,
        };

        try {
            // Withdrawals
            const withdrawalsResponse = await axios.get(
                `https://app.quidax.io/api/v1/users/${quidaxUserId}/withdraws`,
                {
                    params: { order_by: 'asc', currency },
                    headers,
                },
            );

            // Deposits
            const depositsResponse = await axios.get(
                `https://app.quidax.io/api/v1/users/${quidaxUserId}/deposits`,
                {
                    params: { order_by: 'asc', currency },
                    headers,
                },
            );

            // Swap Transactions (no currency filter supported)
            const swapsResponse = await axios.get(
                `https://app.quidax.io/api/v1/users/${quidaxUserId}/swap_transactions`,
                { headers },
            );

            const sortByDate = (arr) =>
                arr?.sort(
                    (a, b) =>
                        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
                );

            // Filter function to check if transaction has traces of the specified currency
            const filterByCurrency = (transactions) => {
                const currencyLower = currency.toLowerCase();

                return transactions.filter((transaction) => {
                    // Check common currency fields (case-insensitive)
                    if (transaction.currency?.toLowerCase() === currencyLower)
                        return true;
                    if (transaction.currency_code?.toLowerCase() === currencyLower)
                        return true;
                    if (transaction.base_currency?.toLowerCase() === currencyLower)
                        return true;
                    if (transaction.quote_currency?.toLowerCase() === currencyLower)
                        return true;

                    // For swap transactions, check both sides of the swap
                    if (transaction.from_currency?.toLowerCase() === currencyLower)
                        return true;
                    if (transaction.to_currency?.toLowerCase() === currencyLower)
                        return true;

                    // Check nested objects that might contain currency info
                    if (transaction.wallet?.currency?.toLowerCase() === currencyLower)
                        return true;
                    if (transaction.account?.currency?.toLowerCase() === currencyLower)
                        return true;

                    // Check if currency appears in any string values (case-insensitive)
                    const transactionString = JSON.stringify(transaction).toLowerCase();
                    return transactionString.includes(currencyLower);
                });
            };

            const withdrawals = withdrawalsResponse.data?.data || [];
            const deposits = depositsResponse.data?.data || [];
            const swapTransactions = swapsResponse.data?.data || [];

            return {
                success: true,
                message: 'Transactions fetched successfully.',
                status: HttpStatus.OK,
                code: HttpStatus.OK,
                data: {
                    withdrawals: sortByDate(filterByCurrency(withdrawals)),
                    deposits: sortByDate(filterByCurrency(deposits)),
                    swapTransactions: sortByDate(filterByCurrency(swapTransactions)),
                },
            };
        } catch (error) {
            throw new HttpException(
                error.response?.data || 'Failed to fetch transactions from Quidax',
                error.response?.status || HttpStatus.BAD_REQUEST,
            );
        }
    }

    async getUserQuidaxData(
        userId: string,
        type: 'withdraws' | 'deposits' | 'swap_transactions',
        currency?: string,
        state?: string,
        orderBy: 'asc' | 'desc' = 'asc',
    ) {
        const allowedStates = ['submitted', 'processing', 'done', 'rejected'];

        if (type === 'withdraws' && state && !allowedStates.includes(state)) {
            throw new HttpException(
                `Invalid state value for withdraws. Allowed values: ${allowedStates.join(', ')}`,
                HttpStatus.BAD_REQUEST,
            );
        }

        const user = await this.userSrv.findUserById(userId);
        if (!user?.data?.quidax_user_id) {
            throw new HttpException(
                'User not found or missing Quidax ID',
                HttpStatus.NOT_FOUND,
            );
        }

        const url = `https://app.quidax.io/api/v1/users/${user.data.quidax_user_id}/${type}`;

        // Apply params ONLY if type is 'withdraws'
        const params: Record<string, string> = {};
        if (type === 'withdraws') {
            params.order_by = orderBy;
            if (currency) params.currency = currency;
            if (state) params.state = state;
        }

        try {
            const response = await axios.get(url, {
                params,
                headers: {
                    accept: 'application/json',
                    Authorization: `Bearer ${process.env.QUIDAX_Secrete_key}`,
                },
            });

            const data = response.data?.data || [];

            // Sort withdrawals only, as others may be pre-sorted or not support ordering
            if (type === 'withdraws') {
                return data.sort((a, b) => {
                    const aTime = new Date(a.created_at).getTime();
                    const bTime = new Date(b.created_at).getTime();
                    return orderBy === 'desc' ? bTime - aTime : aTime - bTime;
                });
            }

            return data;
        } catch (error) {
            throw new HttpException(
                error.response?.data || `Failed to fetch ${type} from Quidax`,
                error.response?.status || HttpStatus.BAD_REQUEST,
            );
        }
    }

    async getUserWithdrawals(
        userId: string,
        currency: string,
        state?: string,
        orderBy: string = 'asc',
    ) {
        // Allowed state values
        const allowedStates = ['processing', 'done', 'rejected'];

        if (state && !allowedStates.includes(state)) {
            throw new HttpException(
                `Invalid state value. Allowed values: ${allowedStates.join(', ')}`,
                HttpStatus.BAD_REQUEST,
            );
        }

        const user = await this.userSrv.findUserById(userId);

        if (!user || !user.data || !user.data.quidax_user_id) {
            throw new HttpException(
                'User not found or missing Quidax ID',
                HttpStatus.NOT_FOUND,
            );
        }

        try {
            const params: any = {
                order_by: orderBy,
                currency: currency,
            };

            if (state) {
                params.state = state; // Add state filter if provided
            }

            const response = await axios.get(
                `https://app.quidax.io/api/v1/users/${user.data.quidax_user_id}/withdraws`,
                {
                    params: {
                        order_by: orderBy,
                        currency,
                        state,
                    },
                    headers: {
                        accept: 'application/json',
                        'content-type': 'application/json',
                        Authorization: `Bearer ${process.env.QUIDAX_Secrete_key}`,
                    },
                },
            );

            let withdrawals = response.data;

            // If no state is provided, sort all results by created_at
            if (!state) {
                withdrawals = withdrawals.sort(
                    (a, b) =>
                        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
                );
            }

            return withdrawals;
        } catch (error) {
            throw new HttpException(
                error.response?.data || 'Failed to fetch user withdrawals from Quidax',
                error.response?.status || HttpStatus.BAD_REQUEST,
            );
        }
    }

    private allowedCurrencies = [
        'usdt',
        'btc',
        'ltc',
        'eth',
        'xrp',
        'usdt',
        'dash',
        'trx',
        'doge',
        'xrp',
        'bnb',
        'matic',
        'shib',
        'axs',
        'safemoon',
        'cake',
        'xlm',
        'aave',
        'link',
    ];

    async UserSendCrypto(withdrawDto: SendCryptoDto) {
        const user = await this.userSrv.getRepo().findOne({ where: { quidax_user_id: withdrawDto.userId } });


        const apiUrl = `https://app.quidax.io/api/v1/users/${user.quidax_user_id}/withdraws`;
        const { currency, amount, fund_uid } = withdrawDto;

        const referenceNumber = generateUniqueCode(13);
        try {
            // await this.userSrv.verifyCodeAfterSignuporLoginAndTransaction(
            //     verification_code,
            //     user.id,
            // );
            const options = {
                method: 'POST',
                headers: {
                    accept: 'application/json',
                    'content-type': 'application/json',
                    Authorization: `Bearer ${process.env.QUIDAX_Secrete_key}`, // Replace with your actual token
                },
                data: {
                    fund_uid,
                    currency,
                    amount,
                    transaction_note: 'Stay safe',
                    narration: 'We love you.',
                    // network, // Add network to the request
                    reference: referenceNumber,
                },
            };

            const response = await axios.post(apiUrl, options.data, {
                headers: options.headers,
            });
            return {
                success: true,
                code: HttpStatus.OK,
                message: 'Crypto Successfully sent',
                data: response.data,
            };
        } catch (error) {
            console.error(
                '❌ Error in UserSendCrypto:',
                error.response?.data || error.message,
            );

            const errorMessage =
                error.response?.data?.message ||
                error.response?.data?.error ||
                error.message ||
                'Error performing withdrawal';

            throw new HttpException(
                { message: 'Withdrawal failed', details: errorMessage },
                HttpStatus.BAD_REQUEST,
            );
        }
    }

    async getSwapQuotation(payload: SwapQuotationDto): Promise<any> {
        const apiUrl = `https://app.quidax.io/api/v1/users/${payload.quidax_userId}/swap_quotation`;

        try {
            const response = await axios.post(apiUrl, payload, {
                headers: {
                    accept: 'application/json',
                    'content-type': 'application/json',
                    Authorization: `Bearer ${process.env.QUIDAX_Secrete_key}`, // Replace with your actual token
                },
            });
            return {
                success: true,
                code: HttpStatus.OK,
                message: 'Successfully swap Quotation',
                data: response.data.data,
            };
        } catch (error) {
            console.error(
                '❌ Quidax Swap Quotation Error:',
                error.response?.data || error.message,
            );
            throw new HttpException(
                {
                    message: 'Failed to fetch swap quotation',
                    details: error.response?.data || error.message,
                },
                HttpStatus.BAD_REQUEST,
            );
        }
    }



    async confirmSwapQuotation(
        quidax_userId: string,
        swapId: string,
        amount?: number,
        toCurrency?: string,
        fromCurrency?: string
    ): Promise<any> {

        // 🔹 If amount, fromCurrency, toCurrency exist, run custom logic
        const hasCustomParams = amount && fromCurrency && toCurrency;

        if (hasCustomParams) {
            // 🛑 Cannot swap from NGN to other currency
            if (fromCurrency.toLowerCase() === 'ngn') {
                throw new HttpException(
                    'You cannot swap NGN to another currency.',
                    HttpStatus.BAD_REQUEST,
                );
            }

            // 💰 If converting TO NGN, call UserSellCrypto
            if (toCurrency.toLowerCase() === 'ngn') {
                // Fetch the user details using their Quidax user ID
                const user = await this.userSrv.findUserByQuidaxId(quidax_userId);
                if (!user) {
                    throw new HttpException(
                        'User not found for provided Quidax User ID',
                        HttpStatus.NOT_FOUND,
                    );
                }

                // Prepare payload for sell crypto
                const sellPayload = {
                    userId: user.data.id, // internal database id
                    amount: amount,
                    currency: fromCurrency.toLowerCase(),
                };

                // Call your internal sell crypto function
                const sellResult = await this.UserSellCrypto(sellPayload);

                return {
                    success: true,
                    code: HttpStatus.OK,
                    message: 'Crypto sold successfully.',
                    data: sellResult,
                };
            }
        }

        // 🔹 Otherwise run normal confirm swap API call
        const apiUrl = `https://app.quidax.io/api/v1/users/${quidax_userId}/swap_quotation/${swapId}/confirm`;

        try {
            const response = await axios.post(
                apiUrl,
                {}, // No payload needed
                {
                    headers: {
                        accept: 'application/json',
                        Authorization: `Bearer ${process.env.QUIDAX_Secrete_key}`,
                    },
                },
            );

            return {
                success: true,
                code: HttpStatus.OK,
                message: 'Swap confirmed successfully.',
                data: response.data.data,
            };

        } catch (error) {
            console.error('❌ Confirm Swap Error:', error.response?.data || error.message);

            throw new HttpException(
                'Failed to confirm swap',
                HttpStatus.BAD_REQUEST,
            );
        }
    }


    // async confirmSwapQuotation(
    //     quidax_userId: string,
    //     swapId: string,
    //     amount: number,
    //     toCurrency: string,
    //     fromCurrency: string
    // ): Promise<any> {

    //     const apiUrl = `https://app.quidax.io/api/v1/users/${quidax_userId}/swap_quotation/${swapId}/confirm`;

    //     try {
    //         const response = await axios.post(
    //             apiUrl,
    //             {}, // No payload needed for this call
    //             {
    //                 headers: {
    //                     accept: 'application/json',
    //                     Authorization: `Bearer ${process.env.QUIDAX_Secrete_key}`,
    //                 },
    //             },
    //         );

    //         return {
    //             success: true,
    //             code: HttpStatus.OK,
    //             message: 'Successfully swap',
    //             data: response.data.data,
    //         };
    //     } catch (error) {
    //         console.error(
    //             '❌ Confirm Swap Error:',
    //             error.response?.data || error.message,
    //         );
    //         throw new HttpException('Failed to confirm swap', HttpStatus.BAD_REQUEST);
    //     }
    // }

    async SendCrypto(withdrawDto: WithdrawDto) {
        const apiUrl = `https://app.quidax.io/api/v1/users/${withdrawDto.userId}/withdraws`;
        const {
            currency,
            amount,
            transaction_note,
            narration,
            network,
            reference,
            fund_uid,
        } = withdrawDto;
        try {
            const options = {
                method: 'POST',
                headers: {
                    accept: 'application/json',
                    'content-type': 'application/json',
                    Authorization: `Bearer ${process.env.QUIDAX_Secrete_key}`, // Replace with your actual token
                },
                data: {
                    fund_uid,
                    currency,
                    amount,
                    transaction_note,
                    narration,
                    // network, // Add network to the request
                    reference, // Add reference to the request
                },
            };

            const response = await axios.post(apiUrl, options.data, {
                headers: options.headers,
            });
            return response.data;
        } catch (error) {
            console.log(error);
            throw new HttpException(
                'Error performing withdrawal',
                HttpStatus.BAD_REQUEST,
            );
        }
    }

    async UserBuyCrypto(payload: BuyCryptoDto): Promise<BaseResponseTypeDTO> {
        const allowedCryptos = this.allowedCurrencies;
        try {
            checkForRequiredFields(['amount', 'currency', 'userId'], payload);
            if (!allowedCryptos.includes(payload.currency.toLowerCase())) {
                throw new HttpException(
                    `Invalid currency. Allowed currencies are: ${allowedCryptos.join(', ')}`,
                    HttpStatus.BAD_REQUEST,
                );
            }

            // await this.userSrv.verifyTransactionPin(
            //   payload.userId,
            //   payload.transactionPin,
            // );
            await this.userSrv.checkAccountBalance(payload.amount, payload.userId);
            const userData = await this.userSrv.findUserById(payload.userId);
            const buyOrder = await this.createInstantBuyOrder('me', {
                bid: 'ngn',
                ask: payload.currency,
                type: 'buy',
                total: payload.amount.toString(),
                unit: 'ngn',
            });
            /////////////////////////////////////////////////////////DEDUCT USER ACCOUNT THIS STAGE///////////////////////////////
            await this.QuidaxorderSrv.createOrder(
                payload.userId,
                buyOrder.data.id,
                'USER-CREDIT-WALLET',
            );
            const today = new Date();
            const referenceNumber = generateUniqueCode(13);
            const balance = await this.userSrv.checkAccountBalance(
                payload.amount,
                payload.userId,
            );
            // const currencyType = this.mapCurrencyToEnum(payload.currency);
            const newTransaction = await this.transactionSrv.createTransaction({
                userId: payload.userId,
                amount: payload.amount,
                currency: payload.currency,
                reference: referenceNumber,
                narration: 'Crypto Funding',
                type: TransactionType.DEBIT,
                typeAction: TransactionTypeAction.BUY,
                transactionStatus: PaymentStatus.SUCCESSFUL,
                transactionDate: today.toLocaleString(),
                currentBalanceBeforeTransaction: balance.currentBalance,
            });

            // console.log("Quidax buying response",buyOrder)
            return {
                success: true,
                code: HttpStatus.OK,
                message: 'Purchase initiated',
                data: { orderId: buyOrder.data.id },
            };
        } catch (ex) {
            // console.log("error from buying",ex)
            this.logger.error(ex);
            throw ex;
        }
    }

    async UserSellCrypto(payload: SellCryptoDto): Promise<BaseResponseTypeDTO> {
        const allowedCryptos = this.allowedCurrencies;
        try {
            checkForRequiredFields(['amount', 'currency', 'userId'], payload);
            if (!allowedCryptos.includes(payload.currency.toLowerCase())) {
                throw new HttpException(
                    `Invalid currency. Allowed currencies are: ${allowedCryptos.join(', ')}`,
                    HttpStatus.BAD_REQUEST,
                );
            }
            const userData = await this.userSrv.findUserById(payload.userId);
            // await this.userSrv.verifyTransactionPin(
            //   payload.userId,
            //   payload.transactionPin,
            // );
            //CHECK IF USER IS REQUESTUING FOR MORE THAN VALUE IN WALLET AND HELD
            await this.checkUserWalletBalance(
                { user_id: userData.data.quidax_user_id, currency: payload.currency },
                payload.amount,
            );
            const referenceNumber = generateUniqueCode(13);
            //SEND CRYPTO FROM USER WALLET TO ADMIN WALLET
            console.log(payload.currency, payload.amount.toString());
            const sentwithdrawal = await this.SendCrypto({
                userId: userData.data.quidax_user_id,
                fund_uid: 'me',
                currency: payload.currency,
                amount: payload.amount.toString(),
                transaction_note: 'Stay safe',
                narration: 'We love you.',
                // "network": trc20,
                reference: referenceNumber,
            });
            ////////////////////After after sending crypto to admin(me) wallet so selling can start save order for webhook/////////////
            ////////////////////After after sending crypto to admin(me) wallet so selling can start save order for webhook/////////////
            await this.QuidaxorderSrv.createOrder(
                payload.userId,
                sentwithdrawal.data.id,
                'USER-CRYPTO-TO-NAIRA-SWAP',
            );

            return {
                success: true,
                code: HttpStatus.OK,
                message: 'Sell initiated',
                data: { orderId: sentwithdrawal.data.id },
            };
        } catch (ex) {
            this.logger.error(ex);
            throw ex;
        }
    }

    //////////////////////////////////////////////ADD WEBHOOK FOR RECIVEING CRYPTO AND CONFIRMING TRANSACTIONS////////////////////////////
    //////////////////////////////////////////////ADD WEBHOOK FOR RECIVEING CRYPTO AND CONFIRMING TRANSACTIONS////////////////////////////
    //////////////////////////////////////////////ADD WEBHOOK FOR RECIVEING CRYPTO AND CONFIRMING TRANSACTIONS////////////////////////////
    //////////////////////////////////////////////ADD WEBHOOK FOR RECIVEING CRYPTO AND CONFIRMING TRANSACTIONS////////////////////////////


    async quidaxWebhook(payload: any) {
        const referenceNumber = generateUniqueCode(13);

        switch (payload.event) {
            case 'instant_order.done': {


                const orderForCreditingUserWallet = await this.QuidaxorderSrv.getRepo().findOne({
                    where: {
                        orderId: payload.data.id,
                        reasonForOrder: 'USER-CREDIT-WALLET',
                    }
                });

                if (orderForCreditingUserWallet) {
                    /////////////////CRAETE TRANSACTION ENTRY FOR USER BUYING OF CRYPTO/////////////////////
                    /////////////////CRAETE TRANSACTION ENTRY FOR USER BUYING OF CRYPTO/////////////////////
                    /////////////////CRAETE TRANSACTION ENTRY FOR USER BUYING OF CRYPTO/////////////////////
                    const userToTopUpQuidaxWallet = await this.userSrv.findUserById(
                        orderForCreditingUserWallet.userId,
                    );

                    console.log('ATTACHED-VALUE-TO-SEND-TO-USER', payload.data);
                    console.log(
                        'orderForCreditingUserWallet',
                        orderForCreditingUserWallet,
                    );

                    // Transfer the crypto to the user's wallet after the instant order is done
                    if (payload.data.side === 'buy') {
                        const sendCryptoResponse = await this.SendCrypto({
                            userId: 'me',
                            fund_uid: userToTopUpQuidaxWallet.data.quidax_user_id,
                            currency: payload.data.receive.unit.toLowerCase(),
                            amount: payload.data.receive.amount,
                            transaction_note: 'Stay safe',
                            narration: 'We love you.',
                            reference: referenceNumber,
                        });

                        console.log(sendCryptoResponse);
                    }
                }
                console.log(payload);
                break;
            }

            case 'withdraw.successful': {
                const orderForCreditingUserWallet = await this.QuidaxorderSrv.getRepo().findOne({
                    where: {
                        orderId: payload.data.id,
                        reasonForOrder: 'USER-CRYPTO-TO-NAIRA-SWAP'
                    }
                });

                if (orderForCreditingUserWallet) {
                    /////////////////CRAETE TRANSACTION ENTRY FOR USER SELLING OF CRYPTO/////////////////////
                    /////////////////CRAETE TRANSACTION ENTRY FOR USER SELLING OF CRYPTO/////////////////////
                    /////////////////CRAETE TRANSACTION ENTRY FOR USER SELLING OF CRYPTO/////////////////////
                    const userToCreditNairaWallet = await this.userSrv.findUserById(
                        orderForCreditingUserWallet.userId,
                    );

                    console.log('Order for Credit', orderForCreditingUserWallet);
                    console.log('User to Credit', userToCreditNairaWallet);

                    ////////////////////IF ACCOUNT DETAILS DOESNT EXITS DO THIS BELOW ELSE SEND TO ACCOUNT DETAILS INFO WITH SAFEHAVEN ALSO UPDATE QUIDAX ORDER STATUS///////////////////////
                    ////////////////////IF ACCOUNT DETAILS DOESNT EXITS DO THIS BELOW ELSE SEND TO ACCOUNT DETAILS INFO WITH SAFEHAVEN ALSO UPDATE QUIDAX ORDER STATUS///////////////////////
                    const newTransaction = await this.transactionSrv.createTransaction({
                        userId: userToCreditNairaWallet.data.id,
                        amount: parseFloat(payload.data.amount),
                        // currency: currencyType,
                        reference: referenceNumber,
                        narration: 'Crypto Swap',
                        type: TransactionType.CREDIT,
                        transactionStatus: PaymentStatus.SUCCESSFUL,
                        typeAction: TransactionTypeAction.SELL,
                        transactionDate: new Date().toLocaleString(),
                        currentBalanceBeforeTransaction: 0, // Update with actual balance if available
                        currency: payload.data.currency.toLowerCase(),
                    });

                    console.log(newTransaction);
                    ////////////////////IF ACCOUNT DETAILS DOESNT EXITS DO THIS BELOW ELSE SEND TO ACCOUNT DETAILS INFO WITH SAFEHAVEN ALSO UPDATE QUIDAX ORDER STATUS///////////////////////
                    ////////////////////IF ACCOUNT DETAILS DOESNT EXITS DO THIS BELOW ELSE SEND TO ACCOUNT DETAILS INFO WITH SAFEHAVEN ALSO UPDATE QUIDAX ORDER STATUS///////////////////////
                }
                console.log('FULL WITHDRAWAL PAYLOAD', payload);
                break;
            }

            case 'swap_transaction.completed': {
                const data = payload.data;

                const user = await this.userSrv.getRepo().findOne({ where: { quidax_user_id: data.user.id } });
                if (!user) {
                    console.log('User not found for Quidax ID:', data.user.id);
                    break;
                }

                // Construct swap type
                const swapType = `${data.from_currency}_TO_${data.to_currency}`;

                // Convert received amount to Naira
                const receivedAmountInCrypto = parseFloat(data.received_amount);
                const quotedPriceInNaira = parseFloat(data.swap_quotation.quoted_price);
                const amountInNaira = receivedAmountInCrypto * quotedPriceInNaira;

                const transaction = await this.transactionSrv.createTransaction({
                    userId: user.id,
                    amount: amountInNaira,
                    reference: referenceNumber,
                    narration: `Swap Swapping`,
                    type: TransactionType.CREDIT,
                    transactionStatus: PaymentStatus.SUCCESSFUL,
                    typeAction: TransactionTypeAction.SWAP,
                    transactionDate: new Date(data.created_at).toLocaleString(),
                    currentBalanceBeforeTransaction: 0, // Replace if needed
                    currency: data.to_currency.toLowerCase(),
                });

                console.log('Swap transaction recorded:', transaction);
                break;
            }

            default:
                console.log(`Unhandled event: ${payload.event}`);
                console.log(`Unhandled event: ${payload.data}`);
                break;
        }
    }
}
