import {
    BadGatewayException,
    BadRequestException,
    HttpStatus,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import { VirtualNumberOrder, VirtualNumberStatus } from '@entities/index';
import { GenericService } from '@schematics/index';
import {
    checkForRequiredFields,
    generateUniqueCode,
    PaymentStatus,
    TransactionType,
} from '@utils/index';
import { UserService } from '@modules/user/user.service';
import { WalletService } from '@modules/wallet/wallet.service';
import { TransactionService } from '@modules/transaction/transaction.service';
import { BuyVirtualNumberDto, ListOrdersDto } from './dto/virtual-number.dto';
import {
    VIRTUAL_NUMBER_COUNTRIES,
    VirtualNumberCountry,
} from './data/virtual-number-countries.data';
import {
    VIRTUAL_NUMBER_SERVICES,
    VirtualNumberServiceRef,
} from './data/virtual-number-services.data';

/**
 * Maps the plain-text error codes documented by GrizzlySMS to human readable messages.
 */
const PROVIDER_ERROR_MESSAGES: Record<string, string> = {
    BAD_KEY: 'Invalid provider API key',
    NO_BALANCE: 'Provider balance too low, please contact support',
    NO_NUMBERS: 'No numbers currently available for this service/country, please try again or pick another country',
    SERVICE_UNAVAILABLE_REGION: 'This service is temporarily restricted in our region',
    ERROR_SQL: 'Provider server error, please try again',
    NO_ACTIVATION: 'This order no longer exists on the provider side',
    BAD_SERVICE: 'Invalid service selected',
    BAD_STATUS: 'Invalid status transition requested',
    BAD_ACTION: 'Invalid provider action',
    NO_KEY: 'Invalid provider API key',
};

/** setStatus() action codes, per GrizzlySMS docs */
enum ProviderSetStatus {
    CANCEL = -1,
    SMS_SENT = 1,
    WAIT_NEXT_CODE = 3,
    COMPLETE = 6,
    CANCEL_ALT = 8,
}

@Injectable()
export class VirtualNumberService extends GenericService(VirtualNumberOrder) {
    private readonly providerBaseUrl =
        process.env.GRIZZLYSMS_BASE_URL || 'https://api.grizzlysms.com/stubs/handler_api.php';
    private readonly providerApiKey = process.env.GRIZZLYSMS_API_KEY;

    /** Fixed USD markup added on top of the provider's raw cost, per requirements. */
    private readonly markupUsd = Number(process.env.VIRTUAL_NUMBER_MARKUP_USD || 1);

    /** How long a purchased number waits for an SMS before it is auto-cancelled and refunded. */
    private readonly orderExpiryMinutes = Number(
        process.env.VIRTUAL_NUMBER_ORDER_EXPIRY_MINUTES || 20,
    );

    /**
     * In-memory FX rate cache so we don't hit the exchange-rate API on every single price check.
     * Becomes stale after `fxCacheTtlMs` and is refetched lazily on the next read.
     */
    private static fxCache: { rate: number; fetchedAt: number } | null = null;
    private readonly fxCacheTtlMs =
        Number(process.env.VIRTUAL_NUMBER_FX_CACHE_TTL_MINUTES || 360) * 60 * 1000; // default 6 hours

    constructor(
        private readonly userSrv: UserService,
        private readonly walletSrv: WalletService,
        private readonly transactionSrv: TransactionService,
    ) {
        super();
    }

    // ---------------------------------------------------------------------
    // Low level provider client
    // ---------------------------------------------------------------------

    private async callProvider(params: Record<string, string | number | undefined>): Promise<any> {
        if (!this.providerApiKey) {
            throw new Error('GRIZZLYSMS_API_KEY not found in configuration');
        }

        const query: Record<string, string> = { api_key: this.providerApiKey };
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                query[key] = String(value);
            }
        });

        try {
            const response = await axios.get(this.providerBaseUrl, { params: query });
            return response.data;
        } catch (error: any) {
            console.error('Error calling GrizzlySMS:', error.response?.data || error.message);
            throw new BadGatewayException('Failed to reach virtual number provider');
        }
    }

    private mapProviderError(raw: string): string {
        const code = (raw || '').split(':')[0].trim();
        return PROVIDER_ERROR_MESSAGES[code] || raw || 'Unknown provider error';
    }

    // ---------------------------------------------------------------------
    // Provider actions
    // ---------------------------------------------------------------------

    async getProviderBalance(): Promise<{ success: boolean; code: number; data: number; message: string }> {
        const raw = await this.callProvider({ action: 'getBalance' });
        if (typeof raw === 'string' && raw.startsWith('ACCESS_BALANCE:')) {
            return {
                success: true,
                code: HttpStatus.OK,
                data: Number(raw.split(':')[1]),
                message: 'Provider balance fetched successfully',
            };
        }
        throw new BadGatewayException(this.mapProviderError(raw));
    }

    private async fetchRawPrices(service: string, country?: string): Promise<any> {
        return this.callProvider({ action: 'getPrices', service, country });
    }

    private async requestNumber(
        service: string,
        country: string | undefined,
        maxPrice?: number,
    ): Promise<{ activationId: string; phoneNumber: string }> {
        const raw = await this.callProvider({
            action: 'getNumber',
            service,
            country: country || 'any',
            maxPrice,
        });
        if (typeof raw === 'string' && raw.startsWith('ACCESS_NUMBER:')) {
            const [, activationId, phoneNumber] = raw.split(':');
            return { activationId, phoneNumber };
        }
        throw new BadGatewayException(this.mapProviderError(raw));
    }

    private async setStatus(activationId: string, status: ProviderSetStatus): Promise<string> {
        const raw = await this.callProvider({ action: 'setStatus', status, id: activationId });
        return typeof raw === 'string' ? raw : String(raw);
    }

    private async getStatus(activationId: string): Promise<string> {
        const raw = await this.callProvider({ action: 'getStatus', id: activationId });
        return typeof raw === 'string' ? raw : String(raw);
    }

    async getActiveActivationsFromProvider(): Promise<any[]> {
        const raw = await this.callProvider({ action: 'getActiveActivations' });
        return Array.isArray(raw) ? raw : [];
    }

    // ---------------------------------------------------------------------
    // Static reference data (services / countries) — no provider call needed
    // ---------------------------------------------------------------------

    getCountries(): { success: boolean; code: number; data: VirtualNumberCountry[]; message: string } {
        return {
            success: true,
            code: HttpStatus.OK,
            data: VIRTUAL_NUMBER_COUNTRIES,
            message: 'Countries fetched successfully',
        };
    }

    searchCountries(wildcard: string) {
        const term = (wildcard || '').toLowerCase();
        const data = VIRTUAL_NUMBER_COUNTRIES.filter((c) => c.name.toLowerCase().includes(term));
        return { success: true, code: HttpStatus.OK, data, message: 'Countries filtered successfully' };
    }

    getServices(): { success: boolean; code: number; data: VirtualNumberServiceRef[]; message: string } {
        return {
            success: true,
            code: HttpStatus.OK,
            data: VIRTUAL_NUMBER_SERVICES,
            message: 'Services fetched successfully',
        };
    }

    searchServices(wildcard: string) {
        const term = (wildcard || '').toLowerCase();
        const data = VIRTUAL_NUMBER_SERVICES.filter((s) => s.name.toLowerCase().includes(term));
        return { success: true, code: HttpStatus.OK, data, message: 'Services filtered successfully' };
    }

    private findService(code: string): VirtualNumberServiceRef {
        const service = VIRTUAL_NUMBER_SERVICES.find((s) => s.code === code);
        if (!service) throw new BadRequestException('Unknown service code');
        return service;
    }

    private findCountry(code: string): VirtualNumberCountry | undefined {
        return VIRTUAL_NUMBER_COUNTRIES.find((c) => c.code === code);
    }

    // ---------------------------------------------------------------------
    // FX conversion (cached) + markup
    // ---------------------------------------------------------------------

    /**
     * Returns the USD -> NGN rate, cached in memory and refreshed only after
     * `fxCacheTtlMs` has elapsed, so we don't hit the exchange rate API on every request.
     */
    private async getCachedUsdToNgnRate(): Promise<number> {
        const cache = VirtualNumberService.fxCache;
        const isStale = !cache || Date.now() - cache.fetchedAt > this.fxCacheTtlMs;

        if (!isStale) {
            return cache.rate;
        }

        try {
            const { data } = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
            const rate = Number(data.rates.NGN);
            VirtualNumberService.fxCache = { rate, fetchedAt: Date.now() };
            return rate;
        } catch (error: any) {
            console.error('Error fetching USD->NGN rate:', error.message);
            // Fall back to the last known-good cached rate rather than failing the whole request.
            if (cache) return cache.rate;
            throw new BadGatewayException('Failed to fetch exchange rate');
        }
    }

    /**
     * Picks the cheapest available (cost, count) entry for a service from the raw
     * GrizzlySMS getPrices response. If `country` is provided, only that country
     * is considered; otherwise the cheapest in-stock country is picked automatically,
     * mirroring the provider's own "any" country behaviour on getNumber.
     */
    private extractPriceEntry(
        raw: any,
        service: string,
        country?: string,
    ): { countryCode: string; costUsd: number; count: number } {
        if (raw?.cost !== undefined && raw?.count !== undefined) {
            return { countryCode: country || 'any', costUsd: Number(raw.cost), count: Number(raw.count) };
        }

        const countryKeys = country ? [country] : Object.keys(raw || {});
        let best: { countryCode: string; costUsd: number; count: number } | null = null;

        for (const cKey of countryKeys) {
            const serviceEntry = raw?.[cKey]?.[service];
            if (!serviceEntry || Number(serviceEntry.count) <= 0) continue;
            const costUsd = Number(serviceEntry.cost);
            if (!best || costUsd < best.costUsd) {
                best = { countryCode: cKey, costUsd, count: Number(serviceEntry.count) };
            }
        }

        if (!best) {
            throw new BadGatewayException(this.mapProviderError('NO_NUMBERS'));
        }
        return best;
    }

    /**
     * Full price quote for the "Buy Virtual Number" screen: raw provider cost,
     * our fixed $1 markup, the cached FX rate, and the final NGN amount the user pays.
     */
    async getPrice(service: string, country?: string) {
        const serviceRef = this.findService(service);
        const raw = await this.fetchRawPrices(service, country);
        const entry = this.extractPriceEntry(raw, service, country);
        const countryRef = this.findCountry(entry.countryCode);

        const totalUsd = Number((entry.costUsd + this.markupUsd).toFixed(2));
        const rate = await this.getCachedUsdToNgnRate();
        const amountNgn = Number((totalUsd * rate).toFixed(2));

        return {
            success: true,
            code: HttpStatus.OK,
            data: {
                service: serviceRef,
                country: countryRef || { code: entry.countryCode, name: entry.countryCode },
                providerCostUsd: entry.costUsd,
                markupUsd: this.markupUsd,
                totalUsd,
                fxRate: rate,
                amountNgn,
                available: entry.count,
            },
            message: 'Price fetched successfully',
        };
    }

    // ---------------------------------------------------------------------
    // Purchase flow (Buy Virtual Number screen)
    // ---------------------------------------------------------------------

    async purchaseNumber(payload: BuyVirtualNumberDto): Promise<any> {
        checkForRequiredFields(['service', 'transactionPin', 'userid'], payload);

        const serviceRef = this.findService(payload.service);

        await this.userSrv.verifyTransactionPin(payload.userid, payload.transactionPin);

        // 1. Quote price (provider cost + $1 markup, converted via cached FX rate)
        const quote = await this.getPrice(payload.service, payload.country);
        const { providerCostUsd, totalUsd, fxRate, amountNgn } = quote.data;
        const resolvedCountryCode: string = quote.data.country.code;
        const resolvedCountryName: string = quote.data.country.name;

        // 2. Ensure the user can afford it
        await this.userSrv.checkAccountBalance(amountNgn, payload.userid);

        // 3. Buy the actual number from the provider
        const { activationId, phoneNumber } = await this.requestNumber(
            payload.service,
            resolvedCountryCode,
            payload.maxPrice,
        );

        const userToUse = await this.userSrv.getRepo().findOne({ where: { id: payload.userid } });
        const reference = `Spraay-VirtualNumber-${generateUniqueCode(10)}`;
        const narration = `Virtual number purchase (₦${amountNgn}) for ${serviceRef.name}`;

        let newTransaction;
        try {
            newTransaction = await this.transactionSrv.createTransaction({
                narration,
                userId: userToUse.id,
                amount: amountNgn,
                type: TransactionType.DEBIT,
                transactionStatus: PaymentStatus.SUCCESSFUL,
                reference,
                transactionDate: new Date().toLocaleString(),
                currentBalanceBeforeTransaction: userToUse.walletBalance,
            });
        } catch (ex) {
            // We already have a live number from the provider but failed to debit — cancel it
            // on the provider side so we aren't left holding an activation nobody paid for.
            await this.setStatus(activationId, ProviderSetStatus.CANCEL).catch(() => undefined);
            throw ex;
        }

        const expiresAt = new Date(Date.now() + this.orderExpiryMinutes * 60 * 1000);

        const newOrder = await this.getRepo().create({
            userId: payload.userid,
            activationId,
            phoneNumber,
            serviceCode: serviceRef.code,
            serviceName: serviceRef.name,
            countryCode: resolvedCountryCode,
            countryName: resolvedCountryName,
            providerCostUsd,
            markupUsd: this.markupUsd,
            totalUsd,
            fxRateUsed: fxRate,
            amountNgn,
            orderStatus: VirtualNumberStatus.WAITING_SMS,
            transactionId: newTransaction.data.id,
            expiresAt,
            createdDate: new Date(),
            createdTime: new Date(),
        });

        await this.getRepo().save(newOrder);

        return {
            success: true,
            code: HttpStatus.CREATED,
            data: newOrder,
            message: 'Virtual number purchased successfully',
        };
    }

    // ---------------------------------------------------------------------
    // Dashboard (Virtual Numbers home screen)
    // ---------------------------------------------------------------------

    async getDashboard(userid: string, recentLimit = 5) {
        const userToUse = await this.userSrv.getRepo().findOne({ where: { id: userid } });
        if (!userToUse) throw new NotFoundException('User not found');

        const repo = this.getRepo();
        const [total, completed, cancelled, recentOrders] = await Promise.all([
            repo.count({ where: { userId: userid } }),
            repo.count({ where: { userId: userid, orderStatus: VirtualNumberStatus.COMPLETED } }),
            repo.count({
                where: [
                    { userId: userid, orderStatus: VirtualNumberStatus.CANCELLED },
                    { userId: userid, orderStatus: VirtualNumberStatus.TIMEOUT },
                    { userId: userid, orderStatus: VirtualNumberStatus.FAILED },
                ],
            }),
            repo.find({
                where: { userId: userid },
                order: { createdTime: 'DESC' },
                take: recentLimit,
            }),
        ]);

        return {
            success: true,
            code: HttpStatus.OK,
            data: {
                walletBalance: userToUse.walletBalance,
                totalVerifications: total,
                completedVerifications: completed,
                cancelledVerifications: cancelled,
                recentOrders: recentOrders.map((o) => this.toOrderSummary(o)),
            },
            message: 'Dashboard fetched successfully',
        };
    }

    private toOrderSummary(order: VirtualNumberOrder) {
        const secondsLeft =
            order.orderStatus === VirtualNumberStatus.WAITING_SMS
                ? Math.max(0, Math.floor((new Date(order.expiresAt).getTime() - Date.now()) / 1000))
                : undefined;

        return {
            id: order.id,
            serviceCode: order.serviceCode,
            serviceName: order.serviceName,
            countryCode: order.countryCode,
            countryName: order.countryName,
            phoneNumber: order.phoneNumber,
            smsCode: order.smsCode,
            amountNgn: order.amountNgn,
            status: order.orderStatus,
            secondsLeft,
            createdTime: order.createdTime,
        };
    }

    // ---------------------------------------------------------------------
    // Order listing / detail (Recent Orders + Verification history screens)
    // ---------------------------------------------------------------------

    async listOrders(userid: string, query: ListOrdersDto) {
        const page = query.page && query.page > 0 ? query.page : 1;
        const limit = query.limit && query.limit > 0 ? query.limit : 20;

        const where: any = { userId: userid };
        if (query.status) where.orderStatus = query.status;

        const [orders, count] = await this.getRepo().findAndCount({
            where,
            order: { createdTime: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });

        return {
            success: true,
            code: HttpStatus.OK,
            data: {
                orders: orders.map((o) => this.toOrderSummary(o)),
                page,
                limit,
                total: count,
            },
            message: 'Orders fetched successfully',
        };
    }

    private async getOwnedOrder(orderId: string, userid: string): Promise<VirtualNumberOrder> {
        const order = await this.getRepo().findOne({ where: { id: orderId, userId: userid } });
        if (!order) throw new NotFoundException('Virtual number order not found');
        return order;
    }

    async getOrderDetail(orderId: string, userid: string) {
        let order = await this.getOwnedOrder(orderId, userid);
        order = await this.refreshOrderFromProvider(order);
        return { success: true, code: HttpStatus.OK, data: order, message: 'Order fetched successfully' };
    }

    // ---------------------------------------------------------------------
    // Cancel / resend
    // ---------------------------------------------------------------------

    async cancelOrder(orderId: string, userid: string) {
        const order = await this.getOwnedOrder(orderId, userid);

        if (![VirtualNumberStatus.WAITING_SMS, VirtualNumberStatus.RECEIVED, VirtualNumberStatus.PENDING].includes(order.orderStatus)) {
            throw new BadRequestException('This order can no longer be cancelled');
        }

        await this.setStatus(order.activationId, ProviderSetStatus.CANCEL).catch((err) => {
            console.error('Provider cancel failed, proceeding with local cancel/refund:', err.message);
        });

        order.orderStatus = VirtualNumberStatus.CANCELLED;
        await this.refundIfNeeded(order);
        await this.getRepo().save(order);

        return { success: true, code: HttpStatus.OK, data: order, message: 'Order cancelled successfully' };
    }

    async resendCode(orderId: string, userid: string) {
        const order = await this.getOwnedOrder(orderId, userid);
        if (order.orderStatus !== VirtualNumberStatus.WAITING_SMS) {
            throw new BadRequestException('Can only request another code while waiting for SMS');
        }

        await this.setStatus(order.activationId, ProviderSetStatus.WAIT_NEXT_CODE);
        order.smsCode = null;
        order.smsText = null;
        await this.getRepo().save(order);

        return { success: true, code: HttpStatus.OK, data: order, message: 'Requested another code on the same number' };
    }

    private async refundIfNeeded(order: VirtualNumberOrder): Promise<void> {
        if (order.refunded) return;

        const userToUse = await this.userSrv.getRepo().findOne({ where: { id: order.userId } });
        if (!userToUse) return;

        const reference = `Spraay-VirtualNumber-Refund-${generateUniqueCode(10)}`;
        const refundTransaction = await this.transactionSrv.createTransaction({
            narration: `Refund for virtual number order (${order.serviceName}, ${order.phoneNumber})`,
            userId: userToUse.id,
            amount: order.amountNgn,
            type: TransactionType.CREDIT,
            transactionStatus: PaymentStatus.SUCCESSFUL,
            reference,
            transactionDate: new Date().toLocaleString(),
            currentBalanceBeforeTransaction: userToUse.walletBalance,
        });

        order.refunded = true;
        order.refundTransactionId = refundTransaction.data.id;
    }

    // ---------------------------------------------------------------------
    // Status refresh — shared by manual "refresh" calls and the cron job
    // ---------------------------------------------------------------------

    async refreshOrderFromProvider(order: VirtualNumberOrder): Promise<VirtualNumberOrder> {
        if (![VirtualNumberStatus.WAITING_SMS, VirtualNumberStatus.RECEIVED].includes(order.orderStatus)) {
            return order;
        }

        if (new Date(order.expiresAt).getTime() < Date.now()) {
            return this.timeoutOrder(order);
        }

        let raw: string;
        try {
            raw = await this.getStatus(order.activationId);
        } catch (error) {
            console.error(`Failed to poll status for order ${order.id}:`, error);
            return order;
        }

        if (raw.startsWith('STATUS_OK:')) {
            const code = raw.substring('STATUS_OK:'.length);
            order.smsCode = code;
            order.smsText = raw;
            order.orderStatus = VirtualNumberStatus.RECEIVED;
            await this.getRepo().save(order);

            // Tell the provider the activation is done so it isn't left dangling on their side.
            await this.setStatus(order.activationId, ProviderSetStatus.COMPLETE).catch((err) =>
                console.error(`Failed to finalize activation ${order.activationId} with provider:`, err.message),
            );
            order.orderStatus = VirtualNumberStatus.COMPLETED;
            await this.getRepo().save(order);
            return order;
        }

        if (raw.startsWith('STATUS_WAIT_RETRY')) {
            const lastCode = raw.split(':')[1];
            order.smsText = `Waiting for correct code, last attempt: ${lastCode}`;
            await this.getRepo().save(order);
            return order;
        }

        if (raw === 'STATUS_CANCEL') {
            order.orderStatus = VirtualNumberStatus.CANCELLED;
            await this.refundIfNeeded(order);
            await this.getRepo().save(order);
            return order;
        }

        // STATUS_WAIT_CODE / STATUS_WAIT_RESEND / unrecognised responses — nothing to update yet.
        return order;
    }

    private async timeoutOrder(order: VirtualNumberOrder): Promise<VirtualNumberOrder> {
        await this.setStatus(order.activationId, ProviderSetStatus.CANCEL).catch((err) =>
            console.error(`Failed to cancel expired activation ${order.activationId} with provider:`, err.message),
        );
        order.orderStatus = VirtualNumberStatus.TIMEOUT;
        await this.refundIfNeeded(order);
        await this.getRepo().save(order);
        return order;
    }

    // ---------------------------------------------------------------------
    // Cron: poll every active order for a received SMS code
    // ---------------------------------------------------------------------

    /**
     * Runs every 15 seconds and checks every order that is still waiting for an
     * SMS. Anything that has received a code gets marked COMPLETED; anything
     * that has expired without a code gets auto-cancelled and refunded.
     *
     * NOTE: requires ScheduleModule.forRoot() to be registered once, application-wide
     * (usually in AppModule). If it's already registered there, nothing further is needed.
     */
    @Cron(CronExpression.EVERY_10_SECONDS, { name: 'poll-virtual-number-orders' })
    async handleActiveOrdersCron(): Promise<void> {
        const activeOrders = await this.getRepo().find({
            where: [
                { orderStatus: VirtualNumberStatus.WAITING_SMS },
                { orderStatus: VirtualNumberStatus.RECEIVED },
            ],
        });

        for (const order of activeOrders) {
            try {
                await this.refreshOrderFromProvider(order);
            } catch (error) {
                console.error(`Cron: failed to refresh order ${order.id}:`, error);
            }
        }
    }
}