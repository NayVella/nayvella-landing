-- NayVella D1 migration 0001
-- Apply once to Preview D1, then to Production D1 after acceptance testing.
CREATE TABLE IF NOT EXISTS nayvella_leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  segment TEXT NOT NULL CHECK(segment IN ('customer_lead','merchant_lead','clinic_lead','specialist_lead')),
  email TEXT NOT NULL COLLATE NOCASE,
  consent INTEGER NOT NULL CHECK(consent = 1),
  consent_at TEXT NOT NULL,
  payload TEXT NOT NULL,
  utm TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_nayvella_leads_email_segment_created
  ON nayvella_leads(email, segment, created_at);
CREATE INDEX IF NOT EXISTS idx_nayvella_leads_segment_created
  ON nayvella_leads(segment, created_at);


CREATE TABLE IF NOT EXISTS lead_dedup (
  dedupe_hash TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_lead_dedup_expires
  ON lead_dedup(expires_at);

CREATE TABLE IF NOT EXISTS lead_rate_limits (
  client_hash TEXT NOT NULL,
  segment TEXT NOT NULL,
  window_start TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(client_hash, segment, window_start)
);
CREATE INDEX IF NOT EXISTS idx_lead_rate_limits_updated
  ON lead_rate_limits(updated_at);
