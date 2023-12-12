import { ApiProperty } from '@nestjs/swagger';
import { BeforeInsert, Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { UserNotificationType } from '@utils/index';
import { Base, User, uuidV4 } from './index';

@Entity({ name: 'notification' })
export class Notification extends Base {
  @ApiProperty()
  @Column({ type: 'varchar', length: 255 })
  subject: string;

  @ApiProperty()
  @Column({ type: 'text' })
  message: string;

  @ApiProperty({ enum: UserNotificationType })
  @Column({
    enum: UserNotificationType,
    default: UserNotificationType.USER_SPECIFIC,
  })
  type: UserNotificationType;

  @Column({ type: 'uuid' })
  userId: string;

  @ApiProperty({ type: () => User })
  @JoinColumn({ name: 'userId' })
  @ManyToOne(() => User, ({ userNotifications }) => userNotifications, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  user: User;

  @ApiProperty()
  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @BeforeInsert()
  async beforeInsertHandler(): Promise<void> {
    this.id = uuidV4();
    this.subject = this.subject.toUpperCase();
  }
}
