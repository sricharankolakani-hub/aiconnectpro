-- Add the organization details required for manual employer verification.
-- GST verification remains a human review until an approved provider is configured.
ALTER TABLE public.company_access_requests
  ADD COLUMN IF NOT EXISTS gstin text,
  ADD COLUMN IF NOT EXISTS registered_address text,
  ADD COLUMN IF NOT EXISTS operating_location text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'company_access_requests_gstin_format'
      AND conrelid = 'public.company_access_requests'::regclass
  ) THEN
    ALTER TABLE public.company_access_requests
      ADD CONSTRAINT company_access_requests_gstin_format
      CHECK (gstin IS NULL OR gstin ~ '^[0-9A-Z]{15}$');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'company_access_requests_registered_address_length'
      AND conrelid = 'public.company_access_requests'::regclass
  ) THEN
    ALTER TABLE public.company_access_requests
      ADD CONSTRAINT company_access_requests_registered_address_length
      CHECK (registered_address IS NULL OR char_length(registered_address) <= 500);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'company_access_requests_operating_location_length'
      AND conrelid = 'public.company_access_requests'::regclass
  ) THEN
    ALTER TABLE public.company_access_requests
      ADD CONSTRAINT company_access_requests_operating_location_length
      CHECK (operating_location IS NULL OR char_length(operating_location) <= 200);
  END IF;
END
$$;

COMMENT ON COLUMN public.company_access_requests.gstin IS
  'GSTIN submitted for administrator review; no external verification provider is implied.';
