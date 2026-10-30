-- Organization identity and employer membership are separate from a person's login.
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 160),
  website text CHECK (website IS NULL OR char_length(website) <= 320),
  gstin text CHECK (gstin IS NULL OR gstin ~ '^[0-9A-Z]{15}$'),
  registered_address text CHECK (registered_address IS NULL OR char_length(registered_address) <= 500),
  operating_location text NOT NULL CHECK (char_length(operating_location) BETWEEN 2 AND 200),
  verification_status text NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'manual_review', 'verified', 'rejected')),
  verification_provider text,
  provider_reference text,
  verification_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  verified_at timestamptz,
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS organizations_gstin_unique
  ON public.organizations (gstin) WHERE gstin IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.organization_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'admin', 'recruiter')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

ALTER TABLE public.company_access_requests
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS company_access_requests_organization_id
  ON public.company_access_requests (organization_id);

-- Employer verification data is private and accessed only through the trusted backend.
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.organizations, public.organization_memberships FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.organizations, public.organization_memberships TO service_role;

-- Preserve company_id as the organization's identity on job listings.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'jobs_company_id_organizations_fkey'
      AND conrelid = 'public.jobs'::regclass
  ) THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT jobs_company_id_organizations_fkey
      FOREIGN KEY (company_id) REFERENCES public.organizations(id) ON DELETE SET NULL;
  END IF;
END $$;
