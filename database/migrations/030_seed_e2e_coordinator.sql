-- Seed a non-vendor test user for E2E coordinator browser tests.
-- solaevents@owambe.test is a vendor account (redirected to vendor portal on login),
-- so coordinator E2E browser tests need a separate regular user account.

CREATE OR REPLACE FUNCTION _seed_organiser_account(
  p_email     TEXT,
  p_full_name TEXT,
  p_password  TEXT
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_user_id UUID := gen_random_uuid();
BEGIN
  -- Idempotent: skip if account already exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RETURN;
  END IF;

  INSERT INTO auth.users (
    id, instance_id, aud, role,
    email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data,
    provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', p_email),
    'email',
    p_email,
    now(), now(), now()
  );

  -- role = 'user' (regular non-vendor user; constraint allows 'user', 'admin', 'vendor')
  INSERT INTO users (id, email, full_name, role)
  VALUES (v_user_id, p_email, p_full_name, 'user');
END;
$$;

-- E2E test coordinator account (non-vendor, can access organiser dashboard)
SELECT _seed_organiser_account(
  'e2e.coordinator@owambe.test',
  'E2E Test Coordinator',
  'Owambe2025!'
);

DROP FUNCTION _seed_organiser_account;
