import { Injectable, OnModuleInit } from '@nestjs/common';
import { BankListPartialDTO } from '@modules/wallet/dto/wallet.dto';
import { GenericService } from '@schematics/index';
import { Bank } from '@entities/index';
import { httpGet } from '@utils/index';

@Injectable()
export class BankService extends GenericService(Bank) implements OnModuleInit {
  async onModuleInit() {
    const url =
      'https://apiplayground.alat.ng/debit-wallet/api/Shared/GetAllBanks';
    const data = await httpGet<any>(url, {
      'x-api-key': String(process.env.WEMA_ATLAT_X_API_KEY),
      'Ocp-Apim-Subscription-Key': String(
        process.env.WEMA_ATLAT_WALLET_CREATION_SUB_KEY,
      ),
    });
    const banksFromAPI = data.result as BankListPartialDTO[];
    const banksFromDB = await this.getRepo().find({});

    // Compare banks from API with banks from the database
    const banksToCreate: Partial<Bank>[] = [];
    for (const apiBank of banksFromAPI) {
      const existingBank = banksFromDB.find(
        (dbBank) => dbBank.bankCode === apiBank.bankCode,
      );
      if (!existingBank) {
        // Bank does not exist in the database, insert a new record
        banksToCreate.push(apiBank);
      }
    }
    if (banksToCreate?.length > 0) {
      await this.createMany<Partial<Bank>>(banksToCreate); // Replace 'BankEntity' with your actual entity name.
      this.logger.log(`Inserted ${banksToCreate.length} new banks`);
    }
    this.logger.debug('Bank-data synchronization completed.');
  }
}
