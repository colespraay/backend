import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  addLeadingZeroes,
  checkForRequiredFields,
  httpGet,
  httpPost,
} from '@utils/index';
import { UserService } from '../index';
import {
  BankAccountStatementDTO,
  FindStatementOfAccountDTO,
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

  // TODO: Endpoint for downloading statement of accounts
}
