import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  BadGatewayException,
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
  sendEmail,
  TransactionType,
  UserNotificationType,
} from '@utils/index';
import { TransactionService } from '@modules/transaction/transaction.service';
import { BillService } from '@modules/bill/bill.service';
import { UserService } from '@modules/user/user.service';
import { BankService } from '@modules/bank/bank.service';
import { WalletService } from '@modules/wallet/wallet.service';
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
  private flutterwaveBaseBank = String(process.env.FLUTTERWAVE_BASE_BANK);
  private flutterwaveBaseAccountName = String(
    process.env.FLUTTERWAVE_BASE_ACCOUNT_NAME,
  );
  private flutterwaveBaseAccountNumber = String(
    process.env.FLUTTERWAVE_BASE_ACCOUNT_NUMBER,
  );

  constructor(
    private readonly userSrv: UserService,
    private readonly billSrv: BillService,
    private readonly bankSrv: BankService,
    private readonly walletSrv: WalletService,
    private readonly eventEmitterSrv: EventEmitter2,
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
      await this.userSrv.checkAccountBalance(payload.amount, user.id);

      const walletVerified = await this.walletSrv.verifyWalletAccountNumber(
        user.virtualAccountNumber,
      );
      this.logger.log({ walletVerified });

      const bank = await this.bankSrv.findOne({
        bankName: this.flutterwaveBaseBank?.toUpperCase(),
      });
      if (!bank?.id) {
        throw new ConflictException('Could not validate base account');
      }
      const narration = `Electricity unit purchase (₦${payload.amount}) for ${payload.meterNumber}`;
      const walletResponse = await this.walletSrv.makeTransferFromWallet(
        user.virtualAccountNumber,
        {
          narration,
          amount: payload.amount,
          destinationBankCode: bank.bankCode,
          destinationBankName: this.flutterwaveBaseBank,
          destinationAccountName: this.flutterwaveBaseAccountName,
          destinationAccountNumber: this.flutterwaveBaseAccountNumber,
        },
      );
      if (!walletResponse.success) {
        throw new BadGatewayException('Wallet withdrawal failed');
      }
      // const transactionDate = new Date().toLocaleString();
      // const reference = `Spraay-power-${generateUniqueCode(10)}`;
      const transactionDate = String(
        walletResponse.data.orinalTxnTransactionDate,
      );
      const reference = String(walletResponse.data.transactionReference);
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
        unitToken: electricUnitPurchaseResponse.token,
        flutterwaveReference: electricUnitPurchaseResponse.data.tx_ref,
        transactionId: newTransaction.data.id,
        amount: payload.amount,
        userId: user.id,
      });
      this.eventEmitterSrv.emit('user-notification.create', {
        userId: user.id,
        subject: 'Electricity Unit Purchase',
        type: UserNotificationType.USER_SPECIFIC,
        message: `Your electricity unit purchase of ₦${payload.amount} was successful`,
      });
      await this.sendElectricityUnitToUser(
        user.id,
        electricUnitPurchaseResponse.token,
      );
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
      await this.userSrv.checkAccountBalance(payload.amount, user.id);
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

  private async sendElectricityUnitToUser(
    userId: string,
    token: string,
  ): Promise<void> {
    try {
      const user = await this.userSrv.findUserById(userId);
      if (user?.data?.id) {
        const instagramUrl = String(process.env.INSTAGRAM_URL);
        const twitterUrl = String(process.env.TWITTER_URL);
        const facebookUrl = String(process.env.FACEBOOK_URL);
        const html = `
        <section style="background: white; color: black; font-size: 15px; font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif; display: flex; justify-content: center; margin: 0;">
        <div style="padding: 2rem; width: 80%;">
            <section style="text-align: center;">
                <div style="width: fit-content; margin: 20px 0px;display: inline-block;">
                    <img src="https://ik.imagekit.io/un0omayok/Logo%20animaion.png?updatedAt=1701281040423" alt="">
                </div>
            </section>
    
            <section style="width: 100%; height: auto; font-size: 18px; text-align: justify;">
                <p style="font-weight:300">Hi ${user.data.firstName},</p>
                <p style="font-weight:300">
                  Your electricity bill payment has been successfully processed.
                </p>
                <p style="font-weight:300">
                    As promised, here is your electricity token:
                </p>
                <p style="font-weight:300">
                    <b>Token: ${token}</b>
                </p>
                <p style="font-weight:300">
                  Please use this token to recharge your meter and enjoy uninterrupted power supply.
                </p>
                <p style="font-weight:300">
                    Should you have any queries or need further assistance, don't hesitate to reach out to 
                    our support team.
                </p>
                <p style="font-weight:300">
                    Thank you for choosing Spraay App for your electricity bill payment. We strive to 
                    make your life easier and more convenient.
                </p>
            </section>
    
            <section style="text-align: center; height: 8rem; background-color: #5B45FF; border-radius: 10px; margin-top: 2rem; margin-bottom: 2rem;">
              <a href="${instagramUrl}" style="margin-right: 30px;display: inline-block;padding-top:40px;"><img src="https://ik.imagekit.io/un0omayok/mdi_instagram.png?updatedAt=1701281040417" alt=""></a>
              <a href="${twitterUrl}" style="margin-right: 30px;display: inline-block;padding-top:40px;"><img src="https://ik.imagekit.io/un0omayok/simple-icons_x.png?updatedAt=1701281040408" alt=""></a>
              <a href="${facebookUrl}" style="display: inline-block;padding-top:40px;"><img src="https://ik.imagekit.io/un0omayok/ic_baseline-facebook.png?updatedAt=1701281040525" alt=""></a>
            </section>
    
            <section style="padding: 20px; border-bottom: 2px solid #000; text-align: center; font-size: 20px;">
                <p style="font-weight:300">Spraay software limited</p>
            </section>
    
            <section style="text-align: center; font-size: 18px;">
                <p style="font-weight: 400;">Spraay &copy;${new Date().getFullYear()}</p>
                <p style="font-weight: 400;">Click here to <a href="#" style="color: #5B45FF;">Unsubscribe</a></p>
            </section>
        </div>
      </section>
        `;
        await sendEmail(html, 'Successful Electricity Purchase', [
          user.data.email,
        ]);
      }
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }
}
