import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, RolesGuard } from '@schematics/index';
import {
  DecodedTokenKey,
  BaseResponseTypeDTO,
  PaginationRequestType,
} from '@utils/index';
import { AuthResponseDTO } from '@modules/auth/dto/auth.dto';
import {
  ChangePasswordDTO,
  CreateUserEmailDTO,
  CreateUserPhoneNumberDTO,
  UpdatePasswordDTO,
  UserResponseDTO,
  UsersResponseDTO,
  UpdateUserDTO,
} from './dto/user.dto';
import { UserService } from './user.service';

@ApiTags('user')
@Controller('user')
export class UserController {
  constructor(private readonly userSrv: UserService) {}

  @ApiOperation({ description: 'Sign up with email and password' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: BaseResponseTypeDTO })
  @Post('/sign-up')
  async createUser(
    @Body() payload: CreateUserEmailDTO,
  ): Promise<AuthResponseDTO> {
    return await this.userSrv.createUser(payload);
  }

  @ApiOperation({ description: 'Sign up with phone-number and password' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: BaseResponseTypeDTO })
  @Post('/sign-up/phone-number')
  async createUserWithPhoneNumber(
    @Body() payload: CreateUserPhoneNumberDTO,
  ): Promise<AuthResponseDTO> {
    return await this.userSrv.createUser(payload, 'phoneNumber');
  }

  @ApiOperation({ description: 'Update user password' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: BaseResponseTypeDTO })
  @ApiBearerAuth('JWT')
  @UseGuards(RolesGuard)
  @Post('/change-account-password')
  async changeAccountPassword(
    @Body() payload: ChangePasswordDTO,
    @CurrentUser(DecodedTokenKey.USER_ID) userId: string,
  ): Promise<BaseResponseTypeDTO> {
    return await this.userSrv.changeAccountPassword(payload, userId);
  }

  @ApiOperation({ description: 'Find user by ID' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: UserResponseDTO })
  @Get('/:userId')
  async findUserById(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<UserResponseDTO> {
    return await this.userSrv.findUserById(userId);
  }

  @ApiOperation({ description: 'Find user by ID' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: UserResponseDTO })
  @ApiBearerAuth('JWT')
  @UseGuards(RolesGuard)
  @Get('/profile/by-token')
  async findUserProfile(
    @CurrentUser(DecodedTokenKey.USER_ID) userId: string,
  ): Promise<UserResponseDTO> {
    return await this.userSrv.findUserById(userId);
  }

  @ApiOperation({ description: 'Find all users' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: UsersResponseDTO })
  @Get()
  async findAllUsers(
    @Query() payload?: PaginationRequestType,
  ): Promise<UsersResponseDTO> {
    return await this.userSrv.findAllUsers(payload);
  }

  @ApiOperation({ description: 'Resend OTP after login' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: BaseResponseTypeDTO })
  @Get('/resend-otp-code/:userId')
  async resendOTPAfterLogin(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<BaseResponseTypeDTO> {
    return await this.userSrv.resendOTPAfterLogin(userId);
  }

  @ApiBearerAuth('JWT')
  @ApiOperation({ description: 'Verify user with unique-code after signup' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: BaseResponseTypeDTO })
  @UseGuards(RolesGuard)
  @Get('/verification/verify-signup-code/:uniqueVerificationCode')
  async verifyCodeAfterSignup(
    @CurrentUser(DecodedTokenKey.USER_ID) userId: string,
    @Param('uniqueVerificationCode') uniqueVerificationCode: string,
  ): Promise<BaseResponseTypeDTO> {
    return await this.userSrv.verifyCodeAfterSignup(
      uniqueVerificationCode,
      userId,
    );
  }

  @ApiOperation({ description: 'Initiate forgot-password flow' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: BaseResponseTypeDTO })
  @Get('/verification/initiate-forgot-password-flow/:email')
  async initiateForgotPasswordFlow(
    @Param('email') email: string,
  ): Promise<BaseResponseTypeDTO> {
    return await this.userSrv.initiateForgotPasswordFlow(email);
  }

  @ApiOperation({ description: 'Finalize forgot-password flow' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: BaseResponseTypeDTO })
  @Get('/verification/finalize-forgot-password-flow/:uniqueVerificationCode')
  async finalizeForgotPasswordFlow(
    @Param('uniqueVerificationCode') uniqueVerificationCode: string,
  ): Promise<BaseResponseTypeDTO> {
    return await this.userSrv.finalizeForgotPasswordFlow(
      uniqueVerificationCode,
    );
  }

  @ApiOperation({ description: 'Change password' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: BaseResponseTypeDTO })
  @Post('/verification/change-password')
  async changePassword(
    @Body() payload: UpdatePasswordDTO,
  ): Promise<BaseResponseTypeDTO> {
    return await this.userSrv.changePassword(payload);
  }

  @ApiOperation({ description: 'Update user account/profile' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: BaseResponseTypeDTO })
  @Patch()
  async updateUser(
    @Body() payload: UpdateUserDTO,
  ): Promise<BaseResponseTypeDTO> {
    return await this.userSrv.updateUser(payload);
  }

  @ApiOperation({ description: 'Delete user account' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: BaseResponseTypeDTO })
  @Delete('/:userId')
  async deleteUser(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<BaseResponseTypeDTO> {
    return await this.userSrv.deleteUser(userId);
  }

  @ApiOperation({ description: 'Delete user account by email' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: BaseResponseTypeDTO })
  @Delete('/delete-by-email/:email')
  async deleteUserByEmail(
    @Param('email') email: string,
  ): Promise<BaseResponseTypeDTO> {
    return await this.userSrv.deleteUserByEmail(email);
  }
}
