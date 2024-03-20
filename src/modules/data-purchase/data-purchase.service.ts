import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AxiosError } from 'axios';
import { BillService } from '@modules/bill/bill.service';
import { DataPurchase, User } from '@entities/index';
import { TransactionService } from '@modules/transaction/transaction.service';
import {
  TransactionType,
  checkForRequiredFields,
  formatPhoneNumberWithPrefix,
  generateUniqueCode,
} from '@utils/index';
import { GenericService } from '@schematics/index';
import {
  CreateDataPurchaseDTO,
  DataPurchaseResponseDTO,
} from './dto/data-purchase.dto';
import { UserService } from '../index';

@Injectable()
export class DataPurchaseService extends GenericService(DataPurchase) {
  constructor(
    private readonly userSrv: UserService,
    private readonly billSrv: BillService,
    private readonly transactionSrv: TransactionService,
    private readonly eventEmitterSrv: EventEmitter2,
  ) {
    super();
  }

  async createDataPurchase(
    payload: CreateDataPurchaseDTO,
    user: User,
  ): Promise<DataPurchaseResponseDTO> {
    try {
      checkForRequiredFields(
        ['providerId', 'transactionPin', 'phoneNumber', 'dataPlanId'],
        {
          ...payload,
          userId: user.id,
        },
      );
      payload.phoneNumber = formatPhoneNumberWithPrefix(payload.phoneNumber);
      const isPinValid = await this.userSrv.verifyTransactionPin(
        user.id,
        payload.transactionPin,
      );
      if (!isPinValid?.success) {
        throw new BadRequestException('Invalid transaction pin');
      }
      const plan = await this.billSrv.findDataPlanById(
        payload.providerId,
        payload.dataPlanId,
      );
      await this.userSrv.checkAccountBalance(plan.servicePrice, user.id);
      const reference = `Spraay-data-${generateUniqueCode(10)}`;

      const dataPurchaseResponse = await this.billSrv.makeDataPurchase(
        {
          amount: plan.servicePrice,
          phoneNumber: payload.phoneNumber,
          operatorServiceId: String(plan.serviceId),
          transactionPin: payload.transactionPin,
          type: '',
        },
        reference,
      );
      this.logger.log({ dataPurchaseResponse });

      const amount = plan.servicePrice;
      const transactionDate = new Date().toLocaleString();
      const narration = `Data purchase (₦${amount}) for ${payload.phoneNumber}`;
      const newTransaction = await this.transactionSrv.createTransaction({
        narration,
        userId: user.id,
        amount,
        type: TransactionType.DEBIT,
        reference,
        transactionDate,
        currentBalanceBeforeTransaction: user.walletBalance,
      });
      const createdDataPurchase = await this.create<Partial<DataPurchase>>({
        amount,
        ...payload,
        transactionId: newTransaction.data.id,
        userId: user.id,
      });
      return {
        success: true,
        code: HttpStatus.CREATED,
        data: createdDataPurchase,
        message: dataPurchaseResponse.message,
      };
    } catch (ex) {
      if (ex instanceof AxiosError) {
        const errorObject = ex.response.data;
        const message =
          typeof errorObject === 'string'
            ? errorObject
            : errorObject.statusMessage;
        this.logger.error(message);
        throw new HttpException(
          message,
          Number(errorObject.statusCode) ?? HttpStatus.BAD_GATEWAY,
        );
      } else {
        this.logger.error(ex);
        throw ex;
      }
    }
  }

  // async createDataPurchase(
  //   payload: CreateDataPurchaseDTO,
  //   user: User,
  // ): Promise<DataPurchaseResponseDTO> {
  //   try {
  //     checkForRequiredFields(
  //       ['provider', 'transactionPin', 'phoneNumber', 'dataPlanId'],
  //       {
  //         ...payload,
  //         userId: user.id,
  //       },
  //     );
  //     compareEnumValueFields(
  //       payload.provider,
  //       Object.values(AirtimeProvider),
  //       'provider',
  //     );
  //     payload.phoneNumber = formatPhoneNumberWithPrefix(payload.phoneNumber);
  //     const isPinValid = await this.userSrv.verifyTransactionPin(
  //       user.id,
  //       payload.transactionPin,
  //     );
  //     if (!isPinValid?.success) {
  //       throw new BadRequestException('Invalid transaction pin');
  //     }
  //     const plan = await this.billSrv.findDataPlanById(payload.dataPlanId);
  //     await this.userSrv.checkAccountBalance(plan.amount, user.id);

  //     // Make purchase from flutterwave
  //     const narration = `Data purchase (₦${plan.amount}) for ${payload.phoneNumber}`;
  //     const transactionDate = new Date().toLocaleString();
  //     const reference = `Spraay-data-${generateUniqueCode(10)}`;
  //     const dataPurchaseResponse = await this.billSrv.makeDataPurchase(
  //       {
  //         amount: plan.amount,
  //         phoneNumber: payload.phoneNumber,
  //         provider: payload.provider,
  //         transactionPin: payload.transactionPin,
  //         type: plan.biller_name,
  //       },
  //       reference,
  //     );
  //     this.logger.log({ dataPurchaseResponse });
  //     const newTransaction = await this.transactionSrv.createTransaction({
  //       narration,
  //       userId: user.id,
  //       amount: plan.amount,
  //       type: TransactionType.DEBIT,
  //       reference,
  //       transactionDate,
  //       currentBalanceBeforeTransaction: user.walletBalance,
  //     });
  //     const createdDataPurchase = await this.create<Partial<DataPurchase>>({
  //       ...payload,
  //       transactionId: newTransaction.data.id,
  //       amount: plan.amount,
  //       userId: user.id,
  //     });
  //     return {
  //       success: true,
  //       code: HttpStatus.CREATED,
  //       data: createdDataPurchase,
  //       message: dataPurchaseResponse.message,
  //     };
  //   } catch (ex) {
  //     if (ex instanceof AxiosError) {
  //       const errorObject = ex.response.data;
  //       const message =
  //         typeof errorObject === 'string' ? errorObject : errorObject.message;
  //       this.logger.error(message);
  //       throw new HttpException(message, ex.response.status);
  //     } else {
  //       this.logger.error(ex);
  //       throw ex;
  //     }
  //   }
  // }
}
