import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ContactsService, ContactSource } from './contacts.service';

@Controller('contacts')
@UseGuards(JwtAuthGuard)
export class ContactsController {
  constructor(private contacts: ContactsService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('source') source?: ContactSource,
    @Query('websiteTag') websiteTag?: string,
    @Query('limit') limit?: string,
  ) {
    return this.contacts.list({
      q: q || undefined,
      source: source || undefined,
      websiteTag: websiteTag || undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('stats')
  stats() {
    return this.contacts.stats();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.contacts.getById(id);
  }

  @Get(':id/activity')
  activity(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.contacts.getActivity(id, limit ? parseInt(limit, 10) : 100);
  }

  @Post()
  create(@Body() body: {
    displayName?: string;
    email?: string;
    phone?: string;
    source?: ContactSource;
    sourceRef?: string;
    websiteTag?: string;
    taskipUserId?: string;
    notes?: string;
    tags?: string[];
  }) {
    return this.contacts.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: {
    displayName?: string | null;
    email?: string | null;
    phone?: string | null;
    notes?: string | null;
    tags?: string[];
    websiteTag?: string | null;
    taskipUserId?: string | null;
  }) {
    return this.contacts.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.contacts.delete(id);
  }

  @Post(':id/activity')
  addActivity(@Param('id') id: string, @Body() body: { kind: string; summary: string; refId?: string }) {
    return this.contacts.addActivity(id, body.kind as never, body.summary, { refId: body.refId });
  }
}
