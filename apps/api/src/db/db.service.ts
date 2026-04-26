import { Injectable } from '@nestjs/common';
import { db, type Db } from './client';

@Injectable()
export class DbService {
  readonly db: Db = db;
}
