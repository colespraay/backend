import { ApiProperty } from '@nestjs/swagger';
import {
  Entity,
  Column,
  OneToMany,
  BeforeInsert,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import {
  generateUniqueKey,
  generateQRCode,
  EventCategory,
  EventStatus,
} from '@utils/index';
import {
  Base,
  EventSpraay,
  EventInvite,
  User,
  uuidV4,
  EventRSVP,
} from './index';
import { GeoCoordinateDTO } from '@modules/event/dto/event.dto';

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

  @ApiProperty({ enum: EventCategory })
  @Column({ enum: EventCategory })
  category: EventCategory;

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
  }
}
