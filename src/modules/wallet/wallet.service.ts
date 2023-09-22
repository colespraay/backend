import {
  BadGatewayException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  BaseResponseTypeDTO,
  addLeadingZeroes,
  checkForRequiredFields,
  generateUniqueCode,
  httpGet,
  httpPost,
} from '@utils/index';
import { UserService } from '../index';
import {
  BankAccountStatementDTO,
  BankListDTO,
  BankListPartialDTO,
  FindStatementOfAccountDTO,
  FindTransferChargeDTO,
  InterbankTransferChargeDTO,
  MakeWalletDebitTypeDTO,
  TransactionNotificationResponseDTO,
  VerifyAccountExistenceDTO,
  VerifyAccountExistenceResponseDTO,
  VerifyAccountExistenceResponsePartial,
  WebhookResponseDTO,
} from './dto/wallet.dto';

@Injectable()
export class WalletService {
  private logger = new Logger();
  private bankStatementSubKey = String(
    process.env.WEMA_ATLAT_ACCOUNT_STATEMENT_SUB_KEY,
  );
  private walletCreationSubKey = String(
    process.env.WEMA_ATLAT_WALLET_CREATION_SUB_KEY,
  );
  private xApiKey = String(process.env.WEMA_ATLAT_X_API_KEY);

  constructor(private readonly userSrv: UserService) {}

  // URL: https://playground.alat.ng/api-details#api=wallet-creation-api&operation=generate-account-for-partnership
  @OnEvent('create-wallet', { async: true })
  async createWallet(userId: string): Promise<void> {
    try {
      const user = await this.userSrv.findOne({ id: userId });
      if (!user?.id) {
        throw new NotFoundException();
      }
      checkForRequiredFields(
        ['dob', 'email', 'gender', 'firstName', 'lastName', 'phoneNumber'],
        user,
      );
      if (!user.virtualAccountNumber) {
        // initiate wallet creation
        const dob = new Date(user.dob);
        const formatDOB = `${dob.getFullYear()}-${addLeadingZeroes(
          dob.getMonth() + 1,
        )}-${addLeadingZeroes(dob.getDate())}`;
        const url =
          'https://apiplayground.alat.ng/wallet-creation/api/CustomerAccount/GenerateAccountForPatnerships';
        await httpPost(
          url,
          {
            gender: user.gender.toLowerCase(),
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            dob: formatDOB, // dob: '1994-10-17',
            phoneNumber: user.phoneNumber,
          },
          {
            'Ocp-Apim-Subscription-Key': this.walletCreationSubKey,
            'x-api-key': this.xApiKey,
          },
        );

        // Get the records for the accounts every 5 mins
        setTimeout(async () => {
          const url = `https://apiplayground.alat.ng/wallet-creation/api/CustomerAccount/GetPartnershipAccountDetails?phoneNumber=${user.phoneNumber}`;
          const walletData = await httpGet<any>(url, {
            'Ocp-Apim-Subscription-Key': this.walletCreationSubKey,
            'x-api-key': this.xApiKey,
          });
          if (walletData?.data?.accountNumber) {
            // Save account details for user
            await this.userSrv.getRepo().update(
              { id: user.id },
              {
                bankName: 'WEMA BANK',
                virtualAccountNumber: walletData.data.accountNumber,
                virtualAccountName: `${user.firstName} ${user.lastName}`,
              },
            );
          }
        }, 50000);
      }
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  // https://apiplayground.alat.ng/debit-wallet/api/Shared/GetAllBanks
  async getBankLists(): Promise<BankListDTO> {
    try {
      const url =
        'https://apiplayground.alat.ng/debit-wallet/api/Shared/GetAllBanks';
      const data = await httpGet<any>(url, {
        'x-api-key': String(process.env.WEMA_ATLAT_X_API_KEY),
        'Ocp-Apim-Subscription-Key': String(
          process.env.WEMA_ATLAT_WALLET_CREATION_SUB_KEY,
        ),
      });
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'List found',
        data: data.result as BankListPartialDTO[],
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async getListOfInterbankTransferCharges(): Promise<FindTransferChargeDTO> {
    try {
      const url =
        'https://apiplayground.alat.ng/debit-wallet/api/Shared/GetNIPCharges';
      const data = await httpGet<any>(url, {
        'x-api-key': String(process.env.WEMA_ATLAT_X_API_KEY),
        'Ocp-Apim-Subscription-Key': String(
          process.env.WEMA_ATLAT_WALLET_CREATION_SUB_KEY,
        ),
      });
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Inter-bank charges found',
        termsAndConditions: data.result.termsAndConditions,
        termsAndConditionsUrl: data.result.termsAndConditionsUrl,
        data: data.result.chargeFees as InterbankTransferChargeDTO[],
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  // URL: https://playground.alat.ng/api-details#api=wallet-transfer-api&operation=get-api-shared-accountnameenquiry-bankcode-accountnumber
  async verifyAccountExistence(
    sourceAccountNumber: string,
    payload: VerifyAccountExistenceDTO,
  ): Promise<VerifyAccountExistenceResponseDTO> {
    try {
      checkForRequiredFields(
        [
          'sourceAccountNumber',
          'destinationBankCode',
          'destinationAccountNumber',
          'destinationAccountName',
        ],
        { ...payload, sourceAccountNumber },
      );
      try {
        const enquiryUrl = `https://apiplayground.alat.ng/debit-wallet/api/Shared/AccountNameEnquiry/Wallet/${sourceAccountNumber}`;
        const enquiryData = await httpGet(enquiryUrl, {
          access: String(process.env.WEMA_ATLAT_X_API_KEY),
          'Ocp-Apim-Subscription-Key': String(
            process.env.WEMA_ATLAT_WALLET_CREATION_SUB_KEY,
          ),
        });
        if (!enquiryData) {
          throw new BadGatewayException(
            `Could not verify source wallet: '${sourceAccountNumber}'`,
          );
        }
      } catch (ex) {
        this.logger.error(
          `Source account error: ${sourceAccountNumber}: ${ex}`,
        );
        throw ex;
      }

      // Verify destination Account
      const destinationAccountEnquiryUrl = `https://apiplayground.alat.ng/debit-wallet/api/Shared/AccountNameEnquiry/${
        payload.destinationBankCode
      }/${payload.destinationAccountNumber}?channelId=${String(
        process.env.WEMA_ATLAT_X_API_KEY,
      )}`;
      const destinationAccount = await httpGet<any>(
        destinationAccountEnquiryUrl,
        {
          'Cache-Control': 'no-cache',
          'Ocp-Apim-Subscription-Key': String(
            process.env.WEMA_ATLAT_WALLET_CREATION_SUB_KEY,
          ),
        },
      );
      if (!destinationAccount) {
        throw new BadGatewayException('Could not verify destination account');
      }
      const extractedData =
        destinationAccount.result as VerifyAccountExistenceResponsePartial;
      const bank = (await this.getBankLists()).data.find(
        (bank) => bank.bankCode === extractedData.bankCode,
      );
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Accounts verified',
        data: { ...extractedData, bankName: bank?.bankName },
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  // URL: https://playground.alat.ng/api-details#api=wallet-transfer-api&operation=post-api-shared-processclienttransfer
  async makeTransferFromWallet(
    sourceAccountNumber: string,
    payload: MakeWalletDebitTypeDTO,
  ): Promise<BaseResponseTypeDTO> {
    try {
      checkForRequiredFields(
        [
          'amount',
          'sourceAccountNumber',
          'destinationBankCode',
          'destinationBankName',
          'destinationAccountNumber',
          'destinationAccountName',
          'narration',
        ],
        { ...payload, sourceAccountNumber },
      );
      const url =
        'https://apiplayground.alat.ng/debit-wallet/api/Shared/ProcessClientTransfer';
      const apiResponse = await httpPost<any, any>(
        url,
        {
          // securityInfo: 'string',
          amount: payload.amount,
          destinationBankCode: payload.destinationBankCode,
          destinationBankName: payload.destinationBankName,
          destinationAccountNumber: payload.destinationAccountNumber,
          destinationAccountName: payload.destinationAccountName,
          sourceAccountNumber: sourceAccountNumber,
          narration:
            payload.narration ??
            `Debit - Destination: [${payload.destinationBankName}] ${payload.destinationAccountNumber}`,
          transactionReference: `#Spraay-Ref-${generateUniqueCode(8)}`,
          useCustomNarration: true,
        },
        {
          access: String(process.env.WEMA_ATLAT_X_API_KEY),
          'Cache-Control': 'no-cache',
          'Ocp-Apim-Subscription-Key': String(
            process.env.WEMA_ATLAT_WALLET_CREATION_SUB_KEY,
          ),
        },
      );
      /**
       * Sample Response: 
       * {
              "result": {
                  "status": "string",
                  "message": "string",
                  "narration": "string",
                  "transactionReference": "string",
                  "platformTransactionReference": "string",
                  "transactionStan": "string",
                  "orinalTxnTransactionDate": "string"
              },
              "errorMessage": "string",
              "errorMessages": ["string"],
              "hasError": true,
              "timeGenerated": "string"
          }
       */
      if (!apiResponse) {
        throw new BadGatewayException('Debit payment failed');
      }
      return {
        success: true,
        message: apiResponse.result.message,
        code: HttpStatus.OK,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  // URL: (payment APIs) https://playground.alat.ng/api-details#api=pay-with-bank-account-api&operation=initiate-fund-transfer-request

  // URL: https://playground.alat.ng/api-details#api=get-statement-service&operation=getcustomertransactions
  async getStatementOfAccounts(
    accountNumber: string,
    payload: FindStatementOfAccountDTO,
  ): Promise<BankAccountStatementDTO> {
    try {
      checkForRequiredFields(['accountNumber', 'startDate', 'endDate'], {
        ...payload,
        accountNumber,
      });
      console.log({ accountNumber, payload });
      const userRecord = await this.userSrv.findOne({
        virtualAccountNumber: accountNumber,
      });
      if (!userRecord?.id) {
        throw new NotFoundException('User with account not found');
      }

      try {
        const url =
          'https://apiplayground.alat.ng/get-statement-service/api/AccountMaintenance/InitiateGetCustomerStatement';
        const responseData = await httpPost<any, any>(
          url,
          {
            accountNumber,
            dateFrom: new Date(payload.startDate),
            dateTo: new Date(payload.endDate),
          },
          {
            'Ocp-Apim-Subscription-Key': this.bankStatementSubKey,
            'x-api-key': this.xApiKey,
          },
        );
        if (responseData?.referenceId) {
          const bankStatementUrl =
            'https://apiplayground.alat.ng/get-statement-service/api/AccountMaintenance/GetCustomerTransactions';
          return await httpPost<BankAccountStatementDTO, any>(
            bankStatementUrl,
            {
              referenceId: responseData.referenceId,
            },
            {
              'Ocp-Apim-Subscription-Key': this.bankStatementSubKey,
              'x-api-key': this.xApiKey,
            },
          );
        }
      } catch (ex) {
        this.logger.error(ex);
        return {
          message: 'Statement of accounts list',
          status: true,
          data: [],
        };
      }
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  // URL: https://playground.alat.ng/api-wallet-creation
  async webhookHandler(payload: WebhookResponseDTO): Promise<void> {
    try {
      console.log({ body: payload });
      const user = await this.userSrv.getRepo().findOne({
        where: { email: payload.Data.Email?.toUpperCase() },
      });
      if (user?.id) {
        if (
          !user.virtualAccountNumber &&
          user.virtualAccountNumber !== payload.Data.Nuban
        ) {
          user.virtualAccountNumber = payload.Data.Nuban;
          user.virtualAccountName = payload.Data.NubanName;
          user.bankCustomerId = payload.Data.CustomerID;
        }
        await this.userSrv.getRepo().update(
          { id: user.id },
          {
            virtualAccountNumber: user.virtualAccountNumber,
            virtualAccountName: user.virtualAccountName,
            bankCustomerId: user.bankCustomerId,
          },
        );
      }
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  // URL: https://playground.alat.ng/api-transaction-notification
  async transactionNotificationWebhook(
    payload: TransactionNotificationResponseDTO,
  ): Promise<void> {
    try {
      console.log({ body: payload });
      // {
      //   "accountNumber": "{accountNumber}",
      //   "transactionType": "Credit",
      //   "amount": 10000,
      //   "narration": "Custom narration",
      //   "transactionDate": "1990-07-09T08:34:37.504Z"
      // }
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }
}
