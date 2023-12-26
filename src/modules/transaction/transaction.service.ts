import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { FindManyOptions, ILike, In, IsNull, Not } from 'typeorm';
import { createReadStream, unlinkSync } from 'fs';
import { GenericService } from '@schematics/index';
import { TransactionRecord, User } from '@entities/index';
import {
  TransactionType,
  calculatePaginationControls,
  checkForRequiredFields,
  compareEnumValueFields,
  validateUUIDField,
  FileExportDataResponseDTO,
  groupBy,
  convertHtmlToPDF,
  PaginationRequestType,
  sendEmail,
  BaseResponseTypeDTO,
  formatAmount,
  formatDate,
} from '@utils/index';
import { FindStatementOfAccountDTO } from '@modules/wallet/dto/wallet.dto';
import { UsersResponseDTO } from '@modules/user/dto/user.dto';
import { UserService } from '@modules/user/user.service';
import {
  Month,
  ExportSOADTO,
  ExportReceiptDTO,
  FindTransactionDTO,
  CreateTransactionDTO,
  TransactionResponseDTO,
  TransactionsResponseDTO,
  TransactionListHistoryDTO,
  TransactionListHistoryFilter,
  TransactionListHistoryGraphDTO,
  TransactionListHistoryGraphPartial,
} from './dto/transaction.dto';

@Injectable()
export class TransactionService extends GenericService(TransactionRecord) {
  constructor(
    private readonly userSrv: UserService,
    private readonly eventEmitterSrv: EventEmitter2,
  ) {
    super();
  }

  async transactionGraphSummary(
    userId: string,
  ): Promise<TransactionListHistoryGraphDTO> {
    try {
      checkForRequiredFields(['userId'], { userId });
      validateUUIDField(userId, 'userId');
      // Get the current year
      const currentYear = new Date().getFullYear();

      // Calculate the start and end dates for the current year
      const startDate = new Date(`${currentYear}-01-01`);
      const endDate = new Date(`${currentYear + 1}-01-01`);

      // Query for the total amount of incoming and outgoing transactions grouped by month and year
      const result = await this.getRepo()
        .createQueryBuilder('transaction')
        .select([
          'EXTRACT(MONTH FROM transaction.dateCreated) as month',
          'EXTRACT(YEAR FROM transaction.dateCreated) as year',
          'SUM(CASE WHEN transaction.type = :incoming THEN transaction.amount ELSE 0 END) as incomingTotal',
          'SUM(CASE WHEN transaction.type = :outgoing THEN transaction.amount ELSE 0 END) as outgoingTotal',
        ])
        .where('transaction.dateCreated >= :startDate', { startDate })
        .andWhere('transaction.dateCreated < :endDate', { endDate })
        .andWhere('transaction.userId = :userId', { userId })
        .groupBy('month, year')
        .setParameters({
          incoming: TransactionType.CREDIT,
          outgoing: TransactionType.DEBIT,
        })
        .getRawMany();

      const list: TransactionListHistoryGraphPartial[] = [];
      const months = Object.values(Month);
      for (let i = 1; i <= 12; i++) {
        const item = new TransactionListHistoryGraphPartial();
        item.month = months[i - 1];
        item.monthCode = i;
        item.totalAmount = 0;
        const findItem = result.find(({ month }) => month === i);
        if (findItem) {
          item.totalAmount = findItem.incomingtotal + findItem.outgoingtotal;
        }
        list.push(item);
      }
      return {
        success: true,
        message: 'Records found',
        code: HttpStatus.OK,
        data: list,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async findTransactionSummary(
    filter: TransactionListHistoryFilter = TransactionListHistoryFilter.LAST_7_DAYS,
    userId: string,
  ): Promise<TransactionListHistoryDTO> {
    try {
      checkForRequiredFields(['userId', 'filter'], { userId, filter });
      compareEnumValueFields(
        filter,
        Object.values(TransactionListHistoryFilter),
        'filter',
      );
      const date = new Date();
      switch (filter) {
        default:
        case TransactionListHistoryFilter.LAST_7_DAYS:
          date.setDate(date.getDate() - 7);
          break;
        case TransactionListHistoryFilter.LAST_30_DAYS:
          date.setDate(date.getDate() - 30);
          break;
        case TransactionListHistoryFilter.LAST_3_MONTHS:
          date.setDate(date.getMonth() - 3);
          break;
        case TransactionListHistoryFilter.LAST_6_MONTHS:
          date.setDate(date.getMonth() - 6);
          break;
      }
      const transactions = await this.getRepo()
        .createQueryBuilder('transaction')
        .where('transaction.dateCreated >= :date', {
          date,
        })
        .andWhere('transaction.userId = :userId', { userId })
        .select([
          'transaction.amount',
          'transaction.dateCreated',
          'transaction.userId',
          'transaction.type',
        ])
        .getMany();
      const incomingTransactions = transactions.filter(
        (transaction) => transaction.type === TransactionType.CREDIT,
      );
      const outgoingTransactions = transactions.filter(
        (transaction) => transaction.type === TransactionType.DEBIT,
      );
      const response = new TransactionListHistoryDTO();
      response.total = transactions.reduce(
        (previousValue, currentValue) => previousValue + currentValue.amount,
        0,
      );
      response.income = incomingTransactions.reduce(
        (previousValue, currentValue) => previousValue + currentValue.amount,
        0,
      );
      response.expense = outgoingTransactions.reduce(
        (previousValue, currentValue) => previousValue + currentValue.amount,
        0,
      );
      return response;
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  // Recent recipients
  async findRecentRecipients(
    userId: string,
    pagination?: PaginationRequestType,
  ): Promise<UsersResponseDTO> {
    try {
      checkForRequiredFields(['userId'], { userId });
      validateUUIDField(userId, 'userId');
      const transactions = await this.getRepo().find({
        where: { userId, receiverUserId: Not(IsNull()) },
        select: ['userId', 'receiverUserId'],
      });
      const receivers = [
        ...new Set(transactions.map(({ receiverUserId }) => receiverUserId)),
      ];

      const filter: FindManyOptions<User> = {
        where: { id: In(receivers) },
        order: { firstName: 'ASC' },
      };
      if (pagination?.pageNumber && pagination?.pageSize) {
        filter.skip = (pagination.pageNumber - 1) * pagination.pageSize;
        filter.take = pagination.pageSize;
        const { response, paginationControl } =
          await calculatePaginationControls<User>(
            this.userSrv.getRepo(),
            filter,
            pagination,
          );
        return {
          success: true,
          message: 'Records found',
          code: HttpStatus.OK,
          data: response,
          paginationControl,
        };
      }
      const users = await this.userSrv.getRepo().find(filter);
      return {
        success: true,
        message: 'Records found',
        code: HttpStatus.OK,
        data: users,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async createTransaction(
    payload: CreateTransactionDTO,
  ): Promise<TransactionResponseDTO> {
    try {
      checkForRequiredFields(
        [
          'type',
          'userId',
          'narration',
          'transactionDate',
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
        where: { reference: payload.reference, type: payload.type },
        select: ['id'],
      });
      if (!recordFound?.id) {
        const createdRecord = await this.create<Partial<TransactionRecord>>(
          payload,
        );
        switch (createdRecord.type) {
          case TransactionType.CREDIT:
            await this.userSrv.creditUserWallet({
              amount: payload.amount,
              userId: payload.userId,
            });
          break;
          case TransactionType.DEBIT:
            await this.userSrv.debitUserWallet({
              amount: payload.amount,
              userId: payload.userId,
            });
          break;
        }
        await this.sendEmailForTransactionNotification(createdRecord);
        return {
          success: true,
          code: HttpStatus.CREATED,
          message: 'Transaction logged',
          data: createdRecord,
        };
      }
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async findTransactions(
    payload: FindTransactionDTO,
  ): Promise<TransactionsResponseDTO> {
    try {
      const filter: FindManyOptions<TransactionRecord> = {
        order: { dateCreated: 'DESC' },
      };
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
          await calculatePaginationControls<TransactionRecord>(
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

  @OnEvent('export.receipt', { async: true })
  private async exportTransactionReceipt(
    payload: ExportReceiptDTO,
  ): Promise<void> {
    try {
      const subject = `Transaction Receipt ${payload.transaction.reference}`;
      const response = await sendEmail(
        `<h2>Find receipt to transaction: ${payload.transaction.reference} below</h2>`,
        subject,
        [...payload.recipients],
        [
          {
            content: createReadStream(payload.path),
            filename: payload.fileName,
          },
        ],
      );
      if (response?.success) {
        unlinkSync(payload.path);
      }
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async exportTransactionReceiptToEmail(
    transactionId: string,
    userId: string,
  ): Promise<BaseResponseTypeDTO> {
    try {
      checkForRequiredFields(['transactionId', 'userId'], {
        userId,
        transactionId,
      });
      validateUUIDField('userId', userId);
      const record = await this.findTransactionById(transactionId);
      const user = await this.userSrv.findUserById(userId);
      const html = this.formatHtmlForReceipt(record.data);
      const tag = 'Transaction Receipt';
      const savedPdf = await convertHtmlToPDF(html, tag, 'transaction-receipt');
      const fileName = savedPdf.filename.split('/').pop();
      if (!fileName) {
        throw new NotFoundException('No pdf file found');
      }
      const resp = {
        fileName,
        path: `./uploads/${fileName}`,
      };
      this.eventEmitterSrv.emit('export.receipt', {
        ...resp,
        transaction: record.data,
        recipients: [user.data.email],
      });
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Receipt exported to your email',
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async downloadTransactionReceipt(
    transactionId: string,
  ): Promise<FileExportDataResponseDTO> {
    try {
      checkForRequiredFields(['transactionId'], { transactionId });
      const record = await this.findTransactionById(transactionId);
      const html = this.formatHtmlForReceipt(record.data);
      const tag = 'Transaction Receipt';
      const savedPdf = await convertHtmlToPDF(html, tag, 'transaction-receipt');
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
        .andWhere('t.userId = :userId', { userId })
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

  async exportStatementOfAccounts(
    payload: FindStatementOfAccountDTO,
    userId: string,
  ): Promise<BaseResponseTypeDTO> {
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
        .andWhere('t.userId = :userId', { userId })
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
      const resp = {
        fileName,
        path: `./uploads/${fileName}`,
      };
      this.eventEmitterSrv.emit('export.soa', {
        ...resp,
        startDate: payload.startDate,
        endDate: payload.endDate,
        recipients: [user.data.email],
      });
      return {
        success: true,
        message: 'Statement of account sent to your mailbox',
        code: HttpStatus.OK,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  private async sendEmailForTransactionNotification(transaction: TransactionRecord): Promise<void> {
    try {
      const today = new Date();
      const user = await this.userSrv.findUserById(transaction.userId);
      const instagramUrl = String(process.env.INSTAGRAM_URL);
      const twitterUrl = String(process.env.TWITTER_URL);
      const facebookUrl = String(process.env.FACEBOOK_URL);
      const transactionDate = formatDate(new Date(transaction.transactionDate));
      const transactionAmount = formatAmount(transaction.amount);
      let html: string;
      switch (transaction.type) {
        case TransactionType.CREDIT:
          html = `<section style="background: white; color: black; font-size: 15px; font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif; display: flex; justify-content: center; margin: 0;">
            <div style="padding: 2rem; width: 80%;">
            <section style="text-align: center;">
                <div style="width: fit-content; margin: 20px 0px;display: inline-block;">
                    <img src="https://ik.imagekit.io/un0omayok/Logo%20animaion.png?updatedAt=1701281040423" alt="">
                </div>
            </section>
    
            <section style="width: 100%; height: auto; font-size: 18px; text-align: justify;">
                <p style="font-weight:300">Hi ${user.data.firstName},</p>
                <p style="font-weight:300">
                  A transaction has occurred on your account. Here is the transaction details:
                </p>
                <p style="font-weight:300; text-align: center;margin:0">
                    <b>Transaction Amount</b>
                </p>
                <h1 style="font-size: 50px;text-align: center; margin:0; color: rgb(38, 87, 38)">
                  <sup><span style="font-size: 30px;">+</span></sup>₦${transactionAmount}
                </h1>
    
                <table style="width:100%;border-collapse:collapse;">
                    <tr>
                        <td style="padding: 20px 5px; border-bottom: 1px solid #ddd;color:#555555">Transaction Type</td>
                        <td style="text-align: right;padding: 20px 5px;border-bottom: 1px solid #ddd;color:#555555">Electricity bill</td>
                    </tr>
                    <tr>
                        <td style="padding: 20px 5px; border-bottom: 1px solid #ddd;color:#555555">Transaction Date</td>
                        <td style="text-align: right;padding: 20px 5px;border-bottom: 1px solid #ddd;color:#555555">
                          ${transactionDate}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 20px 5px; border-bottom: 1px solid #ddd;color:#555555">Transaction Reference</td>
                        <td style="text-align: right;padding: 20px 5px;border-bottom: 1px solid #ddd;color:#555555">
                          ${transaction.reference}
                        </td>
                    </tr>
                </table>
    
                <p style="font-weight:300">
                    If you have any issues with payment, kindly reply to this email or send an email to 
                    <span style="font-weight: 400;">
                        <a style="color: inherit;" href="mailto:hello@spraay.ng?subject=Problem with transaction: '${transaction.reference}'">hi@spraay.ng</a>
                    </span>
                </p>
            </section>
    
            <section style="text-align: center; height: 8rem; background-color: #5B45FF; border-radius: 10px; margin-top: 2rem; margin-bottom: 2rem;">
            <a href="${instagramUrl}" style="margin-right: 30px;display: inline-block;padding-top:40px;"><img src="https://ik.imagekit.io/un0omayok/mdi_instagram.png?updatedAt=1701281040417" alt=""></a>
            <a href="${twitterUrl}" style="margin-right: 30px;display: inline-block;padding-top:40px;"><img src="https://ik.imagekit.io/un0omayok/simple-icons_x.png?updatedAt=1701281040408" alt=""></a>
            <a href="${facebookUrl}" style="display: inline-block;padding-top:40px;"><img src="https://ik.imagekit.io/un0omayok/ic_baseline-facebook.png?updatedAt=1701281040525" alt=""></a>
          </section>
    
            <section style="padding: 20px; border-bottom: 2px solid #000; text-align: center; font-size: 20px;">
                <p style="font-weight:300">Spraay software limited</p>
            </section>
    
            <section style="text-align: center; font-size: 18px;">
                <p style="font-weight: 400;">Spraay &copy;${today.getFullYear()}</p>
                <p style="font-weight: 400;">Click here to <a href="#" style="color: #5B45FF;">Unsubscribe</a></p>
            </section>
          </div>
          </section>`;
        break;
        case TransactionType.DEBIT:
          html = `
          <section style="background: white; color: black; font-size: 15px; font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif; display: flex; justify-content: center; margin: 0;">
          <div style="padding: 2rem; width: 80%;">
            <section style="text-align: center;">
                <div style="width: fit-content; margin: 20px 0px;display: inline-block;">
                    <img src="https://ik.imagekit.io/un0omayok/Logo%20animaion.png?updatedAt=1701281040423" alt="">
                </div>
            </section>
    
            <section style="width: 100%; height: auto; font-size: 18px; text-align: justify;">
                <p style="font-weight:300">Hi ${user.data.firstName},</p>
                <p style="font-weight:300">
                  A transaction has occurred on your account. Here is the transaction details:
                </p>
                <p style="font-weight:300; text-align: center;margin:0">
                    <b>Transaction Amount</b>
                </p>
                <h1 style="font-size: 50px;text-align: center; margin:0; color: rgb(228, 67, 67)">
                  <sup><span style="font-size: 30px;">-</span></sup>₦${transactionAmount}
                </h1>
    
                <table style="width:100%;border-collapse:collapse;">
                    <tr>
                        <td style="padding: 20px 5px; border-bottom: 1px solid #ddd;color:#555555">Transaction Type</td>
                        <td style="text-align: right;padding: 20px 5px;border-bottom: 1px solid #ddd;color:#555555">Electricity bill</td>
                    </tr>
                    <tr>
                        <td style="padding: 20px 5px; border-bottom: 1px solid #ddd;color:#555555">Transaction Date</td>
                        <td style="text-align: right;padding: 20px 5px;border-bottom: 1px solid #ddd;color:#555555">
                          ${transactionDate}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 20px 5px; border-bottom: 1px solid #ddd;color:#555555">Transaction Reference</td>
                        <td style="text-align: right;padding: 20px 5px;border-bottom: 1px solid #ddd;color:#555555">
                          ${transaction.reference}
                        </td>
                    </tr>
                </table>
    
                <p style="font-weight:300">
                    If you have any issues with payment, kindly reply to this email or send an email to 
                    <span style="font-weight: 400;">
                        <a style="color: inherit;" href="mailto:hello@spraay.ng?subject=Problem with transaction: '${transaction.reference}'">hi@spraay.ng</a>
                    </span>
                </p>
            </section>
    
            <section style="text-align: center; height: 8rem; background-color: #5B45FF; border-radius: 10px; margin-top: 2rem; margin-bottom: 2rem;">
            <a href="${instagramUrl}" style="margin-right: 30px;display: inline-block;padding-top:40px;"><img src="https://ik.imagekit.io/un0omayok/mdi_instagram.png?updatedAt=1701281040417" alt=""></a>
            <a href="${twitterUrl}" style="margin-right: 30px;display: inline-block;padding-top:40px;"><img src="https://ik.imagekit.io/un0omayok/simple-icons_x.png?updatedAt=1701281040408" alt=""></a>
            <a href="${facebookUrl}" style="display: inline-block;padding-top:40px;"><img src="https://ik.imagekit.io/un0omayok/ic_baseline-facebook.png?updatedAt=1701281040525" alt=""></a>
          </section>
    
            <section style="padding: 20px; border-bottom: 2px solid #000; text-align: center; font-size: 20px;">
                <p style="font-weight:300">Spraay software limited</p>
            </section>
    
            <section style="text-align: center; font-size: 18px;">
                <p style="font-weight: 400;">Spraay &copy;${today.getFullYear()}</p>
                <p style="font-weight: 400;">Click here to <a href="#" style="color: #5B45FF;">Unsubscribe</a></p>
            </section>
            </div>
          </section>`;
        break;
      }
      if (html) {
        const subject = `Spraay Receipt for: ${transaction.reference}`;
        await sendEmail(html, subject, [user.data.email]);
      }
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  @OnEvent('export.soa', { async: true })
  private async exportSOA(payload: ExportSOADTO): Promise<void> {
    try {
      payload.startDate = new Date(payload.startDate);
      payload.endDate = new Date(payload.endDate);
      const subject = `Statement of Accounts ${payload.startDate.toLocaleDateString()} - ${payload.endDate.toLocaleDateString()}`;
      const response = await sendEmail(
        `<h2>Find a version of your statement of accounts attached to this mail</h2>`,
        subject,
        [...payload.recipients],
        [
          {
            content: createReadStream(payload.path),
            filename: payload.fileName,
          },
        ],
      );
      if (response?.success) {
        unlinkSync(payload.path);
      }
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  private formatHtmlForReceipt(transaction: TransactionRecord): string {
    return `<!DOCTYPE html>
    <html>
    <head>
    <style>
      .tt {
        text-transform: uppercase;
      }
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
    
        .text-danger {
            color: indianred;
        }
    
        .text-success {
            color: green;
        }
    
        .text-bold {
            font-weight: bold;
        }
    </style>
    </head>
    <body>
    <h1 class="fs-40 bg-dark padding-10">
        Receipt <span class="fs-18" style="color: #959292;">[Reference: ${transaction.reference}]</span>
    </h1>
    <section>
        <table>
            <tbody>
              <tr>
                <td>Transaction Amount</td>
                <td>&#8358;${transaction.amount}</td>
              </tr>
              <tr>
                <td>Transaction Type</td>
                <td>${transaction.type}</td>
              </tr>
              <tr>
                <td>Transaction Date</td>
                <td>${transaction.createdDate}, ${transaction.createdTime}</td>
              </tr>
              <tr>
                <td>Transaction Reference</td>
                <td>${transaction.reference}</td>
              </tr>
              <tr>
                <td>Transaction Status</td>
                <td>
                    <span class="text-success text-bold">Successful</span><br />
                    <!-- <span class="text-danger text-bold">Failed</span><br /> -->
                </td>
              </tr>
            </tbody>
          </table>
    </section>
    
    </body>
    </html>
    
    `;
  }

  private formatHtmlForAccountStatements(
    payload: any,
    startDate: Date,
    endDate: Date,
    user: User,
    firstTransaction: TransactionRecord,
    lastTransaction: TransactionRecord,
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
      for (const transaction of payload[item] as TransactionRecord[]) {
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
