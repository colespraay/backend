import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  Entity,
  JoinColumn,
  OneToMany,
  ManyToOne,
  BeforeInsert,
} from 'typeorm';
import { TransactionType, generateUniqueCode } from '@utils/index';
import { Base, User, Gifting, uuidV4, EventSpraay, Withdrawal } from './index';

@Entity({ name: 'TRANSACTION' })
export class Transaction extends Base {
  @ApiProperty()
  @Column({ type: 'float', default: 0 })
  amount: number;

  @ApiProperty()
  @Column({ type: 'float', default: 0 })
  currentBalanceBeforeTransaction: number;

  @ApiProperty()
  @Column({ type: 'varchar', length: 255 })
  narration: string;

  @ApiProperty()
  @Column({ type: 'varchar', default: 50 })
  reference: string;

  @ApiProperty({ enum: TransactionType })
  @Column({ enum: TransactionType })
  type: TransactionType;

  @ApiProperty()
  @Column({ type: 'varchar', length: 100 })
  transactionDate: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 20 })
  createdTime: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 20 })
  createdDate: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ApiProperty({ type: () => User })
  @JoinColumn({ name: 'userId' })
  @ManyToOne(() => User, ({ transactions }) => transactions, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  user: User;

  @Column({ type: 'uuid', nullable: true })
  receiverUserId: string;

  @ApiProperty({ type: () => User })
  @JoinColumn({ name: 'userId' })
  @ManyToOne(() => User, ({ receivedTransactions }) => receivedTransactions, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  receiverUser: User;

  @ApiProperty({ type: () => [Gifting] })
  @OneToMany(() => Gifting, ({ transaction }) => transaction, {
    cascade: true,
  })
  gifts: Gifting[];

  @ApiProperty({ type: () => [EventSpraay] })
  @OneToMany(() => EventSpraay, ({ transaction }) => transaction, {
    cascade: true,
  })
  spraays: EventSpraay[];

  @ApiProperty({ type: () => [Withdrawal] })
  @OneToMany(() => Withdrawal, ({ transaction }) => transaction, {
    cascade: true,
  })
  withdrawals: Withdrawal[];

  @BeforeInsert()
  beforeInsertHandler(): void {
    this.id = uuidV4();

    if (!this.reference) {
      this.reference = `#Spraay-Ref-${generateUniqueCode(8)}`;
    }
    // Create time and date for transaction to enable faster filtering
    const dateTime = new Date(this.transactionDate);
    this.createdDate = `${dateTime.getDate()}/${
      dateTime.getMonth() + 1
    }/${dateTime.getFullYear()}`;
    this.createdTime = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(dateTime);
  }
}
