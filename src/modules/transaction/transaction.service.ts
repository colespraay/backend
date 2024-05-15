import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { FindManyOptions, ILike, In, IsNull, Not } from 'typeorm';
import { createReadStream, unlinkSync } from 'fs';
import { GenericService } from '@schematics/index';
import { TransactionRecord, User } from '@entities/index';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
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
  PaymentStatus,
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
  TransPaginationDto,
  TransactionDateRangeDto,
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
      response.total = Number(
        transactions
          .reduce(
            (previousValue, currentValue) =>
              previousValue + currentValue.amount,
            0,
          )
          .toFixed(2),
      );
      response.income = Number(
        incomingTransactions
          .reduce(
            (previousValue, currentValue) =>
              previousValue + currentValue.amount,
            0,
          )
          .toFixed(2),
      );
      response.expense = Number(
        outgoingTransactions
          .reduce(
            (previousValue, currentValue) =>
              previousValue + currentValue.amount,
            0,
          )
          .toFixed(2),
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
        ['type', 'userId', 'amount', 'narration', 'transactionDate'],
        payload,
      );
      if (
        payload.currentBalanceBeforeTransaction < 0 &&
        !payload.currentBalanceBeforeTransaction
      ) {
        throw new BadRequestException(
          'Field currentBalanceBeforeTransaction is required',
        );
      }
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
        if (createdRecord.transactionStatus === PaymentStatus.SUCCESSFUL) {
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
        }
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

  private async sendEmailForTransactionNotification(
    transaction: TransactionRecord,
  ): Promise<void> {
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
                        <td style="text-align: right;padding: 20px 5px;border-bottom: 1px solid #ddd;color:#555555">${
                          transaction.type
                        }</td>
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
                        <a style="color: inherit;" href="mailto:hello@spraay.ng?subject=Problem with transaction: '${
                          transaction.reference
                        }'">hello@spraay.ng</a>
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
                        <td style="text-align: right;padding: 20px 5px;border-bottom: 1px solid #ddd;color:#555555">${
                          transaction.type
                        }</td>
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
                        <a style="color: inherit;" href="mailto:hello@spraay.ng?subject=Problem with transaction: '${
                          transaction.reference
                        }'">hello@spraay.ng</a>
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



  
  // async aggregateTotalTransactionSumPerMonth(): Promise<any> {
  //   try {
  //     const currentDate = new Date();
  //     const startDate = new Date(currentDate.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago

  //     const transactions = await this.getRepo().find({
  //       where: {
  //         transactionDate: Between(startDate.toISOString(), currentDate.toISOString()),
  //       },
  //     });

  //     const aggregatedData = {};

  //     transactions.forEach((transaction) => {
  //       const transactionDate = new Date(transaction.transactionDate);
  //       const monthKey = `${transactionDate.getFullYear()}-${transactionDate.getMonth() + 1}`;

  //       if (!aggregatedData[monthKey]) {
  //         aggregatedData[monthKey] = 0;
  //       }

  //       aggregatedData[monthKey] += transaction.amount;
  //     });

  //     // Fill in 0 for days with no data in the past 10 days
  //     for (let i = 0; i < 10; i++) {
  //       const dateKey = new Date(currentDate.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  //       const monthKey = dateKey.slice(0, 7); // Extract YYYY-MM from dateKey

  //       if (!aggregatedData[monthKey]) {
  //         aggregatedData[monthKey] = 0;
  //       }
  //     }

  //     return {
  //       success: true,
  //       message: 'Total transaction sum aggregated per month for the past 10 days',
  //       code: HttpStatus.OK,
  //       data: aggregatedData,
  //     };
  //   } catch (error) {
  //     return {
  //       success: false,
  //       message: 'Failed to aggregate total transaction sum per month',
  //       code: HttpStatus.INTERNAL_SERVER_ERROR,
  //       error: error.message,
  //     };
  //   }
  // }
  // async calculateTotalTransactionAmount(dateRangeDto: TransactionDateRangeDto): Promise<any> {
  //   try {
  //     const transactions = await this.getRepo().find();

  //     let totalAmount = 0;
  //     transactions.forEach((transaction) => {
  //       totalAmount += transaction.amount;
  //     });

  //     return {
  //       success: true,
  //       message: 'Total transaction amount calculated',
  //       code: HttpStatus.OK,
  //       data: { totalAmount: totalAmount },
  //     };
  //   } catch (error) {
  //     return {
  //       success: false,
  //       message: 'Failed to calculate total transaction amount',
  //       code: HttpStatus.INTERNAL_SERVER_ERROR,
  //       error: error.message,
  //     };
  //   }
  // }

  async calculateTotalTransactionAmount(dateRangeDto: TransactionDateRangeDto): Promise<any> {
    try {
      const { startDate, endDate } = dateRangeDto;
  
      const transactions = await this.getRepo().find({
        where: {
          dateCreated: Between(startDate, endDate),
        },
      });
  
      let totalAmount = 0;
      transactions.forEach((transaction) => {
        totalAmount += transaction.amount;
      });
  
      return {
        success: true,
        message: 'Total transaction amount calculated for the specified date range',
        code: HttpStatus.OK,
        data: { totalAmount: totalAmount },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to calculate total transaction amount',
        code: HttpStatus.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }

  async aggregateTotalTransactionSumPerDay(): Promise<any> {
    try {
      const currentDate = new Date();
      const startDate = new Date(
        currentDate.getTime() - 10 * 24 * 60 * 60 * 1000,
      ); // 10 days ago

      const transactions = await this.getRepo().find({
        where: {
          dateCreated: Between(startDate, currentDate),
        },
      });

      const aggregatedData = {};

      transactions.forEach((transaction) => {
        // Get the date part from the transaction date string
        const dateKey = transaction.dateCreated.toISOString().split('T')[0];

        if (!aggregatedData[dateKey]) {
          aggregatedData[dateKey] = 0;
        }

        aggregatedData[dateKey] += transaction.amount;
      });

      // Fill in 0 for days with no data in the past 10 days
      for (let i = 0; i < 10; i++) {
        const dateKey = new Date(
          currentDate.getTime() - i * 24 * 60 * 60 * 1000,
        )
          .toISOString()
          .split('T')[0];

        if (!aggregatedData[dateKey]) {
          aggregatedData[dateKey] = 0;
        }
      }

      return {
        success: true,
        message:
          'Total transaction sum aggregated per day for the past 10 days',
        code: HttpStatus.OK,
        data: aggregatedData,
      };
    } catch (error) {
      console.error('Error in aggregateTotalTransactionSumPerDay:', error);

      return {
        success: false,
        message: 'Failed to aggregate total transaction sum per day',
        code: HttpStatus.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }
  async getAllTransactions(paginationDto: TransPaginationDto): Promise<any> {
    try {
      const { page, limit } = paginationDto;
      const [transactions, totalCount] = await this.getRepo().findAndCount({
        skip: (page - 1) * limit,
        take: limit,
      });

      return {
        success: true,
        message: 'Transactions retrieved successfully',
        code: HttpStatus.OK,
        data: {
          transactions: transactions,
          totalCount: totalCount,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve transactions',
        code: HttpStatus.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }


  // async getTotalTransactionsPerDay(dateRange: TransactionDateRangeDto): Promise<{ date: string; count: number }[]> {
  //   const { startDate, endDate } = dateRange;
  //   const results = await this.getRepo()
  //     .createQueryBuilder('transaction')
  //     .select('DATE(transaction.dateCreated) AS date')
  //     .addSelect('COUNT(*) AS count')
  //     .where('DATE(transaction.dateCreated) BETWEEN :startDate AND :endDate', { startDate, endDate })
  //     .groupBy('DATE(transaction.dateCreated)')
  //     .getRawMany();

  //   return results.map(({ date, count }) => ({ date, count: parseInt(count) }));
  // }

  // async getTotalTransactionSumPerDay(dateRange: TransactionDateRangeDto): Promise<{ date: string; sum: number }[]> {
  //   const { startDate, endDate } = dateRange;
  //   const results = await this.getRepo()
  //     .createQueryBuilder('transaction')
  //     .select('DATE(transaction.dateCreated) AS date')
  //     .addSelect('SUM(amount) AS sum')
  //     .where('DATE(transaction.dateCreated) BETWEEN :startDate AND :endDate', { startDate, endDate })
  //     .groupBy('DATE(transaction.dateCreated)')
  //     .getRawMany();

  //   return results.map(({ date, sum }) => ({ date, sum: parseFloat(sum) }));
  // }

  async getTransactionsByUserId(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ transactions: TransactionRecord[]; totalTransactions: number }> {
    const skip = (page - 1) * limit;

    const [transactions, totalTransactions] = await this.getRepo().findAndCount({
      where: { userId },
      skip,
      take: limit,
      order: { transactionDate: 'DESC' },
    });

    return { transactions, totalTransactions };
  }


  async getTotalTransactionsPerDay(dateRange: TransactionDateRangeDto): Promise<{ date: string; count: number }[]> {
    const { startDate, endDate } = dateRange;
    const results = await this.getRepo()
      .createQueryBuilder('transaction')
      .select('DATE(transaction.dateCreated) AS date')
      .addSelect('COUNT(*) AS count')
      .where('DATE(transaction.dateCreated) BETWEEN :startDate AND :endDate', { startDate, endDate })
      .groupBy('DATE(transaction.dateCreated)')
      .getRawMany();
  
    const currentDate = new Date(startDate);
    const endDateObj = new Date(endDate);
    const aggregatedData = [];
  
    while (currentDate <= endDateObj) {
      const dateKey = currentDate.toISOString().split('T')[0];
      const result = results.find((item) => {
        const itemDate = item.date instanceof Date ? item.date.toISOString().split('T')[0] : item.date;
        return itemDate === dateKey;
      });
  
      aggregatedData.push({ date: dateKey, count: result ? parseInt(result.count) : 0 });
  
      currentDate.setDate(currentDate.getDate() + 1);
    }
  
    return aggregatedData;
  }
  
  async getTotalTransactionSumPerDay(dateRange: TransactionDateRangeDto): Promise<{ date: string; sum: number }[]> {
    const { startDate, endDate } = dateRange;
    const results = await this.getRepo()
      .createQueryBuilder('transaction')
      .select('DATE(transaction.dateCreated) AS date')
      .addSelect('SUM(amount) AS sum')
      .where('DATE(transaction.dateCreated) BETWEEN :startDate AND :endDate', { startDate, endDate })
      .groupBy('DATE(transaction.dateCreated)')
      .getRawMany();
  
    const currentDate = new Date(startDate);
    const endDateObj = new Date(endDate);
    const aggregatedData = [];
  
    while (currentDate <= endDateObj) {
      const dateKey = currentDate.toISOString().split('T')[0];
      const result = results.find((item) => {
        const itemDate = item.date instanceof Date ? item.date.toISOString().split('T')[0] : item.date;
        return itemDate === dateKey;
      });
  
      aggregatedData.push({ date: dateKey, sum: result ? parseFloat(result.sum) : 0 });
  
      currentDate.setDate(currentDate.getDate() + 1);
    }
  
    return aggregatedData;
  }
  

}
