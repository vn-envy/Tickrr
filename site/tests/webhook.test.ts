import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import DodoPayments from 'dodopayments';
const secret = Buffer.from('tickrr-test-only-signing-secret-32').toString(
  'base64',
);
const client = new DodoPayments({
  bearerToken: 'test-not-a-real-key',
  webhookKey: `whsec_${secret}`,
  environment: 'test_mode',
});
function signed(raw: string, t = Math.floor(Date.now() / 1000)) {
  const id = 'test-event-1';
  return {
    'webhook-id': id,
    'webhook-timestamp': String(t),
    'webhook-signature': `v1,${createHmac('sha256', Buffer.from(secret, 'base64')).update(`${id}.${t}.${raw}`).digest('base64')}`,
  };
}
const payload = JSON.stringify({
  business_id: 'test-business',
  type: 'subscription.active',
  timestamp: new Date().toISOString(),
  data: { subscription_id: 'test-subscription' },
});
test('Dodo accepts authentic raw-body signature', () =>
  assert.equal(
    client.webhooks.unwrap(payload, { headers: signed(payload) }).type,
    'subscription.active',
  ));
test('Dodo rejects tampered body and wrong signing key', () => {
  assert.throws(() =>
    client.webhooks.unwrap(payload + ' ', { headers: signed(payload) }),
  );
  assert.throws(() =>
    client.webhooks.unwrap(payload, {
      headers: { ...signed(payload), 'webhook-signature': 'v1,invalid' },
    }),
  );
});
test('Dodo rejects replay timestamp outside tolerance', () =>
  assert.throws(() =>
    client.webhooks.unwrap(payload, {
      headers: signed(payload, Math.floor(Date.now() / 1000) - 3600),
    }),
  ));
