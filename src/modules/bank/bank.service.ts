import { Injectable, OnModuleInit } from '@nestjs/common';
import { GenericService } from '@schematics/index';
import { Bank } from '@entities/index';
import { httpGet } from '@utils/index';

@Injectable()
export class BankService extends GenericService(Bank) implements OnModuleInit {
  async onModuleInit() {
    const url = 'https://api.flutterwave.com/v3/banks/NG';
    const headers = {
      Authorization: `Bearer ${String(process.env.FLUTTERWAVE_SECRET_KEY)}`,
    };
    const response = await httpGet<any>(url, headers);
    const banksFromAPI: { id: number, code: string, name: string }[] = response?.data;
    const banksFromDB = await this.getRepo().find({});

    // Compare banks from API with banks from the database
    const banksToCreate: Partial<Bank>[] = [];
    for (const apiBank of banksFromAPI) {
      const existingBank = banksFromDB.find(
        (dbBank) => dbBank.bankCode === apiBank.code,
      );
      if (!existingBank) {
        // Bank does not exist in the database, insert a new record
        banksToCreate.push({ bankCode: apiBank.code, bankName: apiBank.name });
      }
    }
    if (banksToCreate?.length > 0) {
      await this.createMany<Partial<Bank>>(banksToCreate); // Replace 'BankEntity' with your actual entity name.
      this.logger.log(`Inserted ${banksToCreate.length} new banks`);
    }
    this.logger.debug('Bank-data synchronization completed.');
  }
}
