import { Injectable } from '@nestjs/common';
import { EventSpraay } from '@entities/index';
import { GenericService } from '@schematics/index';

@Injectable()
export class EventSpraayService extends GenericService(EventSpraay) {}
