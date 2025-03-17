import { EventEmitter2 } from '@nestjs/event-emitter';
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
  HttpException,
} from '@nestjs/common';
import {
  DataSource,
  FindManyOptions,
  ILike,
  In,
  Not,
  createConnection,
  getConnection,
} from 'typeorm';
import axios, { AxiosError, AxiosResponse } from 'axios';
import { GenericService } from '@schematics/index';
import { User } from '@entities/index';
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
  validateBvn,
  DefaultPassportLink,
  validatePastDate,
  validateUUIDField,
  sendSMS,
  groupBy,
  uploadFileToImageKit,
  base64ToJPEG,
  validateArrayField,
  formatPhoneNumberWithPrefix,
  AppRole,
} from '@utils/index';
import { AuthResponseDTO } from '@modules/auth/dto/auth.dto';
import { AuthService } from '@modules/auth/auth.service';
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
  UserContactsDTO,
  UserContactsQueryDTO,
  CreateAdminDto,
  GetBvnAdvancedDto,
  LivenessCheckDto,
} from './dto/user.dto';
import ormConfig from '../../orm.config';
import { Request } from 'express';
import { UserActivityService } from '@modules/user-activity/user-activity.service';

@Injectable()
export class UserService extends GenericService(User) {
  private readonly DojahbaseUrl = 'https://api.dojah.io'; // Ensure this is in your .env file
  constructor(
    @Inject(forwardRef(() => AuthService))
    private readonly authSrv: AuthService,
    private readonly userActivitySrv: UserActivityService,
    private readonly eventEmitterSrv: EventEmitter2,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    // const bvn = '22373523502';
    // const userId = 'a036de16-6c95-404c-a3e6-3050ccfc1adf';
    // const tl = await this.findAll();
    // // console.log({ tl });
    // const userData = await this.resolveUserBvn(bvn, userId);
    // console.log({ userData  });
    // ========== Clear DB tables ========== //
    // const { connection, tables } = await this.getAllTables();
    // console.log({ tables });
    // await this.deleteAllTables(connection, tables);
    // ========== Clear DB tables ========== //
  }

  private async getAllTables(): Promise<{
    connection: DataSource;
    tables: string[];
  }> {
    const connection = await createConnection(ormConfig);
    try {
      const tableNames = getConnection().entityMetadatas.map(
        (entityMetadata) => entityMetadata.tableName,
      );
      return { connection, tables: tableNames };
    } catch (ex) {
      console.error(ex);
    } finally {
      // await connection.close();
    }
  }

  private async deleteAllTables(
    dbConnection: DataSource,
    tableNames: string[],
  ): Promise<void> {
    try {
      console.log('All tables in the database:', tableNames);
      const queryRunner = dbConnection.createQueryRunner();
      for (const tableName of tableNames) {
        const query = `DELETE FROM "${tableName}";`;
        await queryRunner.query(query);
      }
    } catch (ex) {
      console.error(ex);
    } finally {
      await dbConnection.close();
    }
  }

  async findContactsFilteredByUserContacts(
    payload: UserContactsDTO,
    pagination?: UserContactsQueryDTO,
  ): Promise<UsersResponseDTO> {
    try {
      checkForRequiredFields(['contacts'], payload);
      validateArrayField(payload.contacts, 'contacts');
      const contacts = payload.contacts.map((contact) =>
        formatPhoneNumberWithPrefix(contact.phoneNumber),
      );
      const filter: FindManyOptions<User> = {
        where: { role: AppRole.CUSTOMER },
      };
      if (contacts?.length > 0) {
        filter.where = { ...filter.where, formattedPhoneNumber: In(contacts) };
      }
      if (pagination?.searchTerm) {
        const searchFields = [
          'phoneNumber',
          'firstName',
          'lastName',
          'email',
          'bvn',
        ];
        filter.where = searchFields.map((column) => ({
          ...filter.where,
          [column]: ILike(`%${pagination.searchTerm}%`),
        })) as any[];
      }
      if (pagination?.pageNumber && pagination?.pageSize) {
        filter.skip = (pagination.pageNumber - 1) * pagination.pageSize;
        filter.take = pagination.pageSize;
        const { response, paginationControl } =
          await calculatePaginationControls<User>(this.getRepo(), filter, {
            pageNumber: pagination.pageNumber,
            pageSize: pagination.pageSize,
          });
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
      let response: AuthResponseDTO;
      if (type === 'email') {
        response = await this.authSrv.login({
          email: payload.email,
          password: payload.password,
        });
      } else {
        response = await this.authSrv.loginWithPhone({
          phoneNumber: payload.phoneNumber,
          password: payload.password,
        });
      }
      await this.afterSignup(newUser);
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

  async getCurrentWalletBalance(userId: string): Promise<number> {
    try {
      const user = await this.getRepo().findOne({
        where: { id: userId },
        select: ['id', 'walletBalance'],
      });
      if (!user?.id) {
        throw new NotFoundException('User not found');
      }
      return Number(user.walletBalance);
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async checkAccountBalance(
    amount: number,
    userId: string,
  ): Promise<AccountBalanceDTO> {
    try {
      checkForRequiredFields(['amount', 'userId'], { amount, userId });
      validateUUIDField(userId, 'userId');
      const user = await this.findUserById(userId);
      const balance = Number(user.data.walletBalance);
      if (Number(amount) > balance) {
        throw new ConflictException('Insufficient balance');
      }
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Account balance',
        currentBalance: balance,
      };
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
        currentBalance: Number(user.data.walletBalance),
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
        record = await this.findOne({ email: payload.email.toUpperCase() });
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
          const today = new Date();
          const instagramUrl = String(process.env.INSTAGRAM_URL);
          const twitterUrl = String(process.env.TWITTER_URL);
          const facebookUrl = String(process.env.FACEBOOK_URL);
          // Send code
          const htmlEmailTemplate = `
            <section style="background: white; color: black; font-size: 15px; font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif; display: flex; justify-content: center; margin: 0;">
              <div style="padding: 2rem; width: 80%;">
                <section style="text-align: center;">
                    <div style="width: fit-content; margin: 20px 0px;display: inline-block;">
                        <img src="https://ik.imagekit.io/un0omayok/Logo%20animaion.png?updatedAt=1701281040423" alt="">
                    </div>
                </section>
    
                <section style="width: 100%; height: auto; font-size: 18px; text-align: justify;">
                    <p style="font-weight:300">Hi ${record.firstName},</p>
                    <p style="font-weight:300">
                        You've recently requested to reset your password. Copy the code below 
                        to create a new password for your Spraay App account.
                    </p>
                    <h1 style="text-align: center; font-size: 50px;">${token}</h1>
                    <p style="font-weight:300">
                        If you did not make this request, please ignore this message.
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
                    <p style="font-weight: 400;">Spraay &copy;${today.getFullYear()}</p>
                    <p style="font-weight: 400;">Click here to <a href="#" style="color: #5B45FF;">Unsubscribe</a></p>
                </section>
              </div>
            </section>
          `;
          await sendEmail(htmlEmailTemplate, 'Verify Account', [record.email]);
          responseMessage = 'Token has been sent to your email';
          break;
        default:
        case OTPMedium.PHONE_NUMBER:
          const message = `Please copy the code below to verify your account\n ${token}`;
          // await sendSMS(message, [record.phoneNumber], 'Verify Account');
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
        const today = new Date();
        const instagramUrl = String(process.env.INSTAGRAM_URL);
        const twitterUrl = String(process.env.TWITTER_URL);
        const facebookUrl = String(process.env.FACEBOOK_URL);
        const htmlEmailTemplate = `
        <section style="background: white; color: black; font-size: 15px; font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif; display: flex; justify-content: center; margin: 0;">
          <div style="padding: 2rem; width: 80%;">
            <section style="text-align: center;">
                <div style="width: fit-content; margin: 20px 0px;display: inline-block;">
                    <img src="https://ik.imagekit.io/un0omayok/Logo%20animaion.png?updatedAt=1701281040423" alt="">
                </div>
            </section>

            <section style="width: 100%; height: auto; font-size: 18px; text-align: justify;">
                <p style="font-weight:300">Hi ${userExists.firstName},</p>
                <p style="font-weight:300">
                    You've recently requested to reset your password. Copy the code below 
                    to create a new password for your Spraay App account.
                </p>
                <h1 style="text-align: center; font-size: 50px;">${uniqueCode}</h1>
                <p style="font-weight:300">
                    If you did not make this request, please ignore this message.
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
                <p style="font-weight: 400;">Spraay &copy;${today.getFullYear()}</p>
                <p style="font-weight: 400;">Click here to <a href="#" style="color: #5B45FF;">Unsubscribe</a></p>
            </section>
          </div>
        </section>`;
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
      this.logger.error(ex);
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
        await this.sendEmailAfterPasswordChange(userExists.id);
        return {
          success: true,
          code: HttpStatus.OK,
          message: 'Password changed successfully',
        };
      }
      throw new NotFoundException('Invalid verification code');
    } catch (ex) {
      this.logger.error(ex);
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
      console.log(user);
      if (user?.id && (await verifyPasswordHash(password, user.password))) {
        await this.userActivitySrv.logUserActivity(user?.id, 'Login');
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
      // Preprocess the phone number to ensure it is 11 digits long
      if (phoneNumber.length === 10) {
        phoneNumber = '0' + phoneNumber; // Add a leading '0' if the length is 10
      }

      // Validate that the phone number is now 11 digits long
      if (phoneNumber.length !== 11) {
        throw new BadRequestException('Invalid phone number format');
      }
      console.log('New Phone Number: ' + phoneNumber);
      // Query the database for the user with the processed phone number
      const user = await this.getRepo().findOne({
        where: { phoneNumber },
      });

      // Verify the user exists and the password matches
      if (user?.id && (await verifyPasswordHash(password, user.password))) {
        await this.userActivitySrv.logUserActivity(user?.id, 'Login');
        return {
          success: true,
          code: HttpStatus.OK,
          data: user,
          message: 'User found',
        };
      }

      // If the user is not found or the password is incorrect, throw an exception
      throw new NotFoundException('Invalid credentials');
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  // async findUserByPhoneNumberAndPassword(
  //   phoneNumber: string,
  //   password: string,
  // ): Promise<UserResponseDTO> {
  //   try {
  //     const user = await this.getRepo().findOne({
  //       where: { phoneNumber },
  //     });

  //     if (user?.id && (await verifyPasswordHash(password, user.password))) {
  //       await this.userActivitySrv.logUserActivity(user?.id, 'Login');
  //       return {
  //         success: true,
  //         code: HttpStatus.OK,
  //         data: user,
  //         message: 'User found',
  //       };
  //     }
  //     throw new NotFoundException('Invalid credentials');
  //   } catch (ex) {
  //     this.logger.error(ex);
  //     throw ex;
  //   }
  // }

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
      await this.userActivitySrv.logUserActivity(
        record?.id,
        'Pass Word Change',
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

  async updateUser(
    payload: UpdateUserDTO,
    req: Request,
  ): Promise<BaseResponseTypeDTO> {
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
        if (!record.email) {
          await this.sendWelcomeEmail(record.id, payload.email);
        }
        record.email = payload.email.toUpperCase();
      }
      if (payload.firstName && payload.firstName !== record.firstName) {
        record.firstName = payload.firstName.toUpperCase();
      }
      if (payload.lastName && payload.lastName !== record.lastName) {
        record.lastName = payload.lastName.toUpperCase();
      }

      if (payload.Freeze && payload.Freeze !== record.Freeze) {
        record.Freeze = payload.Freeze;
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
      // if (payload.bvn && record.bvn !== payload.bvn) {
      //   validateBvn(payload.bvn, 'bvn');
      //   const bvnValidationResponse = await this.resolveUserBvn(
      //     payload.bvn,
      //     record.id,
      //   );
      //   if (bvnValidationResponse?.success && bvnValidationResponse.data) {
      //     if (record.profileImageUrl === DefaultPassportLink.male) {
      //       record.profileImageUrl = bvnValidationResponse.data.pixBase64;
      //     }
      //     if (!record.phoneNumber) {
      //       record.phoneNumber = bvnValidationResponse.data.phoneNo;
      //     }
      //     if (!record.firstName) {
      //       record.firstName = bvnValidationResponse.data.firstName;
      //     }
      //     if (!record.lastName) {
      //       record.lastName = bvnValidationResponse.data.lastName;
      //     }
      //     if (!record.virtualAccountNumber) {
      //       this.eventEmitterSrv.emit('create-wallet', {
      //         userId: record.id,
      //         req,
      //       });
      //     }
      //   }
      //   record.bvn = payload.bvn;
      // }

      if (
        payload.bvn &&
        record.bvn !== payload.bvn &&
        payload.bvn != '' &&
        payload.bvn != ' '
      ) {
        console.log(payload.bvn);
        validateBvn(payload.bvn, 'bvn');
        const recordExists = await this.findOne({ bvn: payload.bvn });
        if (recordExists?.id) {
          let message = 'This BVN is already registered';
          if (recordExists.bvn === payload.bvn) {
            message = 'This BVN is already registered';
          }
          throw new ConflictException(message);
        }

        const bvnValidationResponse = await this.resolveUserBvnDojah(
          { bvn: payload.bvn },
          // record.id,
        );
        // console.log(bvnValidationResponse)
        if (bvnValidationResponse.entity.bvn === payload.bvn) {
          // Check if the first name matches
          const firstNameMatches =
            bvnValidationResponse.entity.first_name.toLowerCase().trim() ===
            record.firstName.toLowerCase().trim();

          // Check if the last name matches the middle name
          const middleNameMatchesLastName =
            bvnValidationResponse.entity.middle_name.toLowerCase().trim() ===
            record.lastName.toLowerCase().trim();

          // Check if the first name matches the surname
          const surnameMatchesFirstName =
            bvnValidationResponse.entity.last_name.toLowerCase().trim() ===
            record.firstName.toLowerCase().trim();

          // Only proceed if any of the above conditions are true
          if (
            firstNameMatches ||
            middleNameMatchesLastName ||
            surnameMatchesFirstName
          ) {
            // If no virtual account number exists, emit the event to create one
            if (!record.virtualAccountNumber) {
              this.eventEmitterSrv.emit('create-wallet', {
                userId: record.id,
                req,
              });
            }
          } else {
            // Throw an error if none of the names match
            throw new BadRequestException(
              `BVN verification failed or details do not match`,
            );
          }
        } else {
          // Throw an error if BVN verification was not successful
          throw new BadRequestException('BVN verification failed.');
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
        Freeze: record.Freeze,
        lastName: record.lastName,
        password: record.password,
        firstName: record.firstName,
        phoneNumber: record.phoneNumber,
        deviceId: record.deviceId,
        enableFaceId: record.enableFaceId,
        transactionPin: record.transactionPin,
        profileImageUrl: record.profileImageUrl,
        uniqueVerificationCode: record.uniqueVerificationCode,
        allowEmailNotifications: record.allowEmailNotifications,
        allowPushNotifications: record.allowPushNotifications,
        allowSmsNotifications: record.allowSmsNotifications,
        displayWalletBalance: record.displayWalletBalance,
      };
      await this.getRepo().update({ id: record.id }, updatedRecord);
      // this.eventEmitterSrv.emit('create-wallet', {
      //   userId: record.id,
      //   req,
      // });
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

  private async sendWelcomeEmail(userId: string, email: string): Promise<void> {
    try {
      const user = await this.findUserById(userId);
      if (user?.data?.email) {
        const today = new Date();
        const instagramUrl = String(process.env.INSTAGRAM_URL);
        const twitterUrl = String(process.env.TWITTER_URL);
        const facebookUrl = String(process.env.FACEBOOK_URL);
        const html = `<section style="background: white; color: black; font-size: 15px; font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif; display: flex; justify-content: center; margin: 0;">
        <div style="padding: 2rem; width: 80%;">
            <section style="text-align: center;">
                <div style="width: fit-content; margin: 20px 0px;display: inline-block;">
                    <img src="https://ik.imagekit.io/un0omayok/Logo%20animaion.png?updatedAt=1701281040423" alt="">
                </div>
            </section>
    
            <section style="width: 100%; height: auto; font-size: 18px; text-align: justify;">
                <p style="font-weight:300">Hi ${user.data.firstName},</p>
                <p style="font-weight:300">
                    Welcome to Spraay, where celebration meets convenience! I am Stephanie and I'm thrilled to have you onboard. 
                    Get ready to immerse yourself in the fun of virtual money spraying, seamless bill payments, and a host
                    of other exciting features designed to make your life more festive.
                </p>
                <p style="font-weight:300">
                    Here's a quick guide to get started:
                </p>
                <ul>
                    <li>
                       <p style="font-weight:300">
                        <b>Spray at Events: </b> Easily manage your bills nd stay connected
                        with the convenience of Spraay App.
                       </p>
                    </li>
                    <li>
                        <p style="font-weight:300">
                         <b>Bill Payments: </b> Join events, celebrate, and spray
                         virtual cash in a joyous digital tradition.
                        </p>
                    </li>
                    <li>
                        <p style="font-weight:300">
                         <b>Peer-to-Peer Gifting: </b> Spread the love by spreading cash
                         gifts to friends and family with a simple swipe.
                        </p>
                    </li>
                </ul>
                <p style="font-weight:300">
                    Feel the thrill of celebration anytime anywhere. If you have any questions
                    or need our assistance our support team is just a message away.
                </p>
                <p style="font-weight:300">Best regards,</p>
                <p style="font-weight:300">Stephanie</p>
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
                <p style="font-weight: 400;">Spraay &copy;${today.getFullYear()}</p>
                <p style="font-weight: 400;">Click here to <a href="#" style="color: #5B45FF;">Unsubscribe</a></p>
            </section>
        </div>
          </section>
        `;
        await sendEmail(html, 'Welcome to Spraay', [email]);
      }
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  private async sendEmailAfterPasswordChange(userId: string): Promise<void> {
    try {
      const user = await this.findUserById(userId);
      const instagramUrl = String(process.env.INSTAGRAM_URL);
      const twitterUrl = String(process.env.TWITTER_URL);
      const facebookUrl = String(process.env.FACEBOOK_URL);
      const today = new Date();
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
                 This is to confirm that your Spraay App password has been successfully 
                 reset.
              </p>
              <p style="font-weight:300">
                  If you did not initiate this, please contact our 
                  <span style="font-weight: 400;">
                      <a href="mailto:hello@spraay.ng" style="color: inherit;">support team.</a>
                  </span>
              </p>
  
              <p style="font-weight:300">
                  Thank you for choosing Spraay App.
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
              <p style="font-weight: 400;">Spraay &copy;${today.getFullYear()}</p>
              <p style="font-weight: 400;">Click here to <a href="#" style="color: #5B45FF;">Unsubscribe</a></p>
          </section>
      </div>
      </section>`;
      await sendEmail(html, 'Spraay Password Change', [user.data.email]);
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async creditUserWallet(
    payload: CreditUserWalletDTO,
  ): Promise<BaseResponseTypeDTO> {
    try {
      checkForRequiredFields(['amount', 'userId'], payload);
      validateUUIDField(payload.userId, 'userId');
      const user = await this.findUserById(payload.userId);
      const newBalance =
        Number(user.data.walletBalance) + Number(payload.amount);
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

  async debitUserWallet(
    payload: CreditUserWalletDTO,
  ): Promise<BaseResponseTypeDTO> {
    try {
      checkForRequiredFields(['amount', 'userId'], payload);
      validateUUIDField(payload.userId, 'userId');
      const user = await this.findUserById(payload.userId);
      if (payload.amount <= user.data.walletBalance) {
        const newBalance =
          Number(user.data.walletBalance) - Number(payload.amount);
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

  private async afterSignup(user: User): Promise<void> {
    try {
      if (user.email) {
        const instagramUrl = String(process.env.INSTAGRAM_URL);
        const twitterUrl = String(process.env.TWITTER_URL);
        const facebookUrl = String(process.env.FACEBOOK_URL);
        const today = new Date();
        const htmlEmailTemplate = `
        <section style="background: white; color: black; font-size: 15px; font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif; display: flex; justify-content: center; margin: 0;">
        <div style="padding: 2rem; width: 80%;">
            <section style="text-align: center;">
                <div style="width: fit-content; margin: 20px 0px;display: inline-block;">
                    <img src="https://ik.imagekit.io/un0omayok/Logo%20animaion.png?updatedAt=1701281040423" alt="">
                </div>
            </section>
    
            <section style="width: 100%; height: auto; font-size: 18px; text-align: justify;">
                <p style="font-weight:300">Hi ${user.firstName},</p>
                <p style="font-weight:300">
                  Thank you for joining Spraay!
                </p>
                <p style="font-weight:300">
                    To complete your registration, please use the following OTP code within 
                    the next 5 minutes.
                </p>
                <h1 style="text-align: center; font-size: 50px;">
                  ${user.uniqueVerificationCode}
                </h1>
                <p style="font-weight:300">
                  Welcome to Spraay App!
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
                <p style="font-weight: 400;">Spraay &copy;${today.getFullYear()}</p>
                <p style="font-weight: 400;">Click here to <a href="#" style="color: #5B45FF;">Unsubscribe</a></p>
            </section>
        </div>
        </section>
      `;
        await sendEmail(htmlEmailTemplate, 'Verify Account', [user.email]);
      }
      if (user.phoneNumber) {
        const code = user.uniqueVerificationCode;
        const message = `Please use this OTP to validate your Spraay account: ${code}`;
        // await sendSMS(message, [user.phoneNumber], 'Verify Account');
      }
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  // private async resolveUserBvn(
  //   bvn: string,
  //   userId: string,
  // ): Promise<FincraBVNValidationResponseDTO> {
  //   try {
  //     checkForRequiredFields(['bvn', 'userId'], { bvn, userId });
  //     validateBvn(bvn, 'bvn');
  //     validateUUIDField(userId, 'userId');
  //     const user = await this.getRepo().findOne({
  //       where: { id: userId },
  //       select: ['id', 'firstName', 'lastName', 'dob'],
  //     });
  //     if (user?.id) {
  //       const dobDate = user.dob ? new Date(user.dob) : new Date();
  //       const dob = `${addLeadingZeroes(dobDate.getDate())}-${addLeadingZeroes(
  //         dobDate.getMonth() + 1,
  //       )}-${dobDate.getFullYear()}`;
  //       const url = `https://vapi.verifyme.ng/v1/verifications/identities/bvn/${bvn}`;
  //       const verifyMeResponse = await httpPost<any, any>(
  //         url,
  //         {
  //           firstname: user.firstName ?? 'String',
  //           lastname: user.lastName ?? 'String',
  //           dob,
  //         },
  //         {
  //           Authorization: `Bearer ${String(process.env.VERIFY_ME_SECRET_KEY)}`,
  //         },
  //       );
  //       if (verifyMeResponse?.status === 'success') {
  //         const photo = `data:image/png;base64,${verifyMeResponse.data.photo}`;
  //         const localUrl = base64ToPNG(photo);
  //         const url = await uploadFileToImageKit(localUrl);
  //         return {
  //           success: true,
  //           message: verifyMeResponse.status,
  //           data: {
  //             gender: verifyMeResponse.data.gender,
  //             phoneNo: verifyMeResponse.data.phone,
  //             dateOfBirth: verifyMeResponse.data.birthdate,
  //             middleName: verifyMeResponse.data.middlename,
  //             firstName: verifyMeResponse.data.firstname,
  //             lastName: verifyMeResponse.data.lastname,
  //             pixBase64: url,
  //           },
  //         };
  //       }
  //     }
  //   } catch (ex) {
  //     this.logger.error(ex);
  //     if (String(ex).includes('status code 404')) {
  //       throw new NotFoundException('BVN not found');
  //     }
  //     throw ex;
  //   }
  // }

  async resolveUserBvnDojah(query: GetBvnAdvancedDto): Promise<any> {
    const appId = process.env.DOJAH_APP_ID; // AppId from the environment
    const secretKey = process.env.DOJAH_SECRETE_API_KEY; // Authorization key
    try {
      const { bvn } = query;
      const url = `${this.DojahbaseUrl}/api/v1/kyc/bvn/advance?bvn=${bvn}`;

      const headers = {
        AppId: appId,
        Authorization: `${secretKey}`,
      };

      const response = await axios.get(url, { headers });
      return response.data;
    } catch (error) {
      console.log(error);
      if (error.response) {
        throw new HttpException(
          `Failed to fetch BVN details: ${error.response.data.message}`,
          error.response.status,
        );
      } else {
        throw new HttpException(
          `Failed to fetch BVN details: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }

  async checkLiveness(dto: LivenessCheckDto): Promise<any> {
    const imageBuffer = await this.fetchImage(dto.url);
    const base64Image = imageBuffer.toString('base64');
    const response = await axios.post(
      `${this.DojahbaseUrl}/api/v1/ml/liveness/`,
      { image: base64Image },
      {
        headers: {
          'Content-Type': 'application/json',
          AppId: process.env.DOJAH_APP_ID,
          Authorization: `${process.env.DOJAH_SECRETE_API_KEY}`,
        },
      },
    );

    if (response.data.entity.liveness.liveness_probability < 50) {
      throw new BadRequestException('Your selfie is not live');
    }
    return response.data;
  }

  private async fetchImage(url: string): Promise<Buffer> {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data, 'binary');
  }

  async verifyBvnWithSelfie(
    userid: string,
    bvn: string,
    selfieImageUrl: string,
    req: Request,
  ): Promise<any> {
    const record = await this.findOne({ id: userid });
    if (!record?.id) {
      throw new NotFoundException('User with id not found');
    }
    ///////////////////////////////MATCHING BVN WITH ACCOUNT DETAILS BEFORE CREATING  VIRTUAL ACCOUNT//////////////
    ///////////////////////////////MATCHING BVN WITH ACCOUNT DETAILS BEFORE CREATING  VIRTUAL ACCOUNT//////////////
    ///////////////////////////////MATCHING BVN WITH ACCOUNT DETAILS BEFORE CREATING  VIRTUAL ACCOUNT//////////////
    ///////////////////////////////MATCHING BVN WITH ACCOUNT DETAILS BEFORE CREATING  VIRTUAL ACCOUNT//////////////
    if (bvn && record.bvn !== bvn && bvn != '' && bvn != ' ') {
      validateBvn(bvn, 'bvn');
      const recordExists = await this.findOne({ bvn: bvn });
      if (recordExists?.id) {
        let message = 'This BVN is already registered';
        if (recordExists.bvn === bvn) {
          message = 'This BVN is already registered';
        }
        throw new ConflictException(message);
      }

      const bvnValidationResponse = await this.resolveUserBvnDojah(
        { bvn: bvn },
        // record.id,
      );
      // console.log(bvnValidationResponse)
      if (bvnValidationResponse.entity.bvn === bvn) {
        // Check if the first name matches
        const firstNameMatches =
          bvnValidationResponse.entity.first_name.toLowerCase().trim() ===
          record.firstName.toLowerCase().trim();

        // Check if the last name matches the middle name
        const middleNameMatchesLastName =
          bvnValidationResponse.entity.middle_name.toLowerCase().trim() ===
          record.lastName.toLowerCase().trim();

        // Check if the first name matches the surname
        const surnameMatchesFirstName =
          bvnValidationResponse.entity.last_name.toLowerCase().trim() ===
          record.firstName.toLowerCase().trim();

        // Only proceed if any of the above conditions are true
        if (
          firstNameMatches ||
          middleNameMatchesLastName ||
          surnameMatchesFirstName
        ) {
          // If no virtual account number exists, emit the event to create one
          const updatedRecord: Partial<User> = {
            bvn: record.bvn,
            dob: record.dob,
            gender: record.gender,
            email: record.email,
            status: record.status,
            userTag: record.userTag,
            Freeze: record.Freeze,
            lastName: record.lastName,
            password: record.password,
            firstName: record.firstName,
            phoneNumber: record.phoneNumber,
            deviceId: record.deviceId,
            enableFaceId: record.enableFaceId,
            transactionPin: record.transactionPin,
            profileImageUrl: record.profileImageUrl,
            uniqueVerificationCode: record.uniqueVerificationCode,
            allowEmailNotifications: record.allowEmailNotifications,
            allowPushNotifications: record.allowPushNotifications,
            allowSmsNotifications: record.allowSmsNotifications,
            displayWalletBalance: record.displayWalletBalance,
          };
          await this.getRepo().update({ id: record.id }, updatedRecord);
          // if (!record.virtualAccountNumber) {
          //   this.eventEmitterSrv.emit('create-wallet', {
          //     userId: record.id,
          //     req,
          //   });
          // }
        } else {
          // Throw an error if none of the names match
          throw new BadRequestException(
            `BVN verification failed or details do not match`,
          );
        }
      } else {
        // Throw an error if BVN verification was not successful
        throw new BadRequestException('BVN verification failed.');
      }
    }
    await this.checkLiveness({ url: selfieImageUrl });
    try {
      // Download and convert the image from URL to base64
      const base64Image = await this.convertImageUrlToBase64(selfieImageUrl);

      // Remove the data:image/jpeg;base64, prefix if it exists
      const cleanedBase64Image = base64Image.replace(
        /^data:image\/\w+;base64,/,
        '',
      );

      const response: AxiosResponse<any> = await axios({
        method: 'post',
        url: `${this.DojahbaseUrl}/api/v1/kyc/bvn/verify`,
        headers: {
          'Content-Type': 'application/json',
          AppId: process.env.DOJAH_APP_ID,
          Authorization: `${process.env.DOJAH_SECRETE_API_KEY}`,
        },
        data: {
          bvn: bvn,
          selfie_image: cleanedBase64Image,
        },
      });

      if (response.data.entity.selfie_verification.confidence_value < 90) {
        throw new BadRequestException('invalid details');
      }

      const updatedRecord: Partial<User> = {
        isBvnVerified: true,
        isFaceMatchingVerifiedBvn: true,
      };
      await this.getRepo().update({ id: record.id }, updatedRecord);

      if (!record.virtualAccountNumber) {
        this.eventEmitterSrv.emit('create-wallet', {
          userId: record.id,
          req,
        });
      }

      return response.data;
    } catch (error) {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        throw new HttpException(
          {
            message:
              error.response.data.message || 'Error verifying BVN with selfie',
            status: error.response.status,
            data: error.response.data,
          },
          error.response.status,
        );
      } else if (error.request) {
        // The request was made but no response was received
        throw new HttpException(
          {
            message: 'No response received from verification service',
            status: HttpStatus.SERVICE_UNAVAILABLE,
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      } else {
        // Something happened in setting up the request that triggered an Error
        throw new HttpException(
          {
            message: `Error setting up verification request: ${error.message}`,
            status: HttpStatus.INTERNAL_SERVER_ERROR,
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }

  /**
   * Helper function to convert an image URL to base64 string
   * @param imageUrl URL of the image to convert
   * @returns Base64 encoded image string
   */
  private async convertImageUrlToBase64(imageUrl: string): Promise<string> {
    try {
      // Download the image
      const response = await axios({
        method: 'get',
        url: imageUrl,
        responseType: 'arraybuffer',
      });

      // Convert the image to base64
      const base64 = Buffer.from(response.data, 'binary').toString('base64');

      // Determine the MIME type based on the URL or response headers
      const contentType =
        response.headers['content-type'] || this.getMimeTypeFromUrl(imageUrl);

      // Return the complete base64 image string
      return `data:${contentType};base64,${base64}`;
    } catch (error) {
      throw new HttpException(
        {
          message: `Failed to convert image URL to base64: ${error.message}`,
          status: HttpStatus.BAD_REQUEST,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Helper function to determine MIME type from URL
   * @param url Image URL
   * @returns MIME type string
   */
  private getMimeTypeFromUrl(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      default:
        return 'image/jpeg'; // Default to JPEG if unknown
    }
  }

  /**
   * Helper function to validate BVN format
   * @param bvn BVN to validate
   * @returns true if valid, false otherwise
   */
  private isValidBvn(bvn: string): boolean {
    // BVN should be exactly 11 digits
    return /^\d{11}$/.test(bvn);
  }

  private async resolveUserBvn(
    bvn: string,
    userId: string,
    env = 'PROD',
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
        const axiosResponse = await axios.post(
          url,
          {
            id: bvn,
            isSubjectConsent: true,
          },
          { headers: { token: String(process.env.YOU_VERIFY_SECRET_KEY) } },
        );
        const youVerifyResponse = axiosResponse.data;
        if (youVerifyResponse.success) {
          const photo = String(youVerifyResponse.data.image);
          const localUrl = base64ToJPEG(photo);
          const url = await uploadFileToImageKit(localUrl);
          return {
            success: true,
            message: youVerifyResponse.message,
            data: {
              pixBase64: url,
              gender: youVerifyResponse.data?.gender,
              phoneNo: youVerifyResponse.data.mobile,
              dateOfBirth: youVerifyResponse.data.dateOfBirth,
              middleName: youVerifyResponse.data?.middleName,
              firstName: youVerifyResponse.data.firstName,
              lastName: youVerifyResponse.data.lastName,
            },
          };
        }
        throw new NotFoundException('Invalid, Could not validate bvn');
      }
    } catch (ex: any) {
      if (ex instanceof AxiosError) {
        const errorObject = ex.response?.data;
        this.logger.error(errorObject.message);
        throw new HttpException(errorObject.message, errorObject.statusCode);
      } else {
        if (
          String(ex).includes('status code 403') ||
          String(ex).includes('status code 404')
        ) {
          throw new NotFoundException('BVN not found');
        }
      }
      throw ex;
    }
  }

  // async getAllUsers(page: number, limit: number): Promise<{ success: boolean; message: string; code: number; data: { users: User[]; totalCount: number } }> {
  //   try {
  //     const skip = (page - 1) * limit;
  //     const [users, totalCount] = await this.userRepository.findAndCount({
  //       skip,
  //       take: limit,
  //     });
  //     return {
  //       success: true,
  //       message: 'Users retrieved successfully',
  //       code: HttpStatus.OK,
  //       data: { users, totalCount },
  //     };
  //   } catch (error) {
  //     console.error('Error in getAllUsers:', error);
  //     return {
  //       success: false,
  //       message: 'Failed to retrieve users',
  //       code: HttpStatus.INTERNAL_SERVER_ERROR,
  //       error: error.message,
  //     };
  //   }
  // }

  async getAllUsers(
    page: number,
    limit: number,
  ): Promise<{
    success: boolean;
    message: string;
    error?: string;
    code: number;
    data: { users: User[]; totalCount: number };
  }> {
    try {
      const skip = (page - 1) * limit;
      const [users, totalCount] = await this.getRepo().findAndCount({
        skip,
        take: limit,
      });
      return {
        success: true,
        message: 'Users retrieved successfully',
        code: HttpStatus.OK,
        data: { users, totalCount },
      };
    } catch (error) {
      console.error('Error in getAllUsers:', error);
      new NotFoundException('Users not found');
    }
  }

  async createAdminAndEmployees(createUserDto: CreateAdminDto): Promise<User> {
    checkForRequiredFields(['email', 'password'], createUserDto);
    validateEmailField(createUserDto.email);

    const existingUser = await this.getRepo().findOne({
      where: { email: createUserDto.email.toUpperCase() },
    });
    if (existingUser) {
      throw new NotFoundException('User with this email already exists');
    }

    // const hashedPassword = await hashPassword(createUserDto.password);
    const newUser = this.getRepo().create({
      gender: createUserDto.gender,
      email: createUserDto.email.toUpperCase(),
      lastName: createUserDto.lastName,
      password: createUserDto.password,
      firstName: createUserDto.firstName,
      role: AppRole.ADMIN,
      profileImageUrl: createUserDto.profileImageUrl,
    });

    return this.getRepo().save(newUser);
  }

  // async getTotalUsersByIsNewUser(): Promise<{ activeUsers: number; inactiveUsers: number  }> {
  //   const isNewUserTrueCount = await this.getRepo().count({ where: { isNewUser: true } });
  //   const isNewUserFalseCount = await this.getRepo().count({ where: { isNewUser: false } });

  //   return { activeUsers: isNewUserTrueCount, inactiveUsers: isNewUserFalseCount };
  // }

  async getTotalUsersByIsNewUserWithPercentage(): Promise<{
    activeUsers: number;
    activeUsersPercentage: number;
    inactiveUsers: number;
    inactiveUsersPercentage: number;
  }> {
    const isNewUserTrueCount = await this.getRepo().count({
      where: { status: true },
    });
    const isNewUserFalseCount = await this.getRepo().count({
      where: { status: false },
    });
    const totalUsersCount = isNewUserTrueCount + isNewUserFalseCount;

    const activeUsersPercentage =
      totalUsersCount !== 0 ? (isNewUserTrueCount / totalUsersCount) * 100 : 0;
    const inactiveUsersPercentage =
      totalUsersCount !== 0 ? (isNewUserFalseCount / totalUsersCount) * 100 : 0;

    return {
      activeUsers: isNewUserTrueCount,
      activeUsersPercentage,
      inactiveUsers: isNewUserFalseCount,
      inactiveUsersPercentage,
    };
  }

  async getAdminUsers(): Promise<User[]> {
    return await this.getRepo().find({
      where: { role: AppRole.ADMIN },
    });
  }

  async findUsersByWildcard(searchTerm: string): Promise<User[]> {
    const queryBuilder = this.getRepo().createQueryBuilder('user');

    queryBuilder.where(
      '(UPPER(user.firstName) LIKE UPPER(:searchTerm) OR UPPER(user.lastName) LIKE UPPER(:searchTerm) OR UPPER(user.email) LIKE UPPER(:searchTerm))',
      { searchTerm: `%${searchTerm}%` },
    );

    return await queryBuilder.getMany();
  }

  async searchUsers(query: string): Promise<User[]> {
    return await this.getRepo()
      .createQueryBuilder('user')
      .where('user.firstName LIKE :query', { query: `%${query}%` })
      .orWhere('user.lastName LIKE :query', { query: `%${query}%` })
      .orWhere('user.email LIKE :query', { query: `%${query}%` })
      .getMany();
  }

  async findUserByEmail(email: string): Promise<User> {
    const user = await this.getRepo().findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }
    return user;
  }

  async incrementUserBalance(email: string, amount: number): Promise<User> {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than zero');
    }
    const user = await this.findUserByEmail(email);
    user.walletBalance += amount;
    return this.getRepo().save(user);
  }
  async findUserByPhoneNumber(phoneNumber: string): Promise<User> {
    const user = await this.getRepo().findOne({ where: { phoneNumber } });
    if (!user) {
      throw new NotFoundException(
        `User with phone number ${phoneNumber} not found`,
      );
    }
    return user;
  }

  // async deleteUserByPhoneNumber(phoneNumber: string): Promise<{ message: string }> {
  //   const user = await this.findUserByPhoneNumber(phoneNumber);
  //   await this.getRepo().remove(user);
  //   return { message: `User with phone number ${phoneNumber} has been deleted` };
  // }

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
      this.logger.error(ex);
      throw ex;
    }
  }
}
