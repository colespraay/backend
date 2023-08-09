import { User } from '@entities/user.entity';
import { ApiProperty } from '@nestjs/swagger';
import { AppRole, AuthProvider } from '@utils/types/utils.constant';
import { BaseResponseTypeDTO } from '@utils/types/utils.types';

export class AuthResponse {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  email: string;

  @ApiProperty({
    enum: AppRole,
  })
  role: AppRole;

  @ApiProperty()
  dateCreated: Date;

  @ApiProperty()
  token: string;

  @ApiProperty()
  tokenInitializationDate: number;

  @ApiProperty()
  tokenExpiryDate: number;

  @ApiProperty({ type: User })
  user: User;
}

export class LoginUserDTO {
  @ApiProperty()
  email: string;

  @ApiProperty()
  password: string;
}

export class ThirdPartyLoginDTO {
  @ApiProperty({
    description:
      'UserId or any other unique identifier assigned by google or facebook',
  })
  thirdPartyUserId: string;

  @ApiProperty({ enum: AuthProvider })
  provider: AuthProvider;

  @ApiProperty({ nullable: true, description: 'Nullable' })
  profileImageUrl: string;
}

export class AuthResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty()
  data: AuthResponse;
}
