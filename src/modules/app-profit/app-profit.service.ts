import { OnEvent } from '@nestjs/event-emitter';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  BaseResponseTypeDTO,
  checkForRequiredFields,
  validateUUIDField,
} from '@utils/index';
import { GenericService } from '@schematics/index';
import { AppProfit } from '@entities/index';
import {
  AppProfitResponseDTO,
  CreateAppProfitDTO,
  CurrentAppProfitDTO,
} from './dto/app-profit.dto';
import { TransactionDateRangeDto } from '@modules/transaction/dto/transaction.dto';
import { Between } from 'typeorm';

@Injectable()
export class AppProfitService extends GenericService(AppProfit) {
  @OnEvent('app-profit.log', { async: true })
  async createAppProfits(
    payload: CreateAppProfitDTO,
  ): Promise<AppProfitResponseDTO> {
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
        };
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
      await this.getRepo().update(
        { isWithdrawn: false },
        { isWithdrawn: true, payoutUserId: userId },
      );
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
  // async sumUpAppProfitAndReturn(): Promise<any> {
  //     try {
  //       const appProfits = await this.getRepo().find();
  //       let totalProfit = 0;

  //       appProfits.forEach((profit) => {
  //         totalProfit += profit.amount;
  //       });

  //       return {
  //         success: true,
  //         message: 'Total app profit summed up successfully',
  //         code: HttpStatus.OK,
  //         data: { totalProfit },
  //       };
  //     } catch (error) {
  //       return {
  //         success: false,
  //         message: 'Failed to sum up total app profit',
  //         code: HttpStatus.INTERNAL_SERVER_ERROR,
  //         error: error.message,
  //       };
  //     }
  //   }

  async sumUpAppProfitAndReturn(dateRangeDto: TransactionDateRangeDto): Promise<any> {
    try {
      const { startDate, endDate } = dateRangeDto;
  
      const appProfits = await this.getRepo().find({
        where: {
          dateCreated: Between(startDate, endDate),
        },
      });
  
      let totalProfit = 0;
      appProfits.forEach((profit) => {
        totalProfit += profit.amount;
      });
  
      return {
        success: true,
        message: 'Total app profit summed up successfully for the specified date range',
        code: HttpStatus.OK,
        data: { totalProfit },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to sum up total app profit',
        code: HttpStatus.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }

  // async getTotalTransactionsPerDay(dateRange: TransactionDateRangeDto): Promise<{ date: string; count: number }[]> {
  //   const { startDate, endDate } = dateRange;
  //   const results = await this.getRepo()
  //     .createQueryBuilder('AppProfit')
  //     .select('DATE(AppProfit.dateCreated) AS date')
  //     .addSelect('COUNT(*) AS count')
  //     .where('DATE(AppProfit.dateCreated) BETWEEN :startDate AND :endDate', { startDate, endDate })
  //     .groupBy('DATE(AppProfit.dateCreated)')
  //     .getRawMany();

  //   return results.map(({ date, count }) => ({ date, count: parseInt(count) }));
  // }

  // async getTotalTransactionSumPerDay(dateRange: TransactionDateRangeDto): Promise<{ date: string; sum: number }[]> {
  //   const { startDate, endDate } = dateRange;
  //   const results = await this.getRepo()
  //     .createQueryBuilder('AppProfit')
  //     .select('DATE(AppProfit.dateCreated) AS date')
  //     .addSelect('SUM(amount) AS sum')
  //     .where('DATE(AppProfit.dateCreated) BETWEEN :startDate AND :endDate', { startDate, endDate })
  //     .groupBy('DATE(AppProfit.dateCreated)')
  //     .getRawMany();

  //   return results.map(({ date, sum }) => ({ date, sum: parseFloat(sum) }));
  // }

  async getTotalTransactionsPerDay(dateRange: TransactionDateRangeDto): Promise<{ date: string; count: number }[]> {
    const { startDate, endDate } = dateRange;
    const results = await this.getRepo()
      .createQueryBuilder('AppProfit')
      .select("DATE(AppProfit.dateCreated) AS date")
      .addSelect('COUNT(*) AS count')
      .where('DATE(AppProfit.dateCreated) BETWEEN :startDate AND :endDate', { startDate, endDate })
      .groupBy("DATE(AppProfit.dateCreated)")
      .getRawMany();
  
    const currentDate = new Date(startDate);
    const endDateObj = new Date(endDate);
    const aggregatedData = [];
  
    while (currentDate <= endDateObj) {
      const dateKey = currentDate.toISOString().split('T')[0];
      const result = results.find((item) => {
        const itemDate = item.date instanceof Date ? item.date.toISOString().split('T')[0] : item.date;
        return itemDate === dateKey;
      });
  
      aggregatedData.push({ date: dateKey, count: result ? parseInt(result.count) : 0 });
  
      currentDate.setDate(currentDate.getDate() + 1);
    }
  
    return aggregatedData;
  }
  
  async getTotalTransactionSumPerDay(dateRange: TransactionDateRangeDto): Promise<{ date: string; sum: number }[]> {
    const { startDate, endDate } = dateRange;
    const results = await this.getRepo()
      .createQueryBuilder('AppProfit')
      .select("DATE(AppProfit.dateCreated) AS date")
      .addSelect('SUM(amount) AS sum')
      .where('DATE(AppProfit.dateCreated) BETWEEN :startDate AND :endDate', { startDate, endDate })
      .groupBy("DATE(AppProfit.dateCreated)")
      .getRawMany();
  
    const currentDate = new Date(startDate);
    const endDateObj = new Date(endDate);
    const aggregatedData = [];
  
    while (currentDate <= endDateObj) {
      const dateKey = currentDate.toISOString().split('T')[0];
      const result = results.find((item) => {
        const itemDate = item.date instanceof Date ? item.date.toISOString().split('T')[0] : item.date;
        return itemDate === dateKey;
      });
  
      aggregatedData.push({ date: dateKey, sum: result ? parseFloat(result.sum) : 0 });
  
      currentDate.setDate(currentDate.getDate() + 1);
    }
  
    return aggregatedData;
  }
  
}
