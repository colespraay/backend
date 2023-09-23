import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { User, Base, Transaction } from './index';

@Entity({ name: 'GIFTING' })
export class Gifting extends Base {
  @Column({ type: 'uuid' })
  receiverUserId: string;

  @ApiProperty({ type: () => User })
  @JoinColumn({ name: 'receiverUserId' })
  @ManyToOne(() => User, ({ gifts }) => gifts, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  receiverUser: User;

  @ApiProperty()
  @Column({ type: 'float', default: 0 })
  amount: number;

  @Column({ type: 'uuid' })
  transactionId: string;

  @ApiProperty({ type: () => Transaction })
  @JoinColumn({ name: 'transactionId' })
  @ManyToOne(() => Transaction, ({ gifts }) => gifts, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  transaction: Transaction;
}
