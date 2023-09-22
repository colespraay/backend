import {
  ConflictException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { FindManyOptions, ILike } from 'typeorm';
import { GenericService } from '@schematics/index';
import { Transaction, User } from '@entities/index';
import {
  TransactionType,
  calculatePaginationControls,
  checkForRequiredFields,
  compareEnumValueFields,
  validateUUIDField,
  FileExportDataResponseDTO,
  groupBy,
  convertHtmlToPDF,
} from '@utils/index';
import {
  TransactionResponseDTO,
  CreateTransactionDTO,
  TransactionsResponseDTO,
  FindTransactionDTO,
} from './dto/transaction.dto';
import { UserService } from '../index';
import { FindStatementOfAccountDTO } from '@modules/wallet/dto/wallet.dto';

@Injectable()
export class TransactionService extends GenericService(Transaction) {
  constructor(private readonly userSrv: UserService) {
    super();
  }

  @OnEvent('transaction.log')
  async createTransaction(
    payload: CreateTransactionDTO,
  ): Promise<TransactionResponseDTO> {
    try {
      checkForRequiredFields(
        [
          'type',
          'userId',
          'reference',
          'narration',
          'amount',
          'currentBalanceBeforeTransaction',
        ],
        payload,
      );
      compareEnumValueFields(
        payload.type,
        Object.values(TransactionType),
        'type',
      );
      const recordFound = await this.getRepo().findOne({
        where: { reference: payload.reference },
        select: ['id'],
      });
      if (recordFound?.id) {
        throw new ConflictException(
          `Transaction with reference '${payload.reference}' already exists`,
        );
      }
      const createdRecord = await this.create<Partial<Transaction>>(payload);
      return {
        success: true,
        code: HttpStatus.CREATED,
        message: 'Transaction logged',
        data: createdRecord,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async findTransactions(
    payload: FindTransactionDTO,
  ): Promise<TransactionsResponseDTO> {
    try {
      const filter: FindManyOptions<Transaction> = {};
      if (payload.date) {
        filter.where = { ...filter.where, createdDate: payload.date };
      }
      if (payload.time) {
        filter.where = { ...filter.where, createdTime: payload.time };
      }
      if (payload.type) {
        compareEnumValueFields(
          payload.type,
          Object.values(TransactionType),
          'type',
        );
        filter.where = { ...filter.where, type: payload.type };
      }
      if (payload.userId) {
        validateUUIDField(payload.userId, 'userId');
        filter.where = { ...filter.where, userId: payload.userId };
      }
      if (payload.searchTerm) {
        filter.where = [
          {
            ...filter.where,
            reference: ILike(`%${payload.searchTerm}%`),
          },
          {
            ...filter.where,
            narration: ILike(`%${payload.searchTerm}%`),
          },
          {
            ...filter.where,
            createdDate: ILike(`%${payload.searchTerm}%`),
          },
          {
            ...filter.where,
            createdTime: ILike(`%${payload.searchTerm}%`),
          },
        ];
      }
      if (payload.pageNumber && payload.pageSize) {
        filter.skip = (payload.pageNumber - 1) * payload.pageSize;
        filter.take = payload.pageSize;
        const { response, paginationControl } =
          await calculatePaginationControls<Transaction>(
            this.getRepo(),
            filter,
            payload,
          );
        return {
          success: true,
          message: 'Records found',
          code: HttpStatus.OK,
          data: response,
          paginationControl,
        };
      }
      const transactions = await this.getRepo().find(filter);
      return {
        success: true,
        message: 'Records found',
        code: HttpStatus.OK,
        data: transactions,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async findTransactionById(
    transactionId: string,
  ): Promise<TransactionResponseDTO> {
    try {
      checkForRequiredFields(['transactionId'], { transactionId });
      const record = await this.getRepo().findOne({
        where: { id: transactionId },
      });
      if (!record?.id) {
        throw new NotFoundException();
      }
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Record found',
        data: record,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async findTransactionByReference(
    reference: string,
  ): Promise<TransactionResponseDTO> {
    try {
      checkForRequiredFields(['reference'], { reference });
      const record = await this.getRepo().findOne({
        where: { id: reference },
      });
      if (!record?.id) {
        throw new NotFoundException();
      }
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Record found',
        data: record,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async downloadStatementOfAccounts(
    payload: FindStatementOfAccountDTO,
    userId: string,
  ): Promise<FileExportDataResponseDTO> {
    try {
      checkForRequiredFields(['startDate', 'endDate', 'userId'], {
        ...payload,
        userId,
      });
      const user = await this.userSrv.findUserById(userId);
      const transactionRecords = await this.getRepo()
        .createQueryBuilder('t')
        .orderBy('t.dateCreated', 'DESC')
        .where('t.dateCreated >= :startDate AND t.dateCreated <= :endDate', {
          startDate: payload.startDate,
          endDate: payload.endDate,
        })
        .getMany();
      if (transactionRecords?.length <= 0) {
        throw new NotFoundException(
          'No transactions were done during this period',
        );
      }
      const firstTransactionWithinRange = transactionRecords[0];
      const lastTransactionWithinRange =
        transactionRecords[transactionRecords.length - 1];
      const groupedData = groupBy(transactionRecords, 'createdDate');
      const html = this.formatHtmlForAccountStatements(
        groupedData,
        payload.startDate,
        payload.endDate,
        user.data,
        firstTransactionWithinRange,
        lastTransactionWithinRange,
      );
      const tag = 'Statement of Accounts';
      const savedPdf = await convertHtmlToPDF(html, tag, 'account-statements');
      const fileName = savedPdf.filename.split('/').pop();
      if (!fileName) {
        throw new NotFoundException('No pdf file found');
      }
      return {
        fileName,
        path: `./uploads/${fileName}`,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  private formatHtmlForAccountStatements(
    payload: any,
    startDate: Date,
    endDate: Date,
    user: User,
    firstTransaction: Transaction,
    lastTransaction: Transaction,
  ): string {
    // FORMAT: { '12/10/2023': [Transactions] }
    startDate = new Date(startDate);
    endDate = new Date(endDate);
    const endDateString = `${endDate.getDate()}/${
      endDate.getMonth() + 1
    }/${endDate.getFullYear()}`;
    const startDateString = `${startDate.getDate()}/${
      startDate.getMonth() + 1
    }/${startDate.getFullYear()}`;
    let html = `<!DOCTYPE html>
    <html>
    <head>
    <style>
        body {
          font-family: Arial, Helvetica, sans-serif;
          background: #09090B;
          color: #fff;
          padding: 10px 20px 50px 20px;
        }
    
        .no-margin {
          margin: 0;
        }
    
        .no-padding {
          padding: 0;
        }
    
        table {
          font-family: arial, sans-serif;
          border-collapse: collapse;
          width: 100%;
        }
    
        td, th {
          border: 1px solid #1e1e39;
          text-align: left;
          padding: 8px;
        }
    
        tr:nth-child(even) {
          background-color: #1e1e39;
        }
    
        .bg-dark {
          background: #1e1e39;
        }
    
        .padding-10 {
          padding: 10px ;
        }
    
        .fs-40 {
          font-size: 40px;
        }
    
        .fs-18 {
          font-size: 18px;
        }
    
        h1, h2, h3, h4, p, td, th {
          font-weight: 300;
        }

        .uppercase { text-transform: uppercase; }

        .lowercase { text-transform: lowercase; }
    </style>
    </head>
    <body>
    <h1 class="fs-40 bg-dark padding-10">
        Spraay <span class="fs-18" style="color: #959292;">[Account: ${
          user.virtualAccountNumber ?? 'N/A'
        }]</span>
    </h1>
    
    <h2 class="no-margin uppercase" style="color: #959292">${
      user.virtualAccountName ?? 'N/A'
    }</h2>
    <h3 style="color: #959292">Statement of Accounts</h3>
    <p style="color: #959292">${startDateString} - ${endDateString}</p>
    
    <h3 class="bg-dark padding-10">Opening Balance<br /> &#8358;${firstTransaction.currentBalanceBeforeTransaction?.toLocaleString()}</h3>
    <h3 class="bg-dark padding-10">Closing Balance<br /> &#8358;${lastTransaction.currentBalanceBeforeTransaction?.toLocaleString()}</h3>
   `;
    for (const item of Object.keys(payload)) {
      html += `<section>
        <h3 class="bg-dark padding-10">${item}</h3>
        <table>
            <tr>
              <th>Time</th>
              <th>Transaction Type</th>
              <th>Payment Reference</th>
              <th>Narration</th>
              <th>Money In</th>
              <th>Money Out</th>
              <th>Balance</th>
            </tr>`;
      for (const transaction of payload[item] as Transaction[]) {
        html += ` <tr>
        <td>${transaction.createdTime}</td>
        <td>${transaction.type}</td>
        <td>${transaction.reference}</td>
        <td>${transaction.narration}</td>
        <td>${
          transaction.type === TransactionType.CREDIT
            ? `&#8358;${transaction.amount}`
            : '-----'
        }</td>
        <td>${
          transaction.type === TransactionType.DEBIT
            ? `&#8358;${transaction.amount}`
            : '-----'
        }</td>
        <td>&#8358;${transaction.currentBalanceBeforeTransaction}</td>
      </tr>`;
      }
      html += `</table>
       </section>`;
    }
    html += `
        </body>
        </html>
    `;
    return html.trim();
  }
}
