import { Injectable, OnModuleInit } from '@nestjs/common';
import { AxiosError } from 'axios';
import { Bank } from '@entities/index';
import { generatePagaHash, httpPost } from '@utils/index';
import { GenericService } from '@schematics/index';

@Injectable()
export class BankService extends GenericService(Bank) implements OnModuleInit {
  async onModuleInit() {
    try {
      const url = `${process.env.PAGA_BASE_URL}/getBanks`;
      const keys = ['referenceNumber'];
      const body = {
        referenceNumber: 'PAGA|280418|0000000021',
        locale: 'EN',
      };
      const { hash, password, username } = generatePagaHash(keys, body);
      const headers = {
        hash,
        principal: username,
        credentials: password,
        'Content-Type': 'application/json',
      };
      const banksFromAPI: any = await httpPost(url, body, headers);
      const banksFromDB = await this.getRepo().find({});
      const banksToCreate: Partial<Bank>[] = [];
      for (const apiBank of banksFromAPI.banks) {
        const existingBank = banksFromDB.find(
          (dbBank) => dbBank.bankCode === apiBank.uuid,
        );
        if (!existingBank) {
          // Bank does not exist in the database, insert a new record
          banksToCreate.push({
            bankCode: apiBank.uuid,
            bankName: apiBank.name,
            interInstitutionCode: apiBank.institutionCode,
            sortCode: apiBank.sortCode,
          });
        }
      }
      if (banksToCreate?.length > 0) {
        await this.createMany<Partial<Bank>>(banksToCreate);
        this.logger.log(`Inserted ${banksToCreate.length} new banks`);
      }
      this.logger.debug('Bank-data synchronization completed.');
    } catch (ex) {
      if (ex instanceof AxiosError) {
        const errorObject = ex.response.data;
        const message =
          typeof errorObject === 'string' ? errorObject : errorObject.error;
        this.logger.error(message);
      } else {
        this.logger.error(ex);
      }
    }
  }
}
