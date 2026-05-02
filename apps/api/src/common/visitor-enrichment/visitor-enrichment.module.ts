import { Global, Module } from '@nestjs/common';
import { GeoIpService } from './geoip.service';
import { UaParserService } from './ua-parser.service';
import { EnrichmentService } from './enrichment.service';

@Global()
@Module({
  providers: [GeoIpService, UaParserService, EnrichmentService],
  exports: [EnrichmentService, GeoIpService],
})
export class VisitorEnrichmentModule {}
