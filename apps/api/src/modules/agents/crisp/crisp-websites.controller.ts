import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CrispService } from './crisp.service';

@Controller('crisp/websites')
@UseGuards(JwtAuthGuard)
export class CrispWebsitesController {
  constructor(private crisp: CrispService) {}

  @Get()
  list() {
    return this.crisp.listWebsites();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  add(
    @Body()
    dto: {
      label: string;
      websiteId: string;
      identifier: string;
      apiKey: string;
      productContext?: string;
      replyTone?: string;
    },
  ) {
    return this.crisp.addWebsite(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body()
    dto: {
      label?: string;
      websiteId?: string;
      identifier?: string;
      apiKey?: string;
      enabled?: boolean;
      productContext?: string | null;
      replyTone?: string | null;
    },
  ) {
    return this.crisp.updateWebsite(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.crisp.deleteWebsite(id);
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  test(@Param('id') id: string) {
    return this.crisp.testWebsite(id);
  }
}
