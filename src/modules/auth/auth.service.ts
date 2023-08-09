import { UserService } from '@modules/user/user.service';
import {
  Injectable,
  BadRequestException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  checkForRequiredFields,
  encryptData,
  validateEmailField,
} from '@utils/index';
import { sign } from 'jsonwebtoken';
import {
  LoginUserDTO,
  AuthResponseDTO,
  LoginPhoneUserDTO,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger: Logger = new Logger(AuthService.name);

  constructor(private readonly userSrv: UserService) {}

  async login(payload: LoginUserDTO): Promise<AuthResponseDTO> {
    try {
      checkForRequiredFields(['email', 'password'], payload);
      validateEmailField(payload.email);
      const user = await this.userSrv.findUserByEmailAndPassword(
        payload.email,
        payload.password,
      );
      if (user?.data.id) {
        const {
          data: { dateCreated, email, phoneNumber, role, id },
        } = user;
        const payloadToSign = encryptData(
          JSON.stringify({
            user: user.data,
            dateCreated,
            email,
            phoneNumber,
            role,
            id,
          }),
          process.env.ENCRYPTION_KEY,
        );
        const token = this.signPayload({ data: payloadToSign });
        return {
          success: true,
          code: HttpStatus.OK,
          message: 'Logged in',
          data: {
            userId: id,
            role,
            user: user.data,
            token,
          },
        };
      }
      throw new BadRequestException('Invalid credentials');
    } catch (ex) {
      this.logger.log(ex);
      throw ex;
    }
  }

  async loginWithPhone(payload: LoginPhoneUserDTO): Promise<AuthResponseDTO> {
    try {
      checkForRequiredFields(['phoneNumber', 'password'], payload);
      const user = await this.userSrv.findUserByPhoneNumberAndPassword(
        payload.phoneNumber,
        payload.password,
      );
      if (user?.data.id) {
        const {
          data: { dateCreated, email, phoneNumber, role, id },
        } = user;
        const payloadToSign = encryptData(
          JSON.stringify({
            user: user.data,
            dateCreated,
            email,
            phoneNumber,
            role,
            id,
          }),
          process.env.ENCRYPTION_KEY,
        );
        const token = this.signPayload({ data: payloadToSign });
        return {
          success: true,
          code: HttpStatus.OK,
          message: 'Logged in',
          data: {
            userId: id,
            role,
            user: user.data,
            token,
          },
        };
      }
      throw new BadRequestException('Invalid credentials');
    } catch (ex) {
      this.logger.log(ex);
      throw ex;
    }
  }

  async refreshToken(userId: string): Promise<AuthResponseDTO> {
    try {
      checkForRequiredFields(['userId'], { userId });
      const payload = await this.userSrv
        .getRepo()
        .findOne({ where: { id: userId } });
      const { dateCreated, email, phoneNumber, role, id } = payload;
      const encryptedTokenData = encryptData(
        JSON.stringify({
          dateCreated,
          email,
          phoneNumber,
          role,
          id,
          user: payload,
        }),
        process.env.ENCRYPTION_KEY,
      );
      const token = this.signPayload({ data: encryptedTokenData });
      return {
        success: true,
        message: 'Token refreshed',
        code: HttpStatus.OK,
        data: {
          userId: id,
          role,
          token,
          user: payload,
        },
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  private signPayload<T>(payload: T): string {
    return sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });
  }
}
