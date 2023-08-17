import { ApiProperty } from '@nestjs/swagger';
import { Entity, Column, BeforeInsert, AfterInsert, OneToMany } from 'typeorm';
import {
  DefaultPassportLink,
  AppRole,
  AuthProvider,
  hashPassword,
  sendEmail,
  Gender,
} from '@utils/index';
import { Base, EventRecord, EventInvite, EventSpraay, uuidV4 } from './index';

@Entity({ name: 'USER' })
export class User extends Base {
  @ApiProperty()
  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 255, nullable: true })
  phoneNumber: string;

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
  @Column({ type: 'varchar', length: 10, nullable: true })
  uniqueVerificationCode: string;

  @ApiProperty()
  @Column({ type: 'boolean', default: false })
  isNewUser: boolean;

  @ApiProperty({ enum: AppRole })
  @Column({ enum: AppRole, default: AppRole.CUSTOMER })
  role: AppRole;

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
  @Column({ type: 'varchar', length: 20, nullable: true })
  virtualAccountName: string;

  @ApiProperty({ nullable: true })
  @Column({ type: 'varchar', length: 20, nullable: true })
  virtualAccountNumber: string;

  @ApiProperty({ nullable: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  bankName: string;

  @ApiProperty({ enum: Gender, nullable: true })
  @Column({ enum: Gender, nullable: true })
  gender: Gender;

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
  @Column({ type: 'boolean', default: false })
  allowPushNotifications: boolean;

  @ApiProperty()
  @Column({ type: 'boolean', default: false })
  allowSmsNotifications: boolean;

  @ApiProperty()
  @Column({ type: 'boolean', default: false })
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

  @BeforeInsert()
  async beforeInsertHandler(): Promise<void> {
    this.id = uuidV4();
    this.email = this.email?.toUpperCase();
    this.password = await hashPassword(this.password ?? '12345');
  }

  @AfterInsert()
  afterInsertHandler(): void {
    if (
      this.role !== AppRole.ADMIN &&
      this.authProvider === AuthProvider.LOCAL &&
      this.email
    ) {
      const htmlEmailTemplate = `
        <h2>Please copy the code below to verify your account</h2>
        <h3>${this.uniqueVerificationCode}</h3>
      `;
      setTimeout(async () => {
        await sendEmail(htmlEmailTemplate, 'Verify Account', [this.email]);
      }, 5000);
    }
  }
}
