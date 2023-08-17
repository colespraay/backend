import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('event-invite')
@Controller('event-invite')
export class EventInviteController {}
