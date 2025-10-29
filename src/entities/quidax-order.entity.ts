import { ApiProperty } from '@nestjs/swagger';
import { Entity, Column, BeforeInsert } from 'typeorm';
import { Base, uuidV4 } from './index'; // assuming you have a Base class with id field

@Entity({ name: 'quidax_orders' })
export class QuidaxOrder extends Base {
  @ApiProperty({ type: String, description: 'User ID associated with the order' })
  @Column({ type: 'uuid' })
  userId: string;

  @ApiProperty({ type: String, description: 'Unique Order ID' })
  @Column({ type: 'varchar', length: 255 })
  orderId: string;

  @ApiProperty({ type: String, description: 'Reason for placing the order' })
  @Column({ type: 'varchar', length: 500 })
  reasonForOrder: string;

  @ApiProperty({ type: String, description: 'The name on the bank account', required: false })
  @Column({ type: 'varchar', length: 255, nullable: true })
  accountName?: string;

  @ApiProperty({ type: String, description: 'The name of the bank', required: false })
  @Column({ type: 'varchar', length: 255, nullable: true })
  bankName?: string;

  @ApiProperty({ type: String, description: 'The bank account number', required: false })
  @Column({ type: 'varchar', length: 50, nullable: true })
  accountNumber?: string;

  @ApiProperty({ type: String, description: 'The bank code number', required: false })
  @Column({ type: 'varchar', length: 50, nullable: true })
  beneficiaryBankCode?: string;

  @ApiProperty({ description: 'Transaction status of the order' })
  @Column({ type: 'varchar', length: 100 ,nullable: true})
  transactionStatus: string;

  @ApiProperty({ description: 'Timestamp when the order was created' })
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdTime: Date;

  @ApiProperty({ description: 'Date when the order was created' })
  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  createdDate: Date;

  @BeforeInsert()
  beforeInsertHandler(): void {
    this.id = uuidV4();
  }
}
