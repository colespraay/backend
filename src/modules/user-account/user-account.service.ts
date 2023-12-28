import {
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { FindManyOptions, ILike } from 'typeorm';
import { UserAccount } from '@entities/index';
import { GenericService } from '@schematics/index';
import {
  calculatePaginationControls,
  checkForRequiredFields,
  validateUUIDField,
} from '@utils/index';
import { WalletService } from '@modules/wallet/wallet.service';
import {
  CreateUserBankAccountDTO,
  FilterUserAccountsDTO,
  UserAccountResponseDTO,
  UserAccountsResponseDTO,
} from './dto/user-account.dto';

@Injectable()
export class UserAccountService extends GenericService(UserAccount) {
  constructor(
    @Inject(forwardRef(() => WalletService))
    private readonly walletSrv: WalletService,
  ) {
    super();
  }

  async createUserAccount(
    payload: CreateUserBankAccountDTO,
    userId: string,
  ): Promise<UserAccountResponseDTO> {
    try {
      checkForRequiredFields(['userId', 'bankCode', 'accountNumber'], {
        ...payload,
        userId,
      });
      const bank = await this.walletSrv.findBankByCode(payload.bankCode);
      const bankDetails = await this.walletSrv.verifyExternalAccountNumber(
        payload.bankCode,
        payload.accountNumber,
      );
      if (!bankDetails?.accountName) {
        throw new NotFoundException('Could not verify account');
      }
      const createdAccount = await this.create<Partial<UserAccount>>({
        userId,
        accountName: bankDetails.accountName,
        accountNumber: payload.accountNumber,
        bankCode: payload.bankCode,
        bankName: bank.bankName,
      });
      return {
        success: true,
        code: HttpStatus.CREATED,
        message: 'Created',
        data: createdAccount,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async findUserAccountById(
    userAccountId: string,
  ): Promise<UserAccountResponseDTO> {
    try {
      checkForRequiredFields(['userAccountId'], { userAccountId });
      const record = await this.getRepo().findOne({
        where: { id: userAccountId },
      });
      if (!record?.id) {
        throw new NotFoundException();
      }
      return {
        success: true,
        code: HttpStatus.OK,
        data: record,
        message: 'Record found',
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async findUserAccountsByUserId(
    userId: string,
    payload?: FilterUserAccountsDTO,
  ): Promise<UserAccountsResponseDTO> {
    try {
      checkForRequiredFields(['userId'], { userId });
      validateUUIDField(userId, 'userId');
      const filter: FindManyOptions<UserAccount> = {
        where: { userId },
        relations: ['user'],
      };
      if (payload.searchTerm) {
        filter.where = [
          {
            ...filter.where,
            bankName: ILike(`%${payload.searchTerm}%`),
          },
          {
            ...filter.where,
            accountNumber: ILike(`%${payload.searchTerm}%`),
          },
          {
            ...filter.where,
            accountName: ILike(`%${payload.searchTerm}%`),
          },
        ];
      }
      if (payload?.pageNumber && payload?.pageSize) {
        filter.skip = (payload.pageNumber - 1) * payload.pageSize;
        filter.take = payload.pageSize;
        const { response, paginationControl } =
          await calculatePaginationControls<UserAccount>(
            this.getRepo(),
            filter,
            {
              pageNumber: payload.pageNumber,
              pageSize: payload.pageSize,
            },
          );
        return {
          success: true,
          message: 'Records found',
          code: HttpStatus.OK,
          data: response,
          paginationControl,
        };
      }
      const users = await this.getRepo().find(filter);
      return {
        success: true,
        message: 'Records found',
        code: HttpStatus.OK,
        data: users,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }
}
