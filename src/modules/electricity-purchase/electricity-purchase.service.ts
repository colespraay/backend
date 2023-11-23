import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ElectricityPurchase, User } from '@entities/index';
import { GenericService } from '@schematics/index';
import {
  checkForRequiredFields,
  compareEnumValueFields,
  ElectricityPlan,
  ElectricityProvider,
  generateUniqueCode,
  TransactionType,
} from '@utils/index';
import { TransactionService } from '@modules/transaction/transaction.service';
import { BillService } from '@modules/bill/bill.service';
import { UserService } from '@modules/user/user.service';
import {
  CreateElectricityPurchaseDTO,
  ElectricityPurchaseResponseDTO,
  ElectricityPurchaseVerificationDTO,
  VerifyElectricityPurchaseDTO,
} from './dto/electricity-purchase.dto';

@Injectable()
export class ElectricityPurchaseService extends GenericService(
  ElectricityPurchase,
) {
  constructor(
    private readonly userSrv: UserService,
    private readonly billSrv: BillService,
    private readonly transactionSrv: TransactionService,
  ) {
    super();
  }

  async createElectricityPurchase(
    payload: CreateElectricityPurchaseDTO,
    user: User,
  ): Promise<ElectricityPurchaseResponseDTO> {
    try {
      checkForRequiredFields(
        ['provider', 'transactionPin', 'billerName', 'meterNumber', 'amount'],
        payload,
      );
      compareEnumValueFields(
        payload.provider,
        Object.values(ElectricityProvider),
        'provider',
      );
      if (payload.plan) {
        compareEnumValueFields(
          payload.plan,
          Object.values(ElectricityPlan),
          'plan',
        );
      } else {
        payload.plan = ElectricityPlan.PRE_PAID;
      }
      const isPinValid = await this.userSrv.verifyTransactionPin(
        user.id,
        payload.transactionPin,
      );
      if (!isPinValid?.success) {
        throw new BadRequestException('Invalid transaction pin');
      }
      const enoughBalance =
        await this.userSrv.doesUserHaveEnoughBalanceInWallet(
          user.id,
          payload.amount,
        );
      if (!enoughBalance) {
        throw new ConflictException('Insufficient balance');
      }
      const narration = `Electricity unit purchase (₦${payload.amount}) for ${payload.meterNumber}`;
      const transactionDate = new Date().toLocaleString();
      const reference = `Spraay-power-${generateUniqueCode(10)}`;
      // Make purchase from flutterwave
      const electricUnitPurchaseResponse =
        await this.billSrv.makeElectricUnitPurchase(
          {
            amount: payload.amount,
            meterNumber: payload.meterNumber,
            provider: payload.provider,
            transactionPin: payload.transactionPin,
            plan: payload.plan,
            billerName: payload.billerName,
          },
          reference,
        );
      this.logger.log({ electricUnitPurchaseResponse });
      const newTransaction = await this.transactionSrv.createTransaction({
        narration,
        userId: user.id,
        amount: payload.amount,
        type: TransactionType.DEBIT,
        reference,
        transactionDate,
        currentBalanceBeforeTransaction: user.walletBalance,
      });
      const createdElectricityUnitPurchase = await this.create<
        Partial<ElectricityPurchase>
      >({
        meterNumber: payload.meterNumber,
        provider: payload.provider,
        plan: payload.plan,
        // TODO: after moving to prod, check fields returned from flutterwave and return electricity token
        unitToken: electricUnitPurchaseResponse.data.flw_ref,
        transactionId: newTransaction.data.id,
        amount: payload.amount,
        userId: user.id,
      });
      return {
        success: true,
        code: HttpStatus.CREATED,
        data: createdElectricityUnitPurchase,
        message: electricUnitPurchaseResponse.message,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async verifyElectricityPurchase(
    payload: VerifyElectricityPurchaseDTO,
    user: User,
  ): Promise<ElectricityPurchaseVerificationDTO> {
    try {
      checkForRequiredFields(['provider', 'meterNumber', 'amount'], payload);
      compareEnumValueFields(
        payload.provider,
        Object.values(ElectricityProvider),
        'provider',
      );
      if (payload.plan) {
        compareEnumValueFields(
          payload.plan,
          Object.values(ElectricityPlan),
          'plan',
        );
      } else {
        payload.plan = ElectricityPlan.PRE_PAID;
      }
      const enoughBalance =
        await this.userSrv.doesUserHaveEnoughBalanceInWallet(
          user.id,
          payload.amount,
        );
      if (!enoughBalance) {
        throw new ConflictException('Insufficient balance');
      }
      // Verify meter number from flutterwave
      const verification = await this.billSrv.verifyElectricityPlan(payload);
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Meter number verified',
        data: {
          billerName: String(verification.selectedOne.biller_name),
          amount: payload.amount,
          meterNumber: payload.meterNumber,
          name: verification.data.customer,
        },
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }
}
