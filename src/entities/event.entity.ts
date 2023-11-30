import { ApiProperty } from '@nestjs/swagger';
import {
  Entity,
  Column,
  OneToMany,
  BeforeInsert,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { GeoCoordinateDTO } from '@modules/event/dto/event.dto';
import { generateUniqueKey, generateQRCode, EventStatus } from '@utils/index';
import {
  Base,
  EventSpraay,
  EventInvite,
  User,
  uuidV4,
  EventCategory,
  EventRSVP,
} from './index';

@Entity({ name: 'event' })
export class EventRecord extends Base {
  @ApiProperty()
  @Column({ type: 'varchar', length: 255 })
  eventName: string;

  @ApiProperty()
  @Column({ type: 'text' })
  eventDescription: string;

  @ApiProperty()
  @Column({ type: 'text' })
  qrCodeForEvent: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 10 })
  eventCode: string;

  @ApiProperty()
  @Column({ type: 'date' })
  eventDate: Date;

  @ApiProperty()
  @Column({ type: 'varchar', length: 20 })
  time: string;

  @ApiProperty()
  @Column({ type: 'text' })
  venue: string;

  @ApiProperty({ nullable: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  eventTag: string;

  @Column({ type: 'uuid', nullable: true })
  eventCategoryId: string;

  @ApiProperty({ type: () => EventCategory })
  @JoinColumn({ name: 'eventCategoryId' })
  @ManyToOne(() => EventCategory, ({ events }) => events, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  eventCategory: EventCategory;

  @ApiProperty({ enum: EventStatus })
  @Column({ enum: EventStatus, default: EventStatus.UPCOMING })
  eventStatus: EventStatus;

  @ApiProperty()
  @Column({ type: 'text' })
  eventCoverImage: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ApiProperty({ type: () => User })
  @JoinColumn({ name: 'userId' })
  @ManyToOne(() => User, ({ events }) => events, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  user: User;

  @ApiProperty()
  @Column({ type: 'boolean', default: false })
  isNotificationSent: boolean;

  @ApiProperty()
  @Column({ type: 'json', default: { longitude: 0, latitude: 0 } })
  eventGeoCoordinates: GeoCoordinateDTO;

  @ApiProperty({ type: () => [EventSpraay] })
  @OneToMany(() => EventSpraay, ({ event }) => event, { cascade: true })
  eventSpraays: EventSpraay[];

  @ApiProperty({ type: () => [EventInvite] })
  @OneToMany(() => EventInvite, ({ event }) => event, { cascade: true })
  eventInvites: EventInvite[];

  @ApiProperty({ type: () => [EventRSVP] })
  @OneToMany(() => EventRSVP, ({ event }) => event, { cascade: true })
  eventRsvps: EventRSVP[];

  @BeforeInsert()
  async beforeInsertHandler(): Promise<void> {
    this.id = uuidV4();
    this.eventName = this.eventName.toUpperCase();
    this.eventDescription = this.eventDescription.toUpperCase();
    const eventCode = generateUniqueKey(7);
    this.eventCode = eventCode;
    this.qrCodeForEvent = await generateQRCode(eventCode);
    const tagText = this.eventName?.toLowerCase()?.slice(0, 6);
    this.eventTag = `#${tagText}`;
  }
}
