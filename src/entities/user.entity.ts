import { ApiProperty } from '@nestjs/swagger';
import { Entity, Column, BeforeInsert, OneToMany } from 'typeorm';
import {
  DefaultPassportLink,
  AppRole,
  AuthProvider,
  hashPassword,
  Gender,
  formatPhoneNumberWithPrefix,
} from '@utils/index';
import {
  Base,
  EventRecord,
  EventInvite,
  EventSpraay,
  uuidV4,
  NotificationMessage,
  Notification,
  EventRSVP,
  TransactionRecord,
  Gifting,
  UserAccount,
  Withdrawal,
  AirtimePurchase,
  DataPurchase,
  ElectricityPurchase,
  CablePurchase,
  EventCategory,
} from './index';

@Entity({ name: 'user' })
export class User extends Base {
  @ApiProperty()
  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 255, nullable: true })
  phoneNumber: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 255, nullable: true })
  formattedPhoneNumber: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 255, nullable: true })
  firstName: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 255, nullable: true })
  lastName: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 255 })
  password: string;

  @ApiProperty()
  @Column({ type: 'float', default: 0 })
  walletBalance: number;

  @ApiProperty()
  @Column({ type: 'varchar', length: 10, nullable: true })
  uniqueVerificationCode: string;

  @ApiProperty()
  @Column({ type: 'boolean', default: false })
  isNewUser: boolean;

  @ApiProperty({ enum: AppRole })
  @Column({ enum: AppRole, default: AppRole.CUSTOMER })
  role: AppRole;

  @ApiProperty({ nullable: true })
  @Column({ type: 'text', nullable: true })
  deviceId: string;

  @ApiProperty({ enum: AuthProvider })
  @Column({ enum: AuthProvider, default: AuthProvider.LOCAL })
  authProvider: AuthProvider;

  @ApiProperty()
  @Column({ type: 'text', default: DefaultPassportLink.male })
  profileImageUrl: string;

  @ApiProperty({ nullable: true })
  @Column({ type: 'varchar', length: 12, nullable: true })
  bvn: string;

  @ApiProperty({ nullable: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  bankCustomerId: string;

  @ApiProperty({ nullable: true })
  @Column({ type: 'varchar', length: 20, nullable: true })
  virtualAccountName: string;

  @ApiProperty({ nullable: true })
  @Column({ type: 'varchar', length: 20, nullable: true })
  virtualAccountNumber: string;

  @ApiProperty()
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    default: String(process.env.DEFAULT_BANK),
  })
  bankName: string;

  @ApiProperty({ enum: Gender, nullable: true })
  @Column({ enum: Gender, nullable: true })
  gender: Gender;

  @ApiProperty({ nullable: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  flutterwaveUserKey: string;

  @ApiProperty({ nullable: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  flutterwaveNarration: string;

  @ApiProperty({ nullable: true })
  @Column({ type: 'date', nullable: true })
  dob: Date;

  @ApiProperty({ nullable: true })
  @Column({ type: 'varchar', length: 100, nullable: true })
  userTag: string;

  @ApiProperty({ nullable: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  transactionPin: string;

  @ApiProperty({ nullable: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  externalUserId: string;

  @ApiProperty()
  @Column({ type: 'boolean', default: true })
  allowPushNotifications: boolean;

  @ApiProperty()
  @Column({ type: 'boolean', default: false })
  allowSmsNotifications: boolean;

  @ApiProperty()
  @Column({ type: 'boolean', default: true })
  allowEmailNotifications: boolean;

  @ApiProperty()
  @Column({ type: 'boolean', default: true })
  displayWalletBalance: boolean;

  @ApiProperty()
  @Column({ type: 'boolean', default: false })
  enableFaceId: boolean;

  @ApiProperty({ type: () => [EventRecord] })
  @OneToMany(() => EventRecord, ({ user }) => user, { cascade: true })
  events: Event[];

  @ApiProperty({ type: () => [EventSpraay] })
  @OneToMany(() => EventSpraay, ({ user }) => user, { cascade: true })
  eventSpraays: EventSpraay[];

  @ApiProperty({ type: () => [EventInvite] })
  @OneToMany(() => EventInvite, ({ user }) => user, { cascade: true })
  eventInvites: EventInvite[];

  @ApiProperty({ type: () => [EventRSVP] })
  @OneToMany(() => EventRSVP, ({ user }) => user, { cascade: true })
  eventRsvps: EventRSVP[];

  @ApiProperty({ type: () => [NotificationMessage] })
  @OneToMany(() => NotificationMessage, ({ user }) => user, { cascade: true })
  notifications: NotificationMessage[];

  @ApiProperty({ type: () => [TransactionRecord] })
  @OneToMany(() => TransactionRecord, ({ user }) => user, { cascade: true })
  transactions: TransactionRecord[];

  @ApiProperty({ type: () => [TransactionRecord] })
  @OneToMany(() => TransactionRecord, ({ receiverUser }) => receiverUser, {
    cascade: true,
  })
  receivedTransactions: TransactionRecord[];

  @ApiProperty({ type: () => [UserAccount] })
  @OneToMany(() => UserAccount, ({ user }) => user, { cascade: true })
  userAccounts: UserAccount[];

  @ApiProperty({ type: () => [Gifting] })
  @OneToMany(() => Gifting, ({ receiverUser }) => receiverUser, {
    cascade: true,
  })
  gifts: Gifting[];

  @ApiProperty({ type: () => [Withdrawal] })
  @OneToMany(() => Withdrawal, ({ user }) => user, {
    cascade: true,
  })
  withdrawals: Withdrawal[];

  @ApiProperty({ type: () => [AirtimePurchase] })
  @OneToMany(() => AirtimePurchase, ({ user }) => user, {
    cascade: true,
  })
  airtimePurchases: AirtimePurchase[];

  @ApiProperty({ type: () => [DataPurchase] })
  @OneToMany(() => DataPurchase, ({ user }) => user, {
    cascade: true,
  })
  dataPurchases: DataPurchase[];

  @ApiProperty({ type: () => [CablePurchase] })
  @OneToMany(() => CablePurchase, ({ user }) => user, {
    cascade: true,
  })
  cablePurchases: CablePurchase[];

  @ApiProperty({ type: () => [ElectricityPurchase] })
  @OneToMany(() => ElectricityPurchase, ({ user }) => user, {
    cascade: true,
  })
  electricityPurchases: ElectricityPurchase[];

  @ApiProperty({ type: () => [Notification] })
  @OneToMany(() => Notification, ({ user }) => user, { cascade: true })
  userNotifications: Notification[];

  @ApiProperty({ type: () => [EventCategory] })
  @OneToMany(() => EventCategory, ({ user }) => user, { cascade: true })
  eventCategoriesCreated: EventCategory[];

  @BeforeInsert()
  async beforeInsertHandler(): Promise<void> {
    this.id = uuidV4();
    this.email = this.email?.toUpperCase();
    this.password = await hashPassword(this.password ?? '12345');
    if (this.phoneNumber) {
      this.formattedPhoneNumber = this.phoneNumber;
      this.formattedPhoneNumber = formatPhoneNumberWithPrefix(
        this.formattedPhoneNumber,
      );
    }
  }
}
