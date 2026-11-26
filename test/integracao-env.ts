import { inject } from 'vitest';

process.env.DATABASE_URL = inject('databaseUrl');
process.env.PDV_SYNC_TOKEN = 't'.repeat(40);
process.env.IP_HASH_SECRET = 'segredo-de-teste';
process.env.CRON_SECRET = 'c'.repeat(32);
