CREATE TABLE IF NOT EXISTS refunds (
  id uuid PRIMARY KEY,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency char(3) NOT NULL,
  status text NOT NULL CHECK (status IN ('unclaimed', 'pending', 'exported', 'paid', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ach_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id uuid NOT NULL UNIQUE REFERENCES refunds(id),
  account_holder_name text NOT NULL,
  routing_number text NOT NULL,
  account_number_last4 text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('checking', 'savings')),
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO refunds (id, amount_cents, currency, status)
VALUES
  ('11111111-1111-1111-1111-111111111111', 4250, 'USD', 'unclaimed'),
  ('22222222-2222-2222-2222-222222222222', 1899, 'USD', 'unclaimed'),
  ('33333333-3333-3333-3333-333333333333', 7600, 'USD', 'unclaimed'),
  ('44444444-4444-4444-4444-444444444444', 12950, 'USD', 'unclaimed')
ON CONFLICT (id) DO NOTHING;
