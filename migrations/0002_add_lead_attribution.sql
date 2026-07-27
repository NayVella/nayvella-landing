-- NayVella D1 migration 0002
-- Add explicit, validated form attribution without changing existing lead data.
ALTER TABLE nayvella_leads
  ADD COLUMN submission_language TEXT NOT NULL DEFAULT 'unknown'
  CHECK (submission_language IN ('ar', 'en', 'unknown'));

ALTER TABLE nayvella_leads
  ADD COLUMN source_path TEXT DEFAULT NULL
  CHECK (
    source_path IS NULL OR source_path IN (
      '/ar/customers/',
      '/en/customers/',
      '/ar/merchants/',
      '/en/merchants/',
      '/ar/clinics-doctors/',
      '/en/clinics-doctors/',
      '/ar/beauty-experts/',
      '/en/beauty-experts/'
    )
  );
