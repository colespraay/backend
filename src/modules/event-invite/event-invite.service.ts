import { Injectable } from '@nestjs/common';
import { EventInvite } from '@entities/index';
import { GenericService } from '@schematics/index';

@Injectable()
export class EventInviteService extends GenericService(EventInvite) {}
