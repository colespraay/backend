import { ApiProperty } from "@nestjs/swagger";
import { Entity, BeforeInsert, Column, JoinColumn, ManyToOne } from "typeorm";
import { Base, uuidV4, TransactionRecord, User } from './index';

@Entity({ name: 'app_profit' })
export class AppProfit extends Base {
    @Column({ type: 'uuid' })
    transactionId: string;

    @ApiProperty({ type: () => TransactionRecord })
    @JoinColumn({ name: 'transactionId' })
    @ManyToOne(() => TransactionRecord, ({ appProfits }) => appProfits, {
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    })
    transaction: TransactionRecord;

    @ApiProperty()
    @Column({ type: 'float', default: 0 })
    amount: number;

    @ApiProperty()
    @Column({ type: 'boolean', default: false })
    isWithdrawn: boolean;

    @Column({ type: 'uuid', nullable: true })
    payoutUserId: string;

    @ApiProperty({ type: () => User })
    @JoinColumn({ name: 'payoutUserId' })
    @ManyToOne(() => User, ({ appProfits }) => appProfits, {
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    })
    payoutUser: User;

    @BeforeInsert()
    beforeInsertHandler(): void {
        this.id = uuidV4();
    }
}