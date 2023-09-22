import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, ManyToOne, BeforeInsert } from 'typeorm';
import { TransactionType } from '@utils/index';
import { Base, User, uuidV4 } from './index';

@Entity({ name: 'TRANSACTION' })
export class Transaction extends Base {
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
  @Column({ type: 'varchar', length: 20 })
  createdTime: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 20 })
  createdDate: string;

  @BeforeInsert()
  beforeInsertHandler(): void {
    this.id = uuidV4();

    // Create time and date for transaction to enable faster filtering
    const dateTime = new Date();
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
