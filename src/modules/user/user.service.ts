import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
  Inject,
  Injectable,
  forwardRef,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { FindManyOptions, ILike, Not } from 'typeorm';
import { User } from '@entities/index';
import { GenericService } from '@schematics/index';
import {
  compareEnumValueFields,
  validateEmailField,
  verifyPasswordHash,
  BaseResponseTypeDTO,
  PaginationRequestType,
  validateURLField,
  appendPrefixToString,
  calculatePaginationControls,
  checkForRequiredFields,
  generateUniqueCode,
  generateUniqueKey,
  hashPassword,
  sendEmail,
  Gender,
  httpPost,
  validateBvn,
  DefaultPassportLink,
  generateRandomNumber,
  validatePastDate,
  validateUUIDField,
  sendSMS,
  groupBy,
  addLeadingZeroes,
  base64ToPNG,
  uploadFileToImageKit,
  base64ToJPEG,
} from '@utils/index';
import { AuthResponseDTO } from '@modules/auth/dto/auth.dto';
import {
  ChangePasswordDTO,
  CreateUserDTO,
  ResendOTPPayloadDTO,
  FilterUserDTO,
  FincraBVNValidationResponseDTO,
  UpdatePasswordDTO,
  UpdateUserDTO,
  OTPMedium,
  UserResponseDTO,
  UsersResponseDTO,
  GroupedUserListDTO,
  CreditUserWalletDTO,
  AccountBalanceDTO,
} from './dto/user.dto';
import { AuthService } from '../index';

@Injectable()
export class UserService extends GenericService(User) {
  constructor(
    @Inject(forwardRef(() => AuthService))
    private readonly authSrv: AuthService,
    private readonly eventEmitterSrv: EventEmitter2,
  ) {
    super();
  }

  async onModuleInit() {
    // const bvn = '22373523502';
    // const bvn = '11111111111';
    // const userId = '140be5ce-21ef-4680-b25c-2060d32d4735';
    // const tl = await this.resolveUserBvn2(bvn, userId);

    // console.log({ tl });

    const profiles = await this.getRepo()
      .createQueryBuilder('user')
      .where('CHAR_LENGTH(user.profileImageUrl) > :length', { length: 300 })
      .getMany();

    this.logger.log({ profiles });
    if (profiles?.length > 0) {
      const pngs = profiles.filter((item) =>
        item.profileImageUrl.startsWith('data:image/png'),
      );
      pngs.forEach(async (png) => {
        const url = base64ToPNG(png.profileImageUrl);
        const uploadedUrl = await uploadFileToImageKit(url);
        await this.getRepo().update(
          { id: png.id },
          { profileImageUrl: uploadedUrl },
        );
      });

      const jpegs = profiles.filter((item) =>
        item.profileImageUrl.startsWith('data:image/jpeg'),
      );
      jpegs.forEach(async (jpeg) => {
        const url = base64ToJPEG(jpeg.profileImageUrl);
        const uploadedUrl = await uploadFileToImageKit(url);
        await this.getRepo().update(
          { id: jpeg.id },
          { profileImageUrl: uploadedUrl },
        );
      });
    }
  }

  @OnEvent('after.sign-up', { async: true })
  async onSignup(user: User): Promise<void> {
    try {
      if (user.email) {
        const htmlEmailTemplate = `
        <h2>Please copy the code below to verify your account</h2>
        <h3>${user.uniqueVerificationCode}</h3>
      `;
        await sendEmail(htmlEmailTemplate, 'Verify Account', [user.email]);
      }
      if (user.phoneNumber) {
        const code = user.uniqueVerificationCode;
        const message = `Use this OTP to validate your Spraay account: ${code}`;
        await sendSMS(message, [user.phoneNumber], 'Verify Account');
      }
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async createUser(
    payload: CreateUserDTO,
    type: 'email' | 'phoneNumber' = 'email',
  ): Promise<AuthResponseDTO> {
    try {
      if (type === 'email') {
        checkForRequiredFields(['email', 'password'], payload);
        validateEmailField(payload.email);
        payload.email = payload.email.toUpperCase();
      }
      if (type === 'phoneNumber') {
        checkForRequiredFields(['phoneNumber', 'password'], payload);
      }
      const recordExists = await this.getRepo().findOne({
        where: [{ phoneNumber: payload.phoneNumber }, { email: payload.email }],
        select: ['id', 'email', 'phoneNumber'],
      });
      if (recordExists?.id) {
        let message = 'User with similar details already exists';
        if (type === 'email' && recordExists.email === payload.email) {
          message = 'User with similar email already exists';
        }
        if (
          type === 'phoneNumber' &&
          recordExists.phoneNumber === payload.phoneNumber
        ) {
          message = 'User with similar phone-number already exists';
        }
        throw new ConflictException(message);
      }
      const verificationCode = generateUniqueKey(4);
      const newUser = await this.create<Partial<User>>({
        ...payload,
        uniqueVerificationCode: verificationCode,
      });
      this.eventEmitterSrv.emit('after.sign-up', newUser);
      const response =
        type === 'email'
          ? await this.authSrv.login({
              email: payload.email,
              password: payload.password,
            })
          : await this.authSrv.loginWithPhone({
              phoneNumber: payload.phoneNumber,
              password: payload.password,
            });
      return {
        ...response,
        code: HttpStatus.CREATED,
        message: 'Account Created',
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async doesUserHaveEnoughBalanceInWallet(
    userId: string,
    withdrawalSum: number,
  ): Promise<boolean> {
    try {
      const user = await this.getRepo().findOne({
        where: { id: userId },
        select: ['id', 'walletBalance'],
      });
      if (!user?.id) {
        throw new NotFoundException('User not found');
      }
      return withdrawalSum > user.walletBalance ? false : true;
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async getCurrentWalletBalance(userId: string): Promise<number> {
    try {
      const user = await this.getRepo().findOne({
        where: { id: userId },
        select: ['id', 'walletBalance'],
      });
      if (!user?.id) {
        throw new NotFoundException('User not found');
      }
      return user.walletBalance;
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async checkForPotentialBalance(
    userId: string,
    amount: number,
  ): Promise<AccountBalanceDTO> {
    try {
      const userBalance = await this.getAccountBalance(userId);
      if (amount > userBalance.currentBalance) {
        throw new ConflictException('Insufficient balance');
      }
      return userBalance;
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async getAccountBalance(userId: string): Promise<AccountBalanceDTO> {
    try {
      checkForRequiredFields(['userId'], { userId });
      const user = await this.findUserById(userId);
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Account balance',
        currentBalance: user.data.walletBalance,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async verifyTransactionPin(
    userId: string,
    pin: string,
  ): Promise<BaseResponseTypeDTO> {
    try {
      const user = await this.getRepo().findOne({
        where: { id: userId },
        select: ['id', 'transactionPin'],
      });
      if (!user?.id) {
        throw new NotFoundException('User not found');
      }
      const isValid = await verifyPasswordHash(pin, user.transactionPin);
      if (!isValid) {
        throw new BadRequestException('Invalid transaction pin');
      }
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Pin verified',
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async verifyCodeAfterSignup(
    uniqueVerificationCode: string,
    userId: string,
  ): Promise<BaseResponseTypeDTO> {
    try {
      const codeExists = await this.getRepo().findOne({
        where: { uniqueVerificationCode },
        select: ['id'],
      });
      if (codeExists?.id) {
        if (codeExists.id !== userId) {
          throw new ForbiddenException('This code does not belong to you');
        }
        // Activate the user account
        await this.getRepo().update({ id: codeExists.id }, { status: true });
        return {
          success: true,
          code: HttpStatus.OK,
          message: 'Code verified',
        };
      }
      throw new NotFoundException('Code was not found');
    } catch (ex) {
      throw ex;
    }
  }

  async resendOTPAfterLogin(
    payload: Partial<ResendOTPPayloadDTO>,
    medium = OTPMedium.PHONE_NUMBER,
  ): Promise<BaseResponseTypeDTO> {
    try {
      let record: User;
      if (payload.userId) {
        validateUUIDField(payload.userId, 'userId');
        record = await this.findOne({ id: payload.userId });
      }
      if (payload.email) {
        validateEmailField(payload.email);
        record = await this.findOne({ id: payload.email.toUpperCase() });
      }
      if (payload.phoneNumber) {
        record = await this.findOne({ phoneNumber: payload.phoneNumber });
      }
      if (!record?.id) {
        throw new NotFoundException('User not found');
      }
      let token = record.uniqueVerificationCode;
      if (!token) {
        token = generateUniqueCode();
        await this.getRepo().update(
          { id: record.id },
          { uniqueVerificationCode: token },
        );
      }
      let responseMessage = 'Token has been sent';
      switch (medium) {
        case OTPMedium.EMAIL:
          // Send code
          const htmlEmailTemplate = `
            <h2>Please copy the code below to verify your account</h2>
            <h3>${token}</h3>
          `;
          await sendEmail(htmlEmailTemplate, 'Verify Account', [record.email]);
          responseMessage = 'Token has been sent to your email';
          break;
        default:
        case OTPMedium.PHONE_NUMBER:
          console.log({ msg: 'Yes oo', medium });
          const message = `Please copy the code below to verify your account\n ${token}`;
          await sendSMS(message, [record.phoneNumber], 'Verify Account');
          responseMessage = 'Token has been sent to your phone-number via sms';
          break;
      }
      return {
        success: true,
        code: HttpStatus.OK,
        message: responseMessage,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async initiateForgotPasswordFlow(
    email: string,
  ): Promise<BaseResponseTypeDTO> {
    try {
      const userExists = await this.findOne({ email: email.toUpperCase() });
      if (userExists?.id) {
        const uniqueCode = generateUniqueCode();
        await this.getRepo().update(
          { id: userExists.id },
          { uniqueVerificationCode: uniqueCode },
        );
        const htmlEmailTemplate = `
            <h2>Please copy the code below to verify your account ownership</h2>
            <h3>${uniqueCode}</h3>
          `;
        const emailResponse = await sendEmail(
          htmlEmailTemplate,
          'Verify Account Ownership',
          [email],
        );
        if (emailResponse.success) {
          return {
            ...emailResponse,
            message: 'Confirmation email sent',
          };
        }
        throw new InternalServerErrorException('Email was not sent');
      }
      throw new NotFoundException('User was not found');
    } catch (ex) {
      throw ex;
    }
  }

  async finalizeForgotPasswordFlow(
    uniqueVerificationCode: string,
  ): Promise<BaseResponseTypeDTO> {
    try {
      const userExists = await this.findOne({
        uniqueVerificationCode,
      });
      if (userExists?.id) {
        return {
          success: true,
          code: HttpStatus.OK,
          message: 'Unique token is valid',
        };
      }
      throw new NotFoundException('Invalid verification code');
    } catch (ex) {
      throw ex;
    }
  }

  async changePassword({
    uniqueVerificationCode,
    newPassword,
  }: UpdatePasswordDTO): Promise<BaseResponseTypeDTO> {
    try {
      const userExists = await this.findOne({
        uniqueVerificationCode,
      });
      if (userExists?.id) {
        const doesOldAndNewPasswordMatch = await verifyPasswordHash(
          newPassword,
          userExists.password,
        );
        if (doesOldAndNewPasswordMatch) {
          const message = 'Both old and new password match';
          throw new ConflictException(message);
        }
        const hashedPassword = await hashPassword(newPassword);
        await this.getRepo().update(
          { id: userExists.id },
          {
            uniqueVerificationCode: null,
            password: hashedPassword,
          },
        );
        return {
          success: true,
          code: HttpStatus.OK,
          message: 'Password changed successfully',
        };
      }
      throw new NotFoundException('Invalid verification code');
    } catch (ex) {
      throw ex;
    }
  }

  async findUserByEmailAndPassword(
    email: string,
    password: string,
  ): Promise<UserResponseDTO> {
    try {
      const user = await this.getRepo().findOne({
        where: { email: email.toUpperCase() },
      });
      if (user?.id && (await verifyPasswordHash(password, user.password))) {
        return {
          success: true,
          code: HttpStatus.OK,
          data: user,
          message: 'User found',
        };
      }
      throw new NotFoundException('Invalid credentials');
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async findUserByPhoneNumberAndPassword(
    phoneNumber: string,
    password: string,
  ): Promise<UserResponseDTO> {
    try {
      const user = await this.getRepo().findOne({
        where: { phoneNumber },
      });
      if (user?.id && (await verifyPasswordHash(password, user.password))) {
        return {
          success: true,
          code: HttpStatus.OK,
          data: user,
          message: 'User found',
        };
      }
      throw new NotFoundException('Invalid credentials');
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async findUserById(userId: string): Promise<UserResponseDTO> {
    try {
      const data = await this.getRepo().findOne({
        where: { id: userId },
      });
      if (data?.id) {
        return {
          success: true,
          code: HttpStatus.OK,
          data,
          message: 'User found',
        };
      }
      throw new NotFoundException('User not found');
    } catch (ex) {
      throw ex;
    }
  }

  async findUserByUserTag(userTag: string): Promise<UserResponseDTO> {
    try {
      const data = await this.getRepo().findOne({
        where: { userTag },
      });
      if (data?.id) {
        return {
          success: true,
          code: HttpStatus.OK,
          data,
          message: 'User found',
        };
      }
      throw new NotFoundException('User not found');
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async groupUserList(): Promise<GroupedUserListDTO> {
    try {
      let users: (User | any)[] = await this.getRepo().find({
        where: { status: true },
      });
      users = users.map((user) => ({
        ...user,
        firstLetter: (user.firstName ?? 'null').toUpperCase().charAt(0),
      }));
      const data = groupBy(users, 'firstLetter');

      const sortedData = {};
      Object.keys(data)
        .sort()
        .forEach((key) => {
          sortedData[key] = data[key];
        });
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'List found',
        data: sortedData,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async findUsers(
    filterOptions: FilterUserDTO,
    pagination?: PaginationRequestType,
  ): Promise<UsersResponseDTO> {
    try {
      const filter: FindManyOptions<User> = {};
      if (
        typeof filterOptions.status !== 'undefined' &&
        filterOptions.status !== null
      ) {
        filter.where = { ...filter.where, status: filterOptions.status };
      }
      if (
        typeof filterOptions.isNewUser !== 'undefined' &&
        filterOptions.isNewUser !== null
      ) {
        filter.where = { ...filter.where, status: filterOptions.isNewUser };
      }
      if (filterOptions?.gender) {
        filter.where = { ...filter.where, gender: filterOptions.gender };
      }
      if (filterOptions?.authProvider) {
        filter.where = {
          ...filter.where,
          authProvider: filterOptions.authProvider,
        };
      }
      if (filterOptions?.role) {
        filter.where = { ...filter.where, role: filterOptions.role };
      }
      if (filterOptions?.searchTerm) {
        filter.where = [
          {
            ...filter.where,
            firstName: ILike(`%${filterOptions.searchTerm}%`),
          },
          {
            ...filter.where,
            lastName: ILike(`%${filterOptions.searchTerm}%`),
          },
          {
            ...filter.where,
            bvn: ILike(`%${filterOptions.searchTerm}%`),
          },
          {
            ...filter.where,
            email: ILike(`%${filterOptions.searchTerm}%`),
          },
          {
            ...filter.where,
            phoneNumber: ILike(`%${filterOptions.searchTerm}%`),
          },
        ];
      }
      if (pagination?.pageNumber && pagination?.pageSize) {
        filter.skip = (pagination.pageNumber - 1) * pagination.pageSize;
        filter.take = pagination.pageSize;
        const { response, paginationControl } =
          await calculatePaginationControls<User>(
            this.getRepo(),
            filter,
            pagination,
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

  async deleteUser(userId: string): Promise<BaseResponseTypeDTO> {
    try {
      await this.delete({ id: userId });
      return {
        code: HttpStatus.OK,
        message: 'User deleted',
        success: true,
      };
    } catch (ex) {
      throw ex;
    }
  }

  async changeAccountPassword(
    payload: ChangePasswordDTO,
    userId: string,
  ): Promise<BaseResponseTypeDTO> {
    try {
      checkForRequiredFields(['currentPassword', 'newPassword'], payload);
      const record = await this.findOne({ id: userId });
      if (!record?.id) {
        throw new NotFoundException();
      }
      const verifyCurrentPassword = await verifyPasswordHash(
        payload.currentPassword,
        record.password,
      );
      if (!verifyCurrentPassword) {
        throw new BadRequestException('Could not verify current password');
      }
      const newPasswordHash = await hashPassword(payload.newPassword);
      await this.getRepo().update(
        { id: record.id },
        { password: newPasswordHash },
      );
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Password changed',
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async deleteUserByEmail(email: string): Promise<BaseResponseTypeDTO> {
    try {
      const userExists = await this.findOne({ email });
      if (userExists?.id) {
        await this.delete({ email });
        return {
          code: HttpStatus.OK,
          message: 'User deleted',
          success: true,
        };
      }
      throw new NotFoundException('User was not found');
    } catch (ex) {
      throw ex;
    }
  }

  async deleteUserByPhoneNumber(
    phoneNumber: string,
  ): Promise<BaseResponseTypeDTO> {
    try {
      const userExists = await this.findOne({ phoneNumber });
      if (userExists?.id) {
        await this.delete({ phoneNumber });
        return {
          code: HttpStatus.OK,
          message: 'User deleted',
          success: true,
        };
      }
      throw new NotFoundException('User was not found');
    } catch (ex) {
      throw ex;
    }
  }

  async updateUser(payload: UpdateUserDTO): Promise<BaseResponseTypeDTO> {
    try {
      checkForRequiredFields(['userId'], payload);
      const record = await this.findOne({ id: payload.userId });
      if (!record?.id) {
        throw new NotFoundException('User with id not found');
      }
      if ('status' in payload) {
        record.status = payload.status;
      }
      if ('displayWalletBalance' in payload) {
        record.displayWalletBalance = payload.displayWalletBalance;
      }
      if ('enableFaceId' in payload) {
        record.enableFaceId = payload.enableFaceId;
      }
      if ('allowEmailNotifications' in payload) {
        record.allowEmailNotifications = payload.allowEmailNotifications;
      }
      if ('allowSmsNotifications' in payload) {
        record.allowSmsNotifications = payload.allowSmsNotifications;
      }
      if ('allowPushNotifications' in payload) {
        record.allowPushNotifications = payload.allowPushNotifications;
      }
      if (payload.dob && record.dob !== payload.dob) {
        validatePastDate(payload.dob, 'dob');
        record.dob = payload.dob;
      }
      if (payload.phoneNumber && payload.phoneNumber !== record.phoneNumber) {
        record.phoneNumber = payload.phoneNumber;
      }
      if (payload.deviceId && record.deviceId !== payload.deviceId) {
        record.deviceId = payload.deviceId;
      }
      if (payload.email && payload.email !== record.email) {
        validateEmailField(payload.email);
        record.email = payload.email.toUpperCase();
      }
      if (payload.firstName && payload.firstName !== record.firstName) {
        record.firstName = payload.firstName.toUpperCase();
      }
      if (payload.lastName && payload.lastName !== record.lastName) {
        record.lastName = payload.lastName.toUpperCase();
      }
      if (payload.gender && payload.gender !== record.gender) {
        compareEnumValueFields(payload.gender, Object.values(Gender), 'gender');
        record.gender = payload.gender;
      }
      if (payload.transactionPin) {
        record.transactionPin = await hashPassword(payload.transactionPin);
      }
      if (payload.password) {
        record.password = await hashPassword(payload.password);
      }
      if (
        payload.profileImageUrl &&
        payload.profileImageUrl !== record.profileImageUrl
      ) {
        validateURLField(payload.profileImageUrl, 'profileImageUrl');
        record.profileImageUrl = payload.profileImageUrl;
      }
      if (
        payload.userTag &&
        appendPrefixToString('@', payload.userTag) !== record.userTag
      ) {
        const tag = appendPrefixToString('@', payload.userTag);
        const tagRecord = await this.getRepo().findOne({
          where: { id: Not(payload.userId), userTag: tag },
          select: ['id'],
        });
        if (tagRecord?.id) {
          throw new ConflictException(
            `Another user currently owns tag: '${tag}'`,
          );
        }
        record.userTag = tag;
      }
      if (
        payload.uniqueVerificationCode &&
        record.uniqueVerificationCode !== payload.uniqueVerificationCode
      ) {
        record.uniqueVerificationCode = payload.uniqueVerificationCode;
      }
      if (payload.bvn && record.bvn !== payload.bvn) {
        validateBvn(payload.bvn, 'bvn');
        const bvnValidationResponse = await this.resolveUserBvn(
          payload.bvn,
          record.id,
        );
        if (bvnValidationResponse?.success && bvnValidationResponse.data) {
          if (record.profileImageUrl === DefaultPassportLink.male) {
            record.profileImageUrl = bvnValidationResponse.data.pixBase64;
          }
          if (!record.phoneNumber) {
            record.phoneNumber = bvnValidationResponse.data.phoneNo;
          }
          if (!record.firstName) {
            record.firstName = bvnValidationResponse.data.firstName;
          }
          if (!record.lastName) {
            record.lastName = bvnValidationResponse.data.lastName;
          }
          if (!record.virtualAccountNumber) {
            // Generate a WEMA bank account for the user
            const { accountName, accountNumber } = await this.createBankAccount(
              record,
            );
            if (accountName && accountNumber) {
              record.virtualAccountName = accountName;
              record.virtualAccountNumber = accountNumber;
              record.bankName = 'WEMA BANK';
            }
          }
        }
        record.bvn = payload.bvn;
      }
      const updatedRecord: Partial<User> = {
        bvn: record.bvn,
        dob: record.dob,
        gender: record.gender,
        email: record.email,
        status: record.status,
        userTag: record.userTag,
        lastName: record.lastName,
        password: record.password,
        firstName: record.firstName,
        phoneNumber: record.phoneNumber,
        deviceId: record.deviceId,
        enableFaceId: record.enableFaceId,
        transactionPin: record.transactionPin,
        profileImageUrl: record.profileImageUrl,
        uniqueVerificationCode: record.uniqueVerificationCode,
        virtualAccountName: record.virtualAccountName,
        virtualAccountNumber: record.virtualAccountNumber,
        allowEmailNotifications: record.allowEmailNotifications,
        allowPushNotifications: record.allowPushNotifications,
        allowSmsNotifications: record.allowSmsNotifications,
        displayWalletBalance: record.displayWalletBalance,
      };
      await this.getRepo().update({ id: record.id }, updatedRecord);
      this.eventEmitterSrv.emit('test:wallet.create', record.id);
      this.eventEmitterSrv.emit('create-wallet', record.id);
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Updated',
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  // TODO: Remove after testing phase
  @OnEvent('test:wallet.create', { async: true })
  async createRemoteAccount(userId: string): Promise<void> {
    try {
      checkForRequiredFields(['userId'], { userId });
      const record = await this.findUserById(userId);
      if (record?.data.firstName && record.data.lastName) {
        const { accountName, accountNumber } = await this.createBankAccount(
          record.data,
        );
        if (accountName && accountNumber) {
          await this.getRepo().update(
            { id: userId },
            {
              virtualAccountName: accountName,
              virtualAccountNumber: accountNumber,
              bankName: 'WEMA BANK',
            },
          );
        }
      }
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  @OnEvent('wallet.credit', { async: true })
  async creditUserWallet(
    payload: CreditUserWalletDTO,
  ): Promise<BaseResponseTypeDTO> {
    try {
      checkForRequiredFields(['amount', 'userId'], payload);
      validateUUIDField(payload.userId, 'userId');
      const user = await this.findUserById(payload.userId);
      const newBalance = user.data.walletBalance + payload.amount;
      await this.getRepo().update(
        { id: payload.userId },
        { walletBalance: newBalance },
      );
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Wallet credited',
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  @OnEvent('wallet.debit', { async: true })
  async debitUserWallet(
    payload: CreditUserWalletDTO,
  ): Promise<BaseResponseTypeDTO> {
    try {
      checkForRequiredFields(['amount', 'userId'], payload);
      validateUUIDField(payload.userId, 'userId');
      const user = await this.findUserById(payload.userId);
      if (payload.amount <= user.data.walletBalance) {
        const newBalance = user.data.walletBalance - payload.amount;
        await this.getRepo().update(
          { id: payload.userId },
          { walletBalance: newBalance },
        );
      }
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Wallet credited',
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  private async createBankAccount(
    { firstName, lastName }: User,
    env = 'TEST',
  ): Promise<{ accountName: string; accountNumber: string }> {
    if (!firstName || !lastName) {
      throw new BadRequestException(
        'User cannot have a virtual account without first/last names',
      );
    }
    if (env === 'TEST') {
      const accountNumber = generateRandomNumber();
      const accountName = `${firstName} ${lastName}`;
      return { accountName, accountNumber };
    }
  }

  private async resolveUserBvn2(
    bvn: string,
    userId: string,
  ): Promise<FincraBVNValidationResponseDTO> {
    try {
      checkForRequiredFields(['bvn', 'userId'], { bvn, userId });
      validateBvn(bvn, 'bvn');
      validateUUIDField(userId, 'userId');
      const user = await this.getRepo().findOne({
        where: { id: userId },
        select: ['id', 'firstName', 'lastName', 'dob'],
      });
      if (user?.id) {
        const dobDate = user.dob ? new Date(user.dob) : new Date();
        const dob = `${addLeadingZeroes(dobDate.getDate())}-${addLeadingZeroes(
          dobDate.getMonth() + 1,
        )}-${dobDate.getFullYear()}`;
        const url = `https://vapi.verifyme.ng/v1/verifications/identities/bvn/${bvn}`;
        const verifyMeResponse = await httpPost<any, any>(
          url,
          {
            firstname: user.firstName ?? 'String',
            lastname: user.lastName ?? 'String',
            dob,
          },
          {
            Authorization: `Bearer ${String(process.env.VERIFY_ME_SECRET_KEY)}`,
          },
        );
        if (verifyMeResponse?.status === 'success') {
          const photo = `data:image/png;base64,${verifyMeResponse.data.photo}`;
          const localUrl = base64ToPNG(photo);
          const url = await uploadFileToImageKit(localUrl);
          return {
            success: true,
            message: verifyMeResponse.status,
            data: {
              gender: verifyMeResponse.data.gender,
              phoneNo: verifyMeResponse.data.phone,
              dateOfBirth: verifyMeResponse.data.birthdate,
              middleName: verifyMeResponse.data.middlename,
              firstName: verifyMeResponse.data.firstname,
              lastName: verifyMeResponse.data.lastname,
              pixBase64: url,
            },
          };
        }
      }
    } catch (ex) {
      this.logger.error(ex);
      if (String(ex).includes('status code 404')) {
        throw new NotFoundException('BVN not found');
      }
      throw ex;
    }
  }

  private async resolveUserBvn(
    bvn: string,
    userId: string,
    env = 'TEST',
  ): Promise<FincraBVNValidationResponseDTO> {
    try {
      checkForRequiredFields(['bvn', 'userId'], { bvn, userId });
      validateBvn(bvn, 'bvn');
      validateUUIDField(userId, 'userId');
      const user = await this.getRepo().findOne({
        where: { id: userId },
        select: ['id'],
      });
      if (user?.id) {
        const url =
          env === 'TEST'
            ? 'http://api.sandbox.youverify.co/v2/api/identity/ng/bvn'
            : 'http://api.youverify.co/v2/api/identity/ng/bvn';
        const youVerifyResponse = await httpPost<any, any>(
          url,
          {
            id: bvn,
            isSubjectConsent: true,
          },
          {
            token: String(process.env.YOU_VERIFY_SECRET_KEY),
          },
        );
        if (youVerifyResponse?.success) {
          const photo = `${youVerifyResponse.data.image}`;
          const localUrl = base64ToJPEG(photo);
          const url = await uploadFileToImageKit(localUrl);
          return {
            success: true,
            message: youVerifyResponse.message,
            data: {
              gender: youVerifyResponse.data?.gender,
              phoneNo: youVerifyResponse.data.mobile,
              dateOfBirth: youVerifyResponse.data.dateOfBirth,
              middleName: youVerifyResponse.data?.middleName,
              firstName: youVerifyResponse.data.firstName,
              lastName: youVerifyResponse.data.lastName,
              pixBase64: url,
            },
          };
        }
      }
    } catch (ex) {
      this.logger.error(ex);
      if (String(ex).includes('status code 404')) {
        throw new NotFoundException('BVN not found');
      }
      throw ex;
    }
  }
}
