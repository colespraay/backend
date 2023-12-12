import { ApiProperty } from '@nestjs/swagger';
import { Column, BeforeInsert, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { NotificationType, NotificationPurpose } from '@utils/index';
import { Base, User, uuidV4 } from './index';

@Entity({ name: 'notification_message' })
export class NotificationMessage extends Base {
  @ApiProperty()
  @Column({ type: 'varchar', length: 255 })
  subject: string;

  @ApiProperty()
  @Column({ type: 'text' })
  message: string;

  @ApiProperty()
  @Column({ type: 'text' })
  html: string;

  @ApiProperty({ enum: NotificationType })
  @Column({ enum: NotificationType, default: NotificationType.EMAIL })
  type: NotificationType;

  @ApiProperty({ enum: NotificationPurpose })
  @Column({
    enum: NotificationPurpose,
    default: NotificationPurpose.EVENT_INVITE,
  })
  purpose: NotificationPurpose;

  @Column({ type: 'uuid' })
  userId: string;

  @ApiProperty({ type: () => User })
  @JoinColumn({ name: 'userId' })
  @ManyToOne(() => User, ({ notifications }) => notifications, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  user: User;

  @ApiProperty()
  @Column({ type: 'int', default: 0 })
  numberOfTries: number;

  @BeforeInsert()
  beforeInsertHandler(): void {
    this.id = uuidV4();
  }
}
