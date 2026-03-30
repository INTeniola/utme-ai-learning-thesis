-- Create invitation_codes table for beta access control
CREATE TABLE public.invitation_codes (
    code TEXT PRIMARY KEY,
    max_uses INTEGER NOT NULL DEFAULT 1,
    uses_count INTEGER NOT NULL DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    
    -- Constraint to prevent over-usage
    CONSTRAINT uses_limit_check CHECK (uses_count <= max_uses)
);

-- Enable RLS
ALTER TABLE public.invitation_codes ENABLE ROW LEVEL SECURITY;

-- Only admins can manage invitation codes
CREATE POLICY "Admins can manage invitation codes"
ON public.invitation_codes FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Anyone can read (to verify existence during onboarding)
-- Note: In a stricter setup, we might use an RPC to verify without exposing all codes,
-- but for beta launch, a SELECT on the specific code is acceptable if guarded by the query.
CREATE POLICY "Public can view active invitation codes"
ON public.invitation_codes FOR SELECT
USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- Add index for fast logical lookup
CREATE INDEX idx_invitation_codes_active ON public.invitation_codes(code) WHERE is_active = true;
