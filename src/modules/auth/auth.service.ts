import {
  Injectable,
  HttpStatus,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  AuthProvider,
  encryptData,
  validateEmailField,
  validateURLField,
  checkForRequiredFields,
  compareEnumValueFields,
  sendEmail,
} from '@utils/index';
import { User } from '@entities/index';
import { sign } from 'jsonwebtoken';
import { UserService } from '@modules/user/user.service';
import {
  LoginUserDTO,
  AuthResponseDTO,
  LoginPhoneUserDTO,
  ThirdPartyLoginDTO,
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
          data: {
            dateCreated,
            email,
            phoneNumber,
            role,
            id,
            virtualAccountName,
            virtualAccountNumber,
            bankName,
          },
        } = user;
        const payloadToSign = encryptData(
          JSON.stringify({
            user: user.data,
            dateCreated,
            email,
            phoneNumber,
            virtualAccountName,
            virtualAccountNumber,
            bankName,
            role,
            id,
          }),
          process.env.ENCRYPTION_KEY,
        );
        const token = this.signPayload({ data: payloadToSign });
        if (payload?.deviceId) {
          await this.userSrv
            .getRepo()
            .update({ id: user.data.id }, { deviceId: payload.deviceId });
        }
        await this.sendEmailAfterLogin(id);
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
      throw new NotFoundException('Invalid credentials');
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
          data: {
            dateCreated,
            email,
            phoneNumber,
            role,
            id,
            virtualAccountName,
            virtualAccountNumber,
            bankName,
          },
        } = user;
        const payloadToSign = encryptData(
          JSON.stringify({
            user: user.data,
            dateCreated,
            email,
            phoneNumber,
            virtualAccountName,
            virtualAccountNumber,
            bankName,
            role,
            id,
          }),
          process.env.ENCRYPTION_KEY,
        );
        const token = this.signPayload({ data: payloadToSign });
        if (payload?.deviceId) {
          await this.userSrv
            .getRepo()
            .update({ id: user.data.id }, { deviceId: payload.deviceId });
        }
        await this.sendEmailAfterLogin(id);
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
      throw new NotFoundException('Invalid credentials');
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
      const {
        dateCreated,
        email,
        phoneNumber,
        role,
        id,
        virtualAccountName,
        virtualAccountNumber,
        bankName,
      } = payload;
      const encryptedTokenData = encryptData(
        JSON.stringify({
          dateCreated,
          email,
          phoneNumber,
          virtualAccountName,
          virtualAccountNumber,
          bankName,
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

  async signUpOrLogin(payload: ThirdPartyLoginDTO): Promise<AuthResponseDTO> {
    try {
      checkForRequiredFields(['provider', 'thirdPartyUserId'], payload);
      compareEnumValueFields(
        payload.provider,
        Object.values(AuthProvider),
        'provider',
      );
      if (payload.provider === AuthProvider.LOCAL) {
        const message = `Cannot use local auth on this endpoint. Consider using '/auth/login' or '/auth/login/phone-number'`;
        throw new BadRequestException(message);
      }
      if (payload.email) {
        validateEmailField(payload.email);
      }
      if (payload.profileImageUrl) {
        validateURLField(payload.profileImageUrl, 'profileImageUrl');
      }
      let record = await this.userSrv.getRepo().findOne({
        where: { externalUserId: payload.thirdPartyUserId },
      });
      if (!record?.id) {
        record = await this.userSrv.create<Partial<User>>({
          email: payload.email,
          authProvider: payload.provider,
          phoneNumber: payload.phoneNumber,
          externalUserId: payload.thirdPartyUserId,
          profileImageUrl: payload.profileImageUrl,
        });
      }
      const {
        dateCreated,
        email,
        phoneNumber,
        role,
        id,
        virtualAccountName,
        virtualAccountNumber,
        bankName,
      } = record;
      const payloadToSign = encryptData(
        JSON.stringify({
          user: record,
          dateCreated,
          phoneNumber,
          virtualAccountName,
          virtualAccountNumber,
          bankName,
          email,
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
          user: record,
          role,
          token,
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

  private async sendEmailAfterLogin(userId: string): Promise<void> {
    try {
      const user = await this.userSrv.findUserById(userId);
      if (user.data?.email) {
        const instagramUrl = String(process.env.INSTAGRAM_URL);
        const twitterUrl = String(process.env.TWITTER_URL);
        const facebookUrl = String(process.env.FACEBOOK_URL);
        const today = new Date();
        const formattedDate = today.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        const hours = today.getHours();
        const minutes = today.getMinutes();
        const seconds = today.getSeconds();
        const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes
          .toString()
          .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        const html = `<section style="background: white; color: black; font-size: 15px; font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif; display: flex; justify-content: center; margin: 0;">
          <div style="padding: 2rem; width: 80%;">
              <section style="text-align: center;">
                  <div style="text-align:center; width: fit-content; margin: 20px 0px;display: inline-block">
                      <img src="https://ik.imagekit.io/un0omayok/Logo%20animaion.png?updatedAt=1701281040423" alt="">
                  </div>
              </section>
      
              <section style="width: 100%; height: auto; font-size: 18px; text-align: justify;">
                  <p style="font-weight:300">Hi ${user.data.firstName},</p>
                  <p style="font-weight:300">Please be informed that your spraay app was accessed on <span style="font-weight: 400;">${formattedDate} at ${formattedTime}</span></p>
                  <p style="font-weight:300">
                      If you did not logon to your account at the time detailed above, please call our contact centre on
                      <span style="font-weight: 400;">
                        <a href="tel:070 3000000" style="color: inherit;">070 3000000,</a> 
                        <a href="tel:+234 1-2712005-7" style="color: inherit;">+234 1-2712005-7</a></span>, or send an email to
                      <span style="font-weight: 400;">
                        <a href="mailto:hello@spraay.ng" style="color: inherit;">hello@spraay.ng</a>
                      </span>
                  </p>
                  <p style="font-weight:300">Thank you for choosing spray</p>
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
        await sendEmail(html, 'Spraay app login', [user.data.email]);
      }
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }
}
