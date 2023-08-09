import { ApiProperty } from '@nestjs/swagger';
import { User } from '@entities/index';
import { AppRole, AuthProvider } from '@utils/index';
import { BaseResponseTypeDTO } from '@utils/index';

export class AuthResponse {
  @ApiProperty()
  userId: string;

  @ApiProperty({
    enum: AppRole,
  })
  role: AppRole;

  @ApiProperty()
  token: string;

  @ApiProperty({ type: User })
  user: User;
}

export class LoginUserDTO {
  @ApiProperty()
  email: string;

  @ApiProperty()
  password: string;
}

export class LoginPhoneUserDTO {
  @ApiProperty()
  phoneNumber: string;

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
