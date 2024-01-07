import { OnEvent } from '@nestjs/event-emitter';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
    BaseResponseTypeDTO,
    checkForRequiredFields,
    validateUUIDField
} from '@utils/index';
import { GenericService } from '@schematics/index';
import { AppProfit } from '@entities/index';
import {
    AppProfitResponseDTO,
    CreateAppProfitDTO,
    CurrentAppProfitDTO
} from './dto/app-profit.dto';

@Injectable()
export class AppProfitService extends GenericService(AppProfit) {
    @OnEvent('app-profit.log', { async: true })
    async createAppProfits(payload: CreateAppProfitDTO): Promise<AppProfitResponseDTO> {
        try {
            checkForRequiredFields(['amount', 'transactionId'], payload);
            validateUUIDField(payload.transactionId, 'transactionId');
            const transaction = await this.getRepo().findOne({
                where: { transactionId: payload.transactionId },
                select: ['id'],
            });
            if (!transaction?.id) {
                const createdRecord = await this.create<Partial<AppProfit>>(payload);
                return {
                    success: true,
                    code: HttpStatus.CREATED,
                    message: 'Created',
                    data: createdRecord,
                }
            }
        } catch (ex) {
            this.logger.error(ex);
            throw ex;
        }
    }

    // Clear payout
    async clearPayouts(userId: string): Promise<BaseResponseTypeDTO> {
        try {
            checkForRequiredFields(['userId'], { userId });
            validateUUIDField(userId, 'userId');
            await this.getRepo().update({ isWithdrawn: false }, { isWithdrawn: true, payoutUserId: userId });
            return {
                success: true,
                code: HttpStatus.OK,
                message: 'Payouts cleared successfully',
            };
        } catch (ex) {
            this.logger.error(ex);
            throw ex;
        }
    }

    // Helps admin see how much profit Spraay has in profits
    async getCurrentAppProfitsAvailableForWithdrawal(): Promise<CurrentAppProfitDTO> {
        try {
            const records = await this.getRepo().find({
                where: { isWithdrawn: false },
                select: ['amount'],
            });
            const total = records.reduce((a, b) => a + b.amount, 0);
            return {
                success: true,
                code: HttpStatus.OK,
                message: 'Total found',
                total,
            };
        } catch (ex) {
            this.logger.error(ex);
            throw ex;
        }
    }
}
