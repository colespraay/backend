import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuidaxOrder } from '@entities/quidax-order.entity';
import { GenericService } from '@schematics/index';


@Injectable()
export class QuidaxorderService extends GenericService(
    QuidaxOrder,
) {
    constructor(
    ) {
        super();
    }
    async createOrder(
        userId: string,
        orderId: string,
        reasonForOrder: string,
        accountName?: string,
        bankName?: string,
        accountNumber?: string,
        beneficiaryBankCode?: string,
        transactionStatus?: string,
    ): Promise<QuidaxOrder> {
        const orderData: Partial<QuidaxOrder> = {
            userId,
            orderId,
            reasonForOrder,
            accountName,
            bankName,
            accountNumber,
            beneficiaryBankCode,
            transactionStatus,
        };

        const newOrder = this.getRepo().create(orderData);
        return await this.getRepo().save(newOrder);
    }

    async getUniqueBankDetails(userId: string) {
        const qb = this.getRepo().createQueryBuilder('order')
            .select([
                'order.accountName',
                'order.bankName',
                'order.accountNumber',
                'order.beneficiaryBankCode',
            ])
            .where('order.userId = :userId', { userId })
            .groupBy('order.accountName')
            .addGroupBy('order.bankName')
            .addGroupBy('order.accountNumber')
            .addGroupBy('order.beneficiaryBankCode');

        return await qb.getRawMany();
    }

    async getOrderByOrderId(orderId: string): Promise<QuidaxOrder> {
        const order = await this.getRepo().findOne({ where: { orderId } });
        if (!order) {
            throw new NotFoundException(`Order with ID ${orderId} not found`);
        }
        return order;
    }
}
