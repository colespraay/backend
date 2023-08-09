import { ApiProperty, PartialType } from '@nestjs/swagger';
import { User } from '@entities/user.entity';
import { AppRole } from '@utils/types/utils.constant';
import {
  BaseResponseTypeDTO,
  PaginationResponseType,
} from '@utils/types/utils.types';

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

  @ApiProperty({ enum: AppRole })
  role: AppRole;

  @ApiProperty()
  email: string;

  @ApiProperty()
  phoneNumber: string;
}

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
  profileImage?: string;

  @ApiProperty({ nullable: true })
  status?: boolean;
}

export class UpdatePasswordDTO {
  @ApiProperty()
  uniqueVerificationCode: string;

  @ApiProperty()
  newPassword: string;
}
