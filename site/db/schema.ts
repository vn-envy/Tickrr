import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
} from 'drizzle-orm/sqlite-core';
export const cache = sqliteTable('cache', {
  key: text('key').primaryKey(),
  payload: text('payload').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
export const watches = sqliteTable(
  'watches',
  {
    userId: text('user_id').notNull(),
    marketId: text('market_id').notNull(),
    title: text('title').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.marketId] })],
);
export const subscriptions = sqliteTable(
  'subscriptions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    customerId: text('customer_id').notNull(),
    productId: text('product_id').notNull(),
    status: text('status').notNull(),
    validUntil: integer('valid_until').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [index('idx_subscriptions_user').on(t.userId)],
);
export const checkoutOwners = sqliteTable('checkout_owners', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  email: text('email').notNull(),
  createdAt: integer('created_at').notNull(),
});
export const webhookEvents = sqliteTable('webhook_events', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  receivedAt: integer('received_at').notNull(),
});
export const usage = sqliteTable(
  'usage',
  {
    id: text('id').primaryKey(),
    count: integer('count').notNull(),
    expiresAt: integer('expires_at').notNull(),
  },
  (t) => [index('idx_usage_expiry').on(t.expiresAt)],
);
export const apiKeys = sqliteTable(
  'api_keys',
  {
    hash: text('hash').primaryKey(),
    userId: text('user_id').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('idx_api_keys_user').on(t.userId)],
);
