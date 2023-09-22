import { Injectable } from '@nestjs/common';
import { GenericService } from '@schematics/index';
import { Transaction } from '@entities/index';

@Injectable()
export class TransactionService extends GenericService(Transaction) {}
