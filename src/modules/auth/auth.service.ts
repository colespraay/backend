import { UserService } from '@modules/user/user.service';
import {
  BadRequestException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  checkForRequiredFields,
  encryptData,
  validateEmailField,
} from '@utils/index';
import { sign, decode } from 'jsonwebtoken';
import { LoginUserDTO, AuthResponseDTO } from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger: Logger = new Logger(AuthService.name);

  constructor(private readonly userSrv: UserService) {}

  async login(payload: LoginUserDTO): Promise<AuthResponseDTO> {
    try {
      const user = await this.userSrv.findUserByEmailAndPassword(
        payload.email,
        payload.password,
      );
      if (user?.data.id) {
        const {
          data: { dateCreated, email, role, id },
        } = user;
        const payloadToSign = encryptData(
          JSON.stringify({
            user,
            dateCreated,
            email,
            role,
            id,
          }),
          process.env.ENCRYPTION_KEY,
        );
        const token = this.signPayload({ data: payloadToSign });
        const decodedToken: any = decode(token);
        const { exp, iat } = decodedToken;
        return {
          success: true,
          code: HttpStatus.OK,
          message: 'Logged in',
          data: {
            userId: id,
            role,
            email,
            user: user.data,
            dateCreated,
            token,
            tokenInitializationDate: iat,
            tokenExpiryDate: exp,
          },
        };
      }
      throw new BadRequestException('Bad credentials');
    } catch (ex) {
      this.logger.log(ex);
      throw ex;
    }
  }

  async refreshToken(userId: string): Promise<AuthResponseDTO> {
    try {
      if (!userId) {
        throw new BadRequestException('Field userId is required');
      }
      const payload = await this.userSrv
        .getRepo()
        .findOne({ where: { id: userId } });
      const { dateCreated, email, role, id } = payload;
      const encryptedTokenData = encryptData(
        JSON.stringify({
          dateCreated,
          email,
          role,
          id,
          user: payload,
        }),
        process.env.ENCRYPTION_KEY,
      );
      const token = this.signPayload(encryptedTokenData);
      const decodedToken: any = decode(token);
      const { exp, iat } = decodedToken;
      return {
        success: true,
        message: 'Token refreshed',
        code: HttpStatus.OK,
        data: {
          userId: id,
          role,
          email,
          dateCreated,
          token,
          tokenInitializationDate: iat,
          tokenExpiryDate: exp,
          user: payload,
        },
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  private signPayload<T>(payload: T): string {
    return sign({ payload }, process.env.JWT_SECRET, { expiresIn: '1d' });
  }
}
