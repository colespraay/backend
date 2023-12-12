import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiOperation,
  ApiProduces,
  ApiConsumes,
  ApiResponse,
  ApiBearerAuth,
  ApiTags,
} from '@nestjs/swagger';
import { DecodeTokenGuard, CurrentUser } from '@schematics/index';
import { DecodedTokenKey } from '@utils/index';
import { AuthService } from './auth.service';
import {
  AuthResponseDTO,
  LoginPhoneUserDTO,
  LoginUserDTO,
  ThirdPartyLoginDTO,
} from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authSrv: AuthService) {}

  @ApiOperation({ description: 'Login with email and password' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: AuthResponseDTO })
  @Post('/login')
  async login(@Body() payload: LoginUserDTO): Promise<AuthResponseDTO> {
    return await this.authSrv.login(payload);
  }

  @ApiOperation({ description: 'Login with phone number and password' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: AuthResponseDTO })
  @Post('/login/phone-number')
  async loginWithPhone(
    @Body() payload: LoginPhoneUserDTO,
  ): Promise<AuthResponseDTO> {
    return await this.authSrv.loginWithPhone(payload);
  }

  @ApiOperation({
    description: `Login with Third-party, I.E Google/Facebook. 
      Pick json data returned to frontend client from either google and facebook, 
      and send to this endpoint for new jwt token to be generated`,
  })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: AuthResponseDTO })
  @Post('/login/third-party')
  async signUpOrLogin(
    @Body() payload: ThirdPartyLoginDTO,
  ): Promise<AuthResponseDTO> {
    return await this.authSrv.signUpOrLogin(payload);
  }

  @ApiBearerAuth('JWT')
  @ApiOperation({ description: 'Refresh token' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: AuthResponseDTO })
  @UseGuards(DecodeTokenGuard)
  @Get('/refresh-token')
  async refreshToken(
    @CurrentUser(DecodedTokenKey.USER_ID) userId: string,
  ): Promise<AuthResponseDTO> {
    return await this.authSrv.refreshToken(userId);
  }
}
