import { EventRecord } from '@entities/event.entity';
import { User } from '@entities/index';
import { TransactionRecord } from '@entities/transaction-record.entity';
import { AirtimePurchaseService } from '@modules/airtime-purchase/airtime-purchase.service';
import { AppProfitService } from '@modules/app-profit/app-profit.service';
import { BettingPurchaseService } from '@modules/betting-purchase/betting-purchase.service';
import { BillService } from '@modules/bill/bill.service';
import { CablePurchaseService } from '@modules/cable-purchase/cable-purchase.service';
import { DataPurchaseService } from '@modules/data-purchase/data-purchase.service';
import { ElectricityPurchaseService } from '@modules/electricity-purchase/electricity-purchase.service';
import { EventSpraayService } from '@modules/event-spraay/event-spraay.service';
import {
  EventPaginationDto,
  EventsResponseDTO,
} from '@modules/event/dto/event.dto';
import { EventService } from '@modules/event/event.service';
import { GiftingService } from '@modules/gifting/gifting.service';
import {
  TransPaginationDto,
  TransactionDateRangeDto,
} from '@modules/transaction/dto/transaction.dto';
import { TransactionService } from '@modules/transaction/transaction.service';
import { UserService } from '@modules/user/user.service';
import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import {
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '@schematics/index';
import { DecodedTokenKey } from '@utils/index';
import { PaginationRequestType } from '@utils/utils.types';

@ApiTags('Admin-Dashboard')
@Controller('admin-dashboard')
export class AdminDashboardController {
  constructor(
    private readonly billSrv: BillService,
    private readonly electricityPurchaseSrv: ElectricityPurchaseService,
    private readonly dataPurchaseSrv: DataPurchaseService,
    private readonly airtimePurchaseSrv: AirtimePurchaseService,
    private readonly cablePurchaseSrv: CablePurchaseService,
    private readonly bettingPurchaseSrv: BettingPurchaseService,
    private readonly transactionSrv: TransactionService,
    private readonly eventspraaySrv: EventSpraayService,
    private readonly appProfitSrv: AppProfitService,
    private readonly eventSrv: EventService,
    private readonly giftingSrv: GiftingService,
    private readonly userSrv: UserService,
  ) {}

  @Get('transaction/get-all-transaction')
  @ApiOperation({ summary: 'Get all transactions with pagination' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns all transactions with pagination',
    type: [TransactionRecord],
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal server error',
  })
  async getAllTransactions(
    @Query() paginationDto: TransPaginationDto,
  ): Promise<any> {
    return await this.transactionSrv.getAllTransactions(paginationDto);
  }

  @ApiQuery({ name: 'pageNumber', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiOperation({ description: 'Find events for currently logged in user' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: EventsResponseDTO })
  @Get('events/get-events-created-by-adimin')
  async findEventsForCurrentUser(
    @CurrentUser(DecodedTokenKey.USER_ID) userId: string,
    @Query() pagination?: PaginationRequestType,
  ): Promise<EventsResponseDTO> {
    return await this.eventSrv.findEventsForCurrentUser(userId, pagination);
  }

  @Get('events/get-all-events')
  @ApiOperation({ summary: 'Get all events with pagination' })
  @ApiQuery({ name: 'page', type: 'number', example: 1 })
  @ApiQuery({ name: 'limit', type: 'number', example: 10 })
  @ApiResponse({ status: 200, description: 'Events retrieved successfully' })
  async getAllEvents(
    @Query() paginationDto: EventPaginationDto,
  ): Promise<{ data: EventRecord[]; totalCount: number }> {
    return this.eventSrv.getAllEvents(paginationDto);
  }

  @Get('users/get-all-users')
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Users retrieved successfully',
    type: [User],
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Failed to retrieve users',
  })
  async getAllUsers(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ): Promise<{
    success: boolean;
    message: string;
    error?: string;
    code: number;
    data: { users: User[]; totalCount: number };
  }> {
    try {
      const result = await this.userSrv.getAllUsers(page, limit);
      return result;
    } catch (error) {
      console.error('Error in getAllUsers:', error);
      throw new Error('Failed to retrieve users');
    }
  }

  ////////////////////////////////////////USE DATE RANGE PLEASE////////////////////////////////////
  ////////////////////////////////////////USE DATE RANGE PLEASE////////////////////////////////////
  ////////////////////////////////////////USE DATE RANGE PLEASE////////////////////////////////////
  ////////////////////////////////////////USE DATE RANGE PLEASE////////////////////////////////////
  ////////////////////////////////////////USE DATE RANGE PLEASE////////////////////////////////////
  ////////////////////////////////////////USE DATE RANGE PLEASE////////////////////////////////////
  ////////////////////////////////////////USE DATE RANGE PLEASE////////////////////////////////////
  ////////////////////////////////////////USE DATE RANGE PLEASE////////////////////////////////////
  ////////////////////////////////////////USE DATE RANGE PLEASE////////////////////////////////////
  ////////////////////////////////////////USE DATE RANGE PLEASE////////////////////////////////////
  ////////////////////////////////////////USE DATE RANGE PLEASE////////////////////////////////////
  ////////////////////////////////////////USE DATE RANGE PLEASE////////////////////////////////////

  @Get('/transaction/total-amount')
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Total transaction amount calculated successfully',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Failed to calculate total transaction amount',
  })
  async getTotalTransactionAmount(): Promise<any> {
    return await this.transactionSrv.calculateTotalTransactionAmount();
  }

  @Get('/transaction/aggregate-total')
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Total transaction sum aggregated per day for the past 10 days',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Failed to aggregate total transaction sum per day',
  })
  async aggregateTotalTransactionSumPerDay(): Promise<any> {
    return await this.transactionSrv.aggregateTotalTransactionSumPerDay();
  }

  @Get('app-revenue/get-total-revenue')
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Summed up app profit retrieved successfully',
    type: Number,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Failed to sum up app profit',
  })
  async sumUpAppProfitAndReturn(): Promise<number> {
    const totalAppProfit = await this.appProfitSrv.sumUpAppProfitAndReturn();
    return totalAppProfit;
  }
  @Get('eventspray/aggregate-total-sum-per-day')
  @ApiResponse({
    status: 200,
    description:
      'Successfully aggregated total event spraay sum per day for the past 10 days',
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to aggregate total event spraay sum per day',
  })
  async aggregateTotalEventSpraaySumPerDay(): Promise<any> {
    return this.eventspraaySrv.aggregateTotalEventSpraaySumPerDay();
  }

  @Get('gifting/aggregateTotalGiftingumPerDay')
  @ApiOperation({
    summary: 'Aggregate Total Gifting Sum Per Day for the Past 10 Days',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Success', type: Object })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal Server Error',
  })
  async aggregateTotalGiftingumPerDay(): Promise<any> {
    return this.giftingSrv.aggregateTotalGiftingumPerDay();
  }

  @Get('/bills/aggregate-total-sum-per-day')
  async gettoatlsumedupbillingperday(): Promise<any> {
    const services = [
      this.electricityPurchaseSrv,
      this.dataPurchaseSrv,
      this.airtimePurchaseSrv,
      this.cablePurchaseSrv,
      this.bettingPurchaseSrv,
    ];
    return await this.billSrv.aggregateBillingPerDay(services);
  }
  ////////////////////////////////////////USE DATE RANGE PLEASE////////////////////////////////////
  ////////////////////////////////////////USE DATE RANGE PLEASE////////////////////////////////////
  ////////////////////////////////////////USE DATE RANGE PLEASE////////////////////////////////////
  ////////////////////////////////////////USE DATE RANGE PLEASE////////////////////////////////////
  ////////////////////////////////////////USE DATE RANGE PLEASE////////////////////////////////////
  ////////////////////////////////////////USE DATE RANGE PLEASE////////////////////////////////////
  ////////////////////////////////////////USE DATE RANGE PLEASE////////////////////////////////////
  ////////////////////////////////////////USE DATE RANGE PLEASE////////////////////////////////////
  ////////////////////////////////////////USE DATE RANGE PLEASE////////////////////////////////////
  ////////////////////////////////////////USE DATE RANGE PLEASE////////////////////////////////////
  ////////////////////////////////////////USE DATE RANGE PLEASE////////////////////////////////////
  ////////////////////////////////////////USE DATE RANGE PLEASE////////////////////////////////////

  @Get('transaction/total-per-day')
  async getTotalTransactionsPerDay(
    @Query() dateRangeDto: TransactionDateRangeDto,
  ): Promise<{ date: string; count: number }[]> {
    const transactions = await this.transactionSrv.getTotalTransactionsPerDay(
      dateRangeDto,
    );
    return transactions;
  }

  @Get('transaction/total-sum-per-day')
  async getTotalTransactionSumPerDay(
    @Query() dateRangeDto: TransactionDateRangeDto,
  ): Promise<{ date: string; sum: number }[]> {
    const transactions = await this.transactionSrv.getTotalTransactionSumPerDay(
      dateRangeDto,
    );
    return transactions;
  }

  @Get('app-profit/total-per-day')
  async getTotalAppprofitPerDay(
    @Query() dateRangeDto: TransactionDateRangeDto,
  ): Promise<{ date: string; count: number }[]> {
    const transactions = await this.appProfitSrv.getTotalTransactionsPerDay(
      dateRangeDto,
    );
    return transactions;
  }

  @Get('app-profit/total-sum-per-day')
  async getTotalAppprofitSumPerDay(
    @Query() dateRangeDto: TransactionDateRangeDto,
  ): Promise<{ date: string; sum: number }[]> {
    const transactions = await this.appProfitSrv.getTotalTransactionSumPerDay(
      dateRangeDto,
    );
    return transactions;
  }

  @Get('eventspray/total-amount-and-count')
  async getTotalEventSpraayAmountAndCount(
    @Query() dateRangeDto: TransactionDateRangeDto,
  ): Promise<{
    totalAmount: number;
    totalCount: number;
    totalCountCurrentDay: number;
  }> {
    return this.eventspraaySrv.getTotalEventSpraayAmountAndCount(dateRangeDto);
  }

  @Get('bill/total-amount-for-date-range')
  async getTotalSumPerRepo(
    @Query() dateRange: TransactionDateRangeDto,
  ): Promise<{ repo: string; sum: number }[]> {
    const { startDate, endDate } = dateRange;
    const results = [];

    // Calculate total sum for electricityPurchaseSrv
    const electricitySum = await this.electricityPurchaseSrv
      .getRepo()
      .createQueryBuilder('entity')
      .select('SUM(entity.amount)', 'sum')
      .where('entity.dateCreated BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .getRawOne();

    results.push({
      repo: 'electricity',
      sum: parseFloat(electricitySum.sum) || 0,
    });

    // Calculate total sum for dataPurchaseSrv
    const dataSum = await this.dataPurchaseSrv
      .getRepo()
      .createQueryBuilder('entity')
      .select('SUM(entity.amount)', 'sum')
      .where('entity.dateCreated BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .getRawOne();

    results.push({
      repo: 'data',
      sum: parseFloat(dataSum.sum) || 0,
    });

    // Calculate total sum for airtimePurchaseSrv
    const airtimeSum = await this.airtimePurchaseSrv
      .getRepo()
      .createQueryBuilder('entity')
      .select('SUM(entity.amount)', 'sum')
      .where('entity.dateCreated BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .getRawOne();

    results.push({
      repo: 'airtime',
      sum: parseFloat(airtimeSum.sum) || 0,
    });

    // Calculate total sum for cablePurchaseSrv
    const cableSum = await this.cablePurchaseSrv
      .getRepo()
      .createQueryBuilder('entity')
      .select('SUM(entity.amount)', 'sum')
      .where('entity.dateCreated BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .getRawOne();

    results.push({
      repo: 'cable',
      sum: parseFloat(cableSum.sum) || 0,
    });

    // Calculate total sum for bettingPurchaseSrv
    const bettingSum = await this.bettingPurchaseSrv
      .getRepo()
      .createQueryBuilder('entity')
      .select('SUM(entity.amount)', 'sum')
      .where('entity.dateCreated BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .getRawOne();

    results.push({
      repo: 'betting',
      sum: parseFloat(bettingSum.sum) || 0,
    });

    return results;
  }

  //Custom date , Today Yseterday, last 7 days, last 3 days, this month, last month,
}
