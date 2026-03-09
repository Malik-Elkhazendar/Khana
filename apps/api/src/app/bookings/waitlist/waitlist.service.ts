import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Booking, Facility, User, WaitingListEntry } from '@khana/data-access';
import {
  ExpireWaitlistEntryResponseDto,
  JoinWaitlistResponseDto,
  NotifyNextWaitlistResponseDto,
  WaitlistListResponseDto,
  WaitlistStatusResponseDto,
} from '@khana/shared-dtos';
import { EmailService, WhatsAppService } from '@khana/notifications';
import { Repository } from 'typeorm';
import { AppLoggerService } from '../../logging';
import {
  JoinWaitlistDto,
  NotifyNextWaitlistDto,
  WaitlistListQueryDto,
  WaitlistStatusQueryDto,
} from './dto';
import { WaitlistDependencies } from './internal/waitlist.internal';
import {
  expirePastWaitlistEntries,
  expireWaitlistEntryById,
  getWaitlistStatusForSlot,
  joinWaitlistEntry,
  listWaitlistEntries,
  markWaitlistFulfilledForUserSlot,
  notifyFirstWaitlistEntryForSlot,
  notifyNextWaitlistEntryForSlot,
} from './internal/waitlist.workflows';

@Injectable()
export class WaitlistService {
  private readonly deps: WaitlistDependencies;

  constructor(
    @InjectRepository(WaitingListEntry)
    private readonly waitlistRepository: Repository<WaitingListEntry>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Facility)
    private readonly facilityRepository: Repository<Facility>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly appLogger: AppLoggerService,
    private readonly emailService: EmailService,
    private readonly whatsAppService: WhatsAppService
  ) {
    this.deps = {
      waitlistRepository,
      bookingRepository,
      facilityRepository,
      userRepository,
      appLogger,
      emailService,
      whatsAppService,
    };
  }

  async listEntries(
    query: WaitlistListQueryDto,
    tenantId: string,
    actor: User
  ): Promise<WaitlistListResponseDto> {
    return listWaitlistEntries(this.deps, query, tenantId, actor);
  }

  async joinWaitlist(
    dto: JoinWaitlistDto,
    tenantId: string,
    actor: User
  ): Promise<JoinWaitlistResponseDto> {
    return joinWaitlistEntry(this.deps, dto, tenantId, actor);
  }

  async getStatus(
    query: WaitlistStatusQueryDto,
    tenantId: string,
    actor: User
  ): Promise<WaitlistStatusResponseDto> {
    return getWaitlistStatusForSlot(this.deps, query, tenantId, actor);
  }

  async markFulfilledForUserSlot(params: {
    tenantId: string;
    userId: string;
    facilityId: string;
    desiredStartTime: Date;
    desiredEndTime: Date;
    bookingId: string;
    actorUserId?: string;
  }): Promise<boolean> {
    return markWaitlistFulfilledForUserSlot(this.deps, params);
  }

  async expirePastEntries(now?: Date): Promise<number> {
    return expirePastWaitlistEntries(this.deps, now);
  }

  async notifyFirstForSlot(params: {
    tenantId: string;
    facilityId: string;
    desiredStartTime: Date;
    desiredEndTime: Date;
    cancelledBookingId?: string;
    actorUserId?: string;
  }): Promise<{ notified: boolean; entryId?: string }> {
    return notifyFirstWaitlistEntryForSlot(this.deps, params);
  }

  async notifyNextForSlot(
    dto: NotifyNextWaitlistDto,
    tenantId: string,
    actor: User
  ): Promise<NotifyNextWaitlistResponseDto> {
    return notifyNextWaitlistEntryForSlot(this.deps, dto, tenantId, actor);
  }

  async expireEntry(
    entryId: string,
    tenantId: string,
    actor: User
  ): Promise<ExpireWaitlistEntryResponseDto> {
    return expireWaitlistEntryById(this.deps, entryId, tenantId, actor);
  }
}
