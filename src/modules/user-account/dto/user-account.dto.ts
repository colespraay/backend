import { ApiProperty } from '@nestjs/swagger';
import { UserAccount } from '@entities/index';
import {
  BaseResponseTypeDTO,
  PaginationRequestType,
  PaginationResponseType,
} from '@utils/index';

export class CreateUserBankAccountDTO {
  @ApiProperty()
  bankCode: string;

  @ApiProperty()
  accountNumber: string;
}

export class UserAccountResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => UserAccount })
  data: UserAccount;
}

export class UserAccountsResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => [UserAccount] })
  data: UserAccount[];

  @ApiProperty({ type: () => PaginationResponseType })
  paginationControl?: PaginationResponseType;
}

export class FilterUserAccountsDTO extends PaginationRequestType {
  @ApiProperty()
  searchTerm: string;
}
