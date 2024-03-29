import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, BeforeInsert, JoinColumn, ManyToOne } from 'typeorm';
import { Base, TransactionRecord, User, uuidV4 } from './index';

@Entity({ name: 'cable_purchase' })
export class CablePurchase extends Base {
  @ApiProperty()
  @Column({ type: 'varchar', length: 50 })
  smartCardNumber: string;

  @ApiProperty()
  @Column({ type: 'float', default: 0 })
  amount: number;

  @ApiProperty()
  @Column({ type: 'varchar', length: 255 })
  providerId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ApiProperty({ type: () => User })
  @JoinColumn({ name: 'userId' })
  @ManyToOne(() => User, ({ dataPurchases }) => dataPurchases, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  user: User;

  @ApiProperty()
  @Column({ type: 'varchar', length: 50 })
  cablePlanId: string;

  @Column({ type: 'uuid', nullable: true })
  transactionId: string;

  @ApiProperty({ type: () => TransactionRecord })
  @JoinColumn({ name: 'transactionId' })
  @ManyToOne(() => TransactionRecord, ({ cablePurchases }) => cablePurchases, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  transaction: TransactionRecord;

  @BeforeInsert()
  beforeInsertHandler(): void {
    this.id = uuidV4();
  }
}
