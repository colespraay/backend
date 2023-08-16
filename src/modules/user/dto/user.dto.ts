import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { User } from '@entities/index';
import {
  BaseResponseTypeDTO,
  Gender,
  PaginationResponseType,
} from '@utils/index';

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
  userTag?: string;

  @ApiProperty({ nullable: true })
  bvn?: string;

  @ApiProperty({ nullable: true })
  transactionPin?: string;

  @ApiProperty({ nullable: true })
  profileImageUrl?: string;

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
