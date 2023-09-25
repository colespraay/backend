import { Get, Param, Query, Controller, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, RolesGuard } from '@schematics/index';
import { DecodedTokenKey } from '@utils/index';
import { UserAccountService } from './user-account.service';
import {
  FilterUserAccountsDTO,
  UserAccountResponseDTO,
  UserAccountsResponseDTO,
} from './dto/user-account.dto';

@UseGuards(RolesGuard)
@ApiBearerAuth('JWT')
@ApiTags('user-account')
@Controller('user-account')
export class UserAccountController {
  constructor(private readonly userAccountSrv: UserAccountService) {}

  @ApiQuery({ name: 'searchTerm', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'pageNumber', required: false })
  @ApiOperation({ description: 'Find bank accounts for user' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: UserAccountsResponseDTO })
  @Get()
  async findUserAccountsByUserId(
    @CurrentUser(DecodedTokenKey.USER_ID) userId: string,
    @Query() payload?: FilterUserAccountsDTO,
  ): Promise<UserAccountsResponseDTO> {
    return await this.userAccountSrv.findUserAccountsByUserId(userId, payload);
  }

  @ApiOperation({ description: 'Find bank account by ID' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: UserAccountResponseDTO })
  @Get('/:userAccountId')
  async findUserAccountById(
    @Param('userAccountId') userAccountId: string,
  ): Promise<UserAccountResponseDTO> {
    return await this.userAccountSrv.findUserAccountById(userAccountId);
  }
}
