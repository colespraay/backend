import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, ManyToOne, BeforeInsert } from 'typeorm';
import { Base, User, TransactionRecord, uuidV4 } from './index';

/**
 * Mirrors the activation lifecycle exposed by the GrizzlySMS API
 * (getNumber / setStatus / getStatus):
 *
 *   PENDING      -> number requested locally, provider call in flight
 *   WAITING_SMS  -> ACCESS_NUMBER received, polling for STATUS_OK
 *   RECEIVED     -> STATUS_OK:$code received, finalizing with provider (setStatus=6)
 *   COMPLETED    -> activation finished successfully, code delivered to user
 *   CANCELLED    -> cancelled by user (setStatus=-1) or by provider (STATUS_CANCEL), refunded
 *   TIMEOUT      -> expired before a code arrived, auto-cancelled by cron, refunded
 *   FAILED       -> unexpected provider error after debit, refunded
 */
export enum VirtualNumberStatus {
  PENDING = 'pending',
  WAITING_SMS = 'waiting_sms',
  RECEIVED = 'received',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
  FAILED = 'failed',
}

@Entity({ name: 'virtual_number_orders' })
export class VirtualNumberOrder extends Base {
  @ApiProperty({ description: 'User ID associated with this virtual number order' })
  @Column({ type: 'uuid' })
  userId: string;

  @ApiProperty({ type: () => User, description: 'User details' })
  @ManyToOne(() => User, (user) => user.virtualNumberOrders, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ApiProperty({ description: 'GrizzlySMS activation id' })
  @Column({ type: 'varchar', length: 100 })
  activationId: string;

  @ApiProperty({ description: 'Purchased phone number (MSISDN)' })
  @Column({ type: 'varchar', length: 30 })
  phoneNumber: string;

  @ApiProperty({ description: 'Service code, e.g. wa, tg, fb' })
  @Column({ type: 'varchar', length: 20 })
  serviceCode: string;

  @ApiProperty({ description: 'Human readable service name, e.g. Whatsapp' })
  @Column({ type: 'varchar', length: 100 })
  serviceName: string;

  @ApiProperty({ description: 'GrizzlySMS country code' })
  @Column({ type: 'varchar', length: 20 })
  countryCode: string;

  @ApiProperty({ description: 'Human readable country name, e.g. Afghanistan' })
  @Column({ type: 'varchar', length: 100 })
  countryName: string;

  @ApiProperty({ description: 'Raw provider cost in USD at time of purchase' })
  @Column({ type: 'float' })
  providerCostUsd: number;

  @ApiProperty({ description: 'Fixed markup added on top of provider cost, in USD' })
  @Column({ type: 'float', default: 1 })
  markupUsd: number;

  @ApiProperty({ description: 'providerCostUsd + markupUsd, in USD' })
  @Column({ type: 'float' })
  totalUsd: number;

  @ApiProperty({ description: 'USD -> NGN rate used for this order (cached rate at purchase time)' })
  @Column({ type: 'float' })
  fxRateUsed: number;

  @ApiProperty({ description: 'Final amount charged to the user wallet, in NGN' })
  @Column({ type: 'float' })
  amountNgn: number;

  // Named `orderStatus` (not `status`) because `Base` already declares a boolean
  // `status` column (active/soft-delete flag) — reusing that name would collide.
  @ApiProperty({ enum: VirtualNumberStatus, description: 'Current status of the order' })
  @Column({ type: 'enum', enum: VirtualNumberStatus, default: VirtualNumberStatus.PENDING })
  orderStatus: VirtualNumberStatus;

  @ApiProperty({ description: 'SMS code received from the provider, once available', required: false })
  @Column({ type: 'varchar', length: 50, nullable: true })
  smsCode: string;

  @ApiProperty({ description: 'Full SMS text received from the provider, once available', required: false })
  @Column({ type: 'text', nullable: true })
  smsText: string;

  @ApiProperty({ description: 'Whether the order was refunded (on cancel/timeout/failure)' })
  @Column({ type: 'boolean', default: false })
  refunded: boolean;

  @ApiProperty({ description: 'Timestamp after which this order auto-expires if no code was received' })
  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @ApiProperty({ description: 'Transaction ID for the debit related to this order' })
  @Column({ type: 'uuid', nullable: true })
  transactionId: string;

  @ApiProperty({ description: 'Transaction ID for the refund related to this order, if any' })
  @Column({ type: 'uuid', nullable: true })
  refundTransactionId: string;

  @ApiProperty({ description: 'Transaction details' })
  @ManyToOne(() => TransactionRecord, (transaction) => transaction.virtualNumberOrders, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'transactionId' })
  transaction: TransactionRecord;

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