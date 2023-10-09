import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('bank')
@Controller('bank')
export class BankController {}
