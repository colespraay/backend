import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { User } from '@entities/index';
import {
  AppRole,
  AuthProvider,
  BaseResponseTypeDTO,
  Gender,
  PaginationRequestType,
  PaginationResponseType,
} from '@utils/index';
import { IsEmail, IsEnum, IsNotEmpty, IsNumber, IsString, Length, Matches, Min } from 'class-validator';

export enum OTPMedium {
  PHONE_NUMBER = 'PHONE_NUMBER',
  EMAIL = 'EMAIL',
}

export class UserResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => User })
  data: User;
}

export class UsersResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => [User] })
  data: User[];

  @ApiProperty({ type: () => PaginationResponseType })
  paginationControl?: PaginationResponseType;
}
export class GetBvnAdvancedDto {
  @ApiProperty({ example: '12345678901', description: 'A valid BVN', required: true })
  bvn: string;
}

export class ChangePasswordDTO {
  @ApiProperty()
  currentPassword: string;

  @ApiProperty()
  newPassword: string;
}

export class CreateUserDTO {
  @ApiProperty()
  password: string;

  @ApiProperty({ nullable: true })
  email?: string;

  @ApiProperty({ nullable: true })
  phoneNumber?: string;

  @ApiProperty({
    nullable: true,
    description: 'Device Id of mobile devices used to send push notifications',
  })
  deviceId?: string;
}

export class CreateUserEmailDTO extends OmitType(CreateUserDTO, [
  'phoneNumber',
] as const) {}

export class CreateUserPhoneNumberDTO extends OmitType(CreateUserDTO, [
  'email',
] as const) {}

export class CreateCustomerDTO {
  @ApiProperty({ description: 'nullable' })
  email: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty({ description: 'nullable' })
  phoneNumber: string;

  @ApiProperty()
  password: string;

  @ApiProperty()
  bvn: string;
}

export class UpdateUserDTO extends PartialType(CreateUserDTO) {
  @ApiProperty()
  userId: string;

  @ApiProperty({ nullable: true })
  firstName?: string;

  @ApiProperty({ nullable: true })
  lastName?: string;

  @ApiProperty({ nullable: true })
  password?: string;

  @ApiProperty({ enum: Gender, nullable: true })
  gender?: Gender;

  @ApiProperty({ nullable: true })
  dob: Date;

  @ApiProperty({ nullable: true })
  userTag?: string;

  @ApiProperty({ nullable: true })
  Freeze: boolean;

  @ApiProperty({ nullable: true })
  bvn?: string;

  @ApiProperty({ nullable: true })
  transactionPin?: string;

  @ApiProperty({ nullable: true })
  profileImageUrl?: string;

  @ApiProperty({ nullable: true })
  uniqueVerificationCode?: string;

  @ApiProperty({ nullable: true })
  allowPushNotifications?: boolean;

  @ApiProperty({ nullable: true })
  allowSmsNotifications?: boolean;

  @ApiProperty({ nullable: true })
  allowEmailNotifications: boolean;

  @ApiProperty({ nullable: true })
  displayWalletBalance?: boolean;

  @ApiProperty({ nullable: true })
  enableFaceId?: boolean;

  @ApiProperty({ nullable: true })
  status?: boolean;
}

export class FilterUserDTO {
  @ApiProperty({ nullable: true })
  searchTerm: string;

  @ApiProperty({ enum: Gender, nullable: true })
  gender: Gender;

  @ApiProperty({ enum: AuthProvider, nullable: true })
  authProvider: AuthProvider;

  @ApiProperty({ enum: AppRole, nullable: true })
  role: AppRole;

  @ApiProperty({ nullable: true })
  isNewUser: boolean;

  @ApiProperty({ nullable: true })
  status: boolean;
}

export class UpdatePasswordDTO {
  @ApiProperty()
  uniqueVerificationCode: string;

  @ApiProperty()
  newPassword: string;
}

export class Data {
  @ApiProperty()
  firstName: string;

  @ApiProperty()
  middleName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  gender: string;

  @ApiProperty()
  dateOfBirth: string;

  @ApiProperty()
  phoneNo: string;

  @ApiProperty()
  pixBase64: string;
}

export class FincraBVNValidationResponseDTO {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty({ type: () => Data })
  data: Data;
}

export class ResendOTPPayloadDTO {
  @ApiProperty({ nullable: true })
  userId: string;

  @ApiProperty({ nullable: true })
  email: string;

  @ApiProperty({ nullable: true })
  phoneNumber: string;
}

export class GroupedUserListPartial {
  [key: string]: User[];
}

export class GroupedUserListDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: GroupedUserListPartial })
  data: GroupedUserListPartial;
}

export class CreditUserWalletDTO {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  amount: number;
}

export class AccountBalanceDTO extends OmitType(BaseResponseTypeDTO, [
  'data',
] as const) {
  currentBalance: number;
}

export class UserContactPartial {
  @ApiProperty()
  name: string;

  @ApiProperty()
  phoneNumber: string;
}

export class UserContactsDTO {
  @ApiProperty({ type: () => [UserContactPartial] })
  contacts: UserContactPartial[];
}

export class UserContactsQueryDTO extends PaginationRequestType {
  @ApiProperty({ nullable: true })
  searchTerm: string;
}

export class CreateAdminDto{
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  lastName: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  password: string;

  @ApiProperty({ enum: Gender })
  @IsEnum(Gender)
  gender: Gender;

  // @ApiProperty({ enum: AppRole })
  // @IsEnum(AppRole)
  // role: AppRole;

  @ApiProperty()
  @IsString()
  profileImageUrl: string;
}

export class LivenessCheckDto {
  @ApiProperty({
    description: 'URL of the image to check for liveness',
    example: 'https://example.com/image.jpg'
  })
  url: string;
}


export class IncrementBalanceDto {
  @ApiProperty({ description: 'Amount to increment the wallet balance', example: 1000 })
  @IsNumber()
  @Min(0, { message: 'Amount must be a positive number' })
  amount: number;
}

export class BvnSelfieVerificationDto {
  @ApiProperty()
  userId: string;
  
  @ApiProperty({
    description: 'A valid Bank Verification Number (BVN)',
    example: '12345678901',
    required: true
  })
  @IsString()
  @IsNotEmpty()
  @Length(11, 11, { message: 'BVN must be exactly 11 digits' })
  @Matches(/^\d{11}$/, { message: 'BVN must contain only numbers' })
  bvn: string;

  @ApiProperty({
    description: 'URL of the selfie image to be used for verification',
    example: 'https://example.com/user-selfie.jpg',
    required: true
  })
  @IsString()
  @IsNotEmpty({ message: 'Selfie image URL is required' })
  selfie_image_url: string;
}

export class SelfieVerification {
  @ApiProperty({
    description: 'Confidence value of the match (0-100%)',
    example: 99.99620056152344
  })
  confidence_value: number;

  @ApiProperty({
    description: 'Whether the selfie matches the BVN image (true if confidence > 90%)',
    example: true
  })
  match: boolean;
}

export class BvnVerificationResponseData {
  @ApiProperty({
    description: 'Bank Verification Number',
    example: '1234567890'
  })
  bvn: string;

  @ApiProperty({
    description: 'First name associated with the BVN',
    example: 'JOHN'
  })
  first_name: string;

  @ApiProperty({
    description: 'Middle name associated with the BVN',
    example: 'ANON'
  })
  middle_name: string;

  @ApiProperty({
    description: 'Last name associated with the BVN',
    example: 'DOE'
  })
  last_name: string;

  @ApiProperty({
    description: 'Date of birth',
    example: '01-January-1907'
  })
  date_of_birth: string;

  @ApiProperty({
    description: 'Primary phone number',
    example: '08103817187'
  })
  phone_number1: string;

  @ApiProperty({
    description: 'Secondary phone number',
    example: ''
  })
  phone_number2: string;

  @ApiProperty({
    description: 'Gender of the BVN holder',
    example: 'Male'
  })
  gender: string;

  @ApiProperty({
    description: 'Base64 image from BVN record',
    example: '/9j/4AAQSkZJRgABAgAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKD...'
  })
  image: string;

  @ApiProperty({
    description: 'Selfie verification result',
    type: SelfieVerification
  })
  selfie_verification: SelfieVerification;

  @ApiProperty({
    description: 'URL of the submitted selfie image',
    example: 'https://image-rekognitions.s3.amazonaws.com/bvn_n_selfie_172.jpg'
  })
  selfie_image_url: string;
}

export class BvnVerificationResponse {
  @ApiProperty({
    description: 'Verification response entity',
    type: BvnVerificationResponseData
  })
  entity: BvnVerificationResponseData;
}