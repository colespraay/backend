import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, ManyToOne, BeforeInsert } from 'typeorm';
import { Base, User, TransactionRecord, uuidV4 } from './index';

@Entity({ name: 'gift_cards' })
export class GiftCard extends Base {
  @ApiProperty({ description: 'User ID associated with the gift card' })
  @Column({ type: 'uuid' })
  userId: string;

  @ApiProperty({ type: () => User, description: 'User details' })
  @ManyToOne(() => User, (user) => user.giftCards, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ApiProperty({ description: 'Gift card amount' })
  @Column({ type: 'float' })
  amount: number;

  @ApiProperty({ description: 'Gift card name' })
  @Column({ type: 'varchar', length: 255 })
  giftcardName: string;

  @ApiProperty({ description: 'Transaction ID related to this gift card' })
  @Column({ type: 'uuid', nullable: true })
  transactionId: string;

  @ApiProperty({ description: 'Transaction details' })
  @ManyToOne(() => TransactionRecord, (transaction) => transaction.giftCards, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'transactionId' })
  transaction: TransactionRecord;

  @ApiProperty({ description: 'Timestamp when the gift card was created' })
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdTime: Date;

  @ApiProperty({ description: 'Date when the gift card was created' })
  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  createdDate: Date;

  @BeforeInsert()
  beforeInsertHandler(): void {
    this.id = uuidV4();
  }
}
