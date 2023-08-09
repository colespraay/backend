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
import { User } from '@entities/index';
import { GenericService } from '@schematics/index';
import {
  appendPrefixToString,
  calculatePaginationControls,
  checkForRequiredFields,
  generateUniqueCode,
  generateUniqueKey,
  hashPassword,
  sendEmail,
  Gender,
  compareEnumValueFields,
  validateEmailField,
  verifyPasswordHash,
  BaseResponseTypeDTO,
  PaginationRequestType,
  validateURLField,
} from '@utils/index';
import { FindManyOptions, Not } from 'typeorm';
import {
  ChangePasswordDTO,
  CreateUserDTO,
  UpdatePasswordDTO,
  UpdateUserDTO,
  UserResponseDTO,
  UsersResponseDTO,
} from './dto/user.dto';
import { AuthResponseDTO } from '@modules/auth/dto/auth.dto';
import { AuthService } from '../index';

@Injectable()
export class UserService extends GenericService(User) {
  constructor(
    @Inject(forwardRef(() => AuthService))
    private readonly authSrv: AuthService,
  ) {
    super();
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
        select: ['id'],
      });
      if (recordExists?.id) {
        let message = 'User with similar details already exists';
        if (recordExists.email === payload.email) {
          message = 'User with similar email already exists';
        }
        if (recordExists.phoneNumber === payload.phoneNumber) {
          message = 'User with similar phone-number already exists';
        }
        throw new ConflictException(message);
      }
      const verificationCode = generateUniqueKey(4);
      await this.create<Partial<User>>({
        ...payload,
        uniqueVerificationCode: verificationCode,
      });
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

  async resendOTPAfterLogin(userId: string): Promise<BaseResponseTypeDTO> {
    try {
      if (!userId) {
        throw new BadRequestException('Field userId is required');
      }
      const record = await this.findOne({ id: userId });
      if (!record?.id) {
        throw new NotFoundException();
      }
      let token = record.uniqueVerificationCode;
      if (!token) {
        token = generateUniqueCode();
        await this.getRepo().update(
          { id: record.id },
          { uniqueVerificationCode: token },
        );
      }
      const htmlEmailTemplate = `
          <h2>Please copy the code below to verify your account</h2>
          <h3>${token}</h3>
        `;
      await sendEmail(htmlEmailTemplate, 'Verify Account', [record.email]);
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Token has been resent',
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
      const userExists = await this.findOne({ email: email.toLowerCase() });
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

  async findAllUsers(
    payload?: PaginationRequestType,
  ): Promise<UsersResponseDTO> {
    try {
      if (payload?.pageNumber) {
        payload = {
          pageSize: parseInt(`${payload.pageSize}`),
          pageNumber: parseInt(`${payload.pageNumber}`),
        };

        const options: FindManyOptions<User> = {
          take: payload.pageSize,
          skip: (payload.pageNumber - 1) * payload.pageSize,
        };
        const { response, paginationControl } =
          await calculatePaginationControls<User>(
            this.getRepo(),
            options,
            payload,
          );
        return {
          success: true,
          message: 'Users found',
          code: HttpStatus.OK,
          data: response,
          paginationControl: paginationControl,
        };
      }
      const data = await this.findAll();
      return {
        code: HttpStatus.FOUND,
        data,
        message: 'Users found',
        success: true,
      };
    } catch (ex) {
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

  async updateUser(payload: UpdateUserDTO): Promise<BaseResponseTypeDTO> {
    try {
      checkForRequiredFields(['userId'], payload);
      const record = await this.findOne({ id: payload.userId });
      if (!record?.id) {
        throw new NotFoundException();
      }
      if ('status' in payload) {
        record.status = payload.status;
      }
      if (payload.email && payload.email !== record.email) {
        validateEmailField(payload.email);
        record.email = payload.email.toUpperCase();
      }
      if (payload.phoneNumber && payload.phoneNumber !== record.phoneNumber) {
        record.phoneNumber = payload.phoneNumber;
      }
      if (payload.firstName && payload.firstName !== record.firstName) {
        record.firstName = payload.firstName.toUpperCase();
      }
      if (payload.lastName && payload.lastName !== record.lastName) {
        record.lastName = payload.lastName.toUpperCase();
      }
      if (payload.gender && payload.gender !== record.gender) {
        compareEnumValueFields(payload.gender, Object.values(Gender), 'type');
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
          where: { userTag: tag, id: Not(payload.userId) },
          select: ['id'],
        });
        if (tagRecord?.id) {
          throw new ConflictException(
            `Another user currently owns tag: '${tag}'`,
          );
        }
        record.userTag = tag;
      }
      const updatedRecord: Partial<User> = {
        userTag: record.userTag,
        transactionPin: record.transactionPin,
        profileImageUrl: record.profileImageUrl,
        gender: record.gender,
        email: record.email,
        firstName: record.firstName,
        lastName: record.lastName,
        password: record.password,
        phoneNumber: record.phoneNumber,
        status: record.status,
      };
      await this.getRepo().update({ id: record.id }, updatedRecord);
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
}
