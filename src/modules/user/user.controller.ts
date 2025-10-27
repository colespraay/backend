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
  ParseIntPipe,
  Req,
  HttpStatus,
  ValidationPipe,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, Roles, RolesGuard } from '@schematics/index';
import {
  DecodedTokenKey,
  BaseResponseTypeDTO,
  PaginationRequestType,
  AppRole,
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
  FilterUserDTO,
  OTPMedium,
  GroupedUserListDTO,
  AccountBalanceDTO,
  UserContactsDTO,
  UserContactsQueryDTO,
  GetBvnAdvancedDto,
  BvnSelfieVerificationDto,
  BvnVerificationResponse,
  LivenessCheckDto,
  IncrementBalanceDto,
} from './dto/user.dto';
import { UserService } from './user.service';
import { Request } from 'express';
import { User } from '@entities/user.entity';

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

  @UseGuards(RolesGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ description: 'Verify transaction pin' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: BaseResponseTypeDTO })
  @Get('/verify/transaction-pin/:pin')
  async verifyTransactionPin(
    @CurrentUser(DecodedTokenKey.USER_ID) userId: string,
    @Param('pin') pin: string,
  ): Promise<BaseResponseTypeDTO> {
    return await this.userSrv.verifyTransactionPin(userId, pin);
  }

  @UseGuards(RolesGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ description: 'Get user account balance' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: AccountBalanceDTO })
  @Get('/account/balance')
  async getAccountBalance(
    @CurrentUser(DecodedTokenKey.USER_ID) userId: string,
  ): Promise<AccountBalanceDTO> {
    return await this.userSrv.getAccountBalance(userId);
  }

  @UseGuards(RolesGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ description: 'Get user account balance before debit' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: AccountBalanceDTO })
  @Get('/account/check-balance-before-debit/:amount')
  async checkForPotentialBalance(
    @CurrentUser(DecodedTokenKey.USER_ID) userId: string,
    @Param('amount', ParseIntPipe) amount: number,
  ): Promise<AccountBalanceDTO> {
    return await this.userSrv.checkAccountBalance(amount, userId);
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

  @ApiOperation({ description: 'Find user by Tag' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: UserResponseDTO })
  @Get('/find-by-tag/:userTag')
  async findUserByUserTag(
    @Param('userTag') userTag: string,
  ): Promise<UserResponseDTO> {
    return await this.userSrv.findUserByUserTag(userTag);
  }

  @ApiOperation({ description: 'Group user list alphabetically' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: GroupedUserListDTO })
  @Get('/group/user-list/alphabetically')
  async groupUserList(): Promise<GroupedUserListDTO> {
    return await this.userSrv.groupUserList();
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

  @ApiQuery({ name: 'gender', required: false })
  @ApiQuery({ name: 'isNewUser', required: false })
  @ApiQuery({ name: 'role', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'authProvider', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'pageNumber', required: false })
  @ApiQuery({ name: 'searchTerm', required: false })
  @ApiOperation({ description: 'Find all users' })
  @ApiResponse({ type: UsersResponseDTO })
  @Get()
  async findUsers(
    @Query() payload: FilterUserDTO,
    @Query() pagination?: PaginationRequestType,
  ): Promise<UsersResponseDTO> {
    return await this.userSrv.findUsers(payload, pagination);
  }

  @Roles(AppRole.CUSTOMER)
  @UseGuards(RolesGuard)
  @ApiBearerAuth('JWT')
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'pageNumber', required: false })
  @ApiQuery({ name: 'searchTerm', required: false })
  @ApiOperation({ description: 'Find users and filter by contacts' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: UsersResponseDTO })
  @Post('/find-contacts/filtered-by-contacts')
  async findContactsFilteredByUserContacts(
    @Body() payload: UserContactsDTO,
    @Query() pagination?: UserContactsQueryDTO,
  ): Promise<UsersResponseDTO> {
    return await this.userSrv.findContactsFilteredByUserContacts(
      payload,
      pagination,
    );
  }

  @ApiOperation({ description: 'Resend OTP after login' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: BaseResponseTypeDTO })
  @Get('/resend-otp-code/:userId')
  async resendOTPAfterLogin(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<BaseResponseTypeDTO> {
    return await this.userSrv.resendOTPAfterLogin({ userId });
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

  @ApiOperation({
    description: 'Resend OTP after forgot password flow is initiated',
  })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: BaseResponseTypeDTO })
  @Get('verification/resend-otp-code/:email')
  async resendOTPOnForgotPassword(
    @Param('email') email: string,
  ): Promise<BaseResponseTypeDTO> {
    return await this.userSrv.resendOTPAfterLogin({ email }, OTPMedium.EMAIL);
  }

  @ApiOperation({
    description: 'Resend OTP after forgot password flow is initiated',
  })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: BaseResponseTypeDTO })
  @Get('verification/resend-otp-code/phone/:phoneNumber')
  async resendOTPOnForgotPasswordPhoneNumber(
    @Param('phoneNumber') phoneNumber: string,
  ): Promise<BaseResponseTypeDTO> {
    return await this.userSrv.resendOTPAfterLogin(
      { phoneNumber },
      OTPMedium.PHONE_NUMBER,
    );
  }

  @ApiOperation({ description: 'Used to verify OTP as valid' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: BaseResponseTypeDTO })
  @Get('/verification/verify-otp/:uniqueVerificationCode')
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
    @Req() req: Request,
  ): Promise<BaseResponseTypeDTO> {
    return await this.userSrv.updateUser(payload, req);
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



  @Get('user-wildcard-search/search')
  @ApiOperation({ summary: 'Search Users (Wildcard)' })
  @ApiResponse({ status: 200, type: [User] })
  async findUsersByWildcard(@Query('searchTerm') searchTerm: string) {
    try {
      const users = await this.userSrv.findUsersByWildcard(searchTerm);
      return users
    } catch (error) {
      throw error; // Re-throw for global error handling
    }
  }

  @Post('kyc/liveness/face-match/bvn/verify')
  // @ApiTags('Biometric Checks')
  // @ApiBearerAuth()
  @ApiOperation({
    summary: 'Verify BVN with Selfie Image',
    description: 
      'Lookup and verify a user\'s BVN with their selfie image. This endpoint helps reduce fraud by confirming ' +
      'the person inputting the BVN is who they claim to be. The confidence value ranges from 0% to 100%, ' +
      'where 0-90% indicates a false match and 90-100% indicates a true match.'
  })
  @ApiBody({
    type: BvnSelfieVerificationDto,
    description: 'BVN and selfie image URL data',
    examples: {
      example1: {
        summary: 'Verification Request Example',
        description: 'A request to verify BVN with selfie image URL',
        value: {
          userId:"67a0888aa2be4c3f68c3ccfa",
          bvn: '12345678901',
          selfie_image_url: 'https://example.com/user-selfie.jpg',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'BVN verified successfully',
    type: BvnVerificationResponse
  })
  async verifyBvnWithSelfie(
    @Body(new ValidationPipe({ transform: true })) verificationDto: BvnSelfieVerificationDto,
    @Req() req: Request,
  ): Promise<BvnVerificationResponse> {
    return this.userSrv.verifyBvnWithSelfie(
      verificationDto.userId,
      verificationDto.bvn, 
      verificationDto.selfie_image_url,
      req
    );
  }

  @Get('test/account/find-by-email')
  @ApiOperation({ summary: 'Find user by email' })
  @ApiResponse({ status: 200, description: 'User found', type: User })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findUserByEmail(@Query('email') email: string): Promise<User> {
    return this.userSrv.findUserByEmail(email);
  }

  // @Patch(':email/increment-balance/testbal')
  // @ApiOperation({ summary: 'Increment user wallet balance' })
  // @ApiParam({ name: 'email', type: 'string', description: 'User email' })
  // @ApiBody({ type: IncrementBalanceDto })
  // @ApiResponse({ status: 200, description: 'User balance updated', type: User })
  // async incrementBalance(
  //   @Param('email') email: string,
  //   @Body() incrementBalanceDto: IncrementBalanceDto,
  // ): Promise<User> {
  //   return this.userSrv.incrementUserBalance(email, incrementBalanceDto.amount);
  // }

  // @Get('testing/phone/:phoneNumber')
  // @ApiOperation({ summary: 'Find user by phone number' })
  // @ApiParam({ name: 'phoneNumber', type: 'string', description: 'User phone number' })
  // @ApiResponse({ status: 200, description: 'User found', type: User })
  // @ApiResponse({ status: 404, description: 'User not found' })
  // async getUserByPhoneNumber(@Param('phoneNumber') phoneNumber: string): Promise<User> {
  //   return this.userSrv.findUserByPhoneNumber(phoneNumber);
  // }


  @ApiOperation({ description: 'Delete user account by phone number' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: BaseResponseTypeDTO })
  @Delete('/delete-by-phone-number/:phoneNumber')
  async deleteUserByPhoneNumber(
    @Param('phoneNumber') phoneNumber: string,
  ): Promise<BaseResponseTypeDTO> {
    return await this.userSrv.deleteUserByPhoneNumber(phoneNumber);
  }


  @Delete('delete-non-admins/all')
   @ApiOperation({
    summary: 'Delete all non-admin users',
    description:
      'Deletes all user accounts except those with the role `ADMIN`. This operation is irreversible and should only be performed by administrators.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully deleted non-admin users.',
    type: BaseResponseTypeDTO,
    schema: {
      example: {
        code: 200,
        message: 'Successfully deleted 12 non-admin users',
        success: true,
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'An unexpected error occurred while deleting users.',
  })
  async deleteAllExceptAdmin(): Promise<BaseResponseTypeDTO> {
    return await this.userSrv.deleteAllExceptAdmin();
  }
}
