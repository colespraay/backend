import {
  BadGatewayException,
  ConflictException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ElectricityPurchase, User } from '@entities/index';
import { GenericService } from '@schematics/index';
import {
  checkForRequiredFields,
  generateUniqueCode,
  sendEmail,
  TransactionType,
} from '@utils/index';
import { WalletService } from '@modules/wallet/wallet.service';
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
    private readonly walletSrv: WalletService,
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
      await this.userSrv.verifyTransactionPin(user.id, payload.transactionPin);
      await this.userSrv.checkAccountBalance(payload.amount, user.id);
      const { availableBalance } = await this.walletSrv.getAccountBalance();
      if (availableBalance < payload.amount) {
        throw new ConflictException('Insufficient balance');
      }
      const narration = `Electricity unit purchase (₦${payload.amount}) for ${payload.meterNumber}`;
      const transactionDate = new Date().toLocaleString();
      const reference = `Spraay-power-${generateUniqueCode(10)}`;
      const electricUnitPurchaseResponse =
        await this.billSrv.makeElectricUnitPurchase(
          {
            amount: payload.amount,
            meterNumber: payload.meterNumber,
            providerId: payload.providerId,
            transactionPin: payload.transactionPin,
            merchantPlan: payload.merchantPlan,
          },
          reference,
        );
      this.logger.log({ electricUnitPurchaseResponse });
      if (!electricUnitPurchaseResponse?.token) {
        throw new BadGatewayException('Request for token failed. Please retry');
      }
      const newTransaction = await this.transactionSrv.createTransaction({
        narration,
        transactionDate,
        userId: user.id,
        amount: payload.amount,
        type: TransactionType.DEBIT,
        currentBalanceBeforeTransaction: user.walletBalance,
        reference: electricUnitPurchaseResponse.data.reference,
      });
      const createdElectricityUnitPurchase = await this.create<
        Partial<ElectricityPurchase>
      >({
        meterNumber: payload.meterNumber,
        providerId: payload.providerId,
        plan: payload.merchantPlan,
        unitToken: electricUnitPurchaseResponse.token,
        flutterwaveReference: electricUnitPurchaseResponse.data.reference,
        transactionId: newTransaction.data.id,
        amount: payload.amount,
        userId: user.id,
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

  // async createElectricityPurchase(
  //   payload: CreateElectricityPurchaseDTO,
  //   user: User,
  // ): Promise<ElectricityPurchaseResponseDTO> {
  //   try {
  //     checkForRequiredFields(
  //       ['provider', 'transactionPin', 'billerName', 'meterNumber', 'amount'],
  //       payload,
  //     );
  //     compareEnumValueFields(
  //       payload.provider,
  //       Object.values(ElectricityProvider),
  //       'provider',
  //     );
  //     if (!payload.plan) {
  //       payload.plan = ElectricityPlan.PRE_PAID;
  //     } else {
  //       compareEnumValueFields(
  //         payload.plan,
  //         Object.values(ElectricityPlan),
  //         'plan',
  //       );
  //     }
  //     await this.userSrv.verifyTransactionPin(user.id, payload.transactionPin);
  //     await this.userSrv.checkAccountBalance(payload.amount, user.id);

  //     const narration = `Electricity unit purchase (₦${payload.amount}) for ${payload.meterNumber}`;
  //     const transactionDate = new Date().toLocaleString();
  //     const reference = `Spraay-power-${generateUniqueCode(10)}`;
  //     // Make purchase from flutterwave
  //     const electricUnitPurchaseResponse =
  //       await this.billSrv.makeElectricUnitPurchase(
  //         {
  //           amount: payload.amount,
  //           meterNumber: payload.meterNumber,
  //           provider: payload.provider,
  //           transactionPin: payload.transactionPin,
  //           plan: payload.plan,
  //           billerName: payload.billerName,
  //         },
  //         reference,
  //       );
  //     this.logger.log({ electricUnitPurchaseResponse });
  //     if (!electricUnitPurchaseResponse?.token) {
  //       throw new BadGatewayException('Request for token failed. Please retry');
  //     }
  //     const newTransaction = await this.transactionSrv.createTransaction({
  //       narration,
  //       transactionDate,
  //       userId: user.id,
  //       amount: payload.amount,
  //       type: TransactionType.DEBIT,
  //       currentBalanceBeforeTransaction: user.walletBalance,
  //       reference: electricUnitPurchaseResponse.data.reference,
  //     });
  //     const createdElectricityUnitPurchase = await this.create<
  //       Partial<ElectricityPurchase>
  //     >({
  //       meterNumber: payload.meterNumber,
  //       provider: payload.provider,
  //       plan: payload.plan,
  //       unitToken: electricUnitPurchaseResponse.token,
  //       flutterwaveReference: electricUnitPurchaseResponse.data.reference,
  //       transactionId: newTransaction.data.id,
  //       amount: payload.amount,
  //       userId: user.id,
  //     });
  //     await this.sendElectricityUnitToUser(
  //       user.id,
  //       electricUnitPurchaseResponse.token,
  //     );
  //     return {
  //       success: true,
  //       code: HttpStatus.CREATED,
  //       data: createdElectricityUnitPurchase,
  //       message: electricUnitPurchaseResponse.message,
  //     };
  //   } catch (ex) {
  //     this.logger.error(ex);
  //     throw ex;
  //   }
  // }

  async verifyElectricityPurchase(
    payload: VerifyElectricityPurchaseDTO,
    user: User,
  ): Promise<ElectricityPurchaseVerificationDTO> {
    try {
      checkForRequiredFields(['providerId', 'meterNumber', 'amount'], payload);
      await this.userSrv.checkAccountBalance(payload.amount, user.id);
      const { availableBalance } = await this.walletSrv.getAccountBalance();
      if (availableBalance < payload.amount) {
        throw new ConflictException('Insufficient balance');
      }
      const meterDetails = await this.billSrv.verifyElectricityMeter(
        payload.meterNumber,
        payload.providerId,
        payload.merchantPlan,
      );
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Customer device verified successfully',
        data: {
          amount: payload.amount,
          billerName: payload.merchantPlan,
          meterNumber: meterDetails.meterNumber,
          name: meterDetails.deviceName,
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
