
import {
  Injectable,
  OnModuleDestroy
} from '@nestjs/common';

import {
  Pool,
  PoolClient,
  QueryResultRow
} from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error('Falta DATABASE_URL');
    }

    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
  }

  getPool(): Pool {
    return this.pool;
  }

  async query<T extends QueryResultRow>(
    sql: string,
    params: unknown[] = []
  ): Promise<T[]> {
    const result = await this.pool.query<T>(
      sql,
      params
    );

    return result.rows;
  }

  async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
