-- Function to ensure a user has an 'email' identity in auth.identities.
-- This is useful for linking OAuth accounts (like Google) to email/password login.
CREATE OR REPLACE FUNCTION public.ensure_email_identity(user_id_input UUID, email_input TEXT)
RETURNS VOID AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM auth.identities 
        WHERE user_id = user_id_input AND provider = 'email'
    ) THEN
        INSERT INTO auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
        VALUES (
            user_id_input,
            user_id_input::text,
            jsonb_build_object('sub', user_id_input, 'email', email_input, 'email_verified', true),
            'email',
            now(),
            now(),
            now()
        );
    END IF;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, auth;

-- Grant permissions to allow the Edge Function (using service_role) to call it
GRANT EXECUTE ON FUNCTION public.ensure_email_identity(UUID, TEXT) TO service_role;
