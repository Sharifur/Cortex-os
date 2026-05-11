import { Module } from '@nestjs/common';
import { EmailSanitizerService } from './email-sanitizer.service';

@Module({
  providers: [EmailSanitizerService],
  exports: [EmailSanitizerService],
})
export class EmailSanitizerModule {}
