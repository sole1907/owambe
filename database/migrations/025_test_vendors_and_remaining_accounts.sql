-- ============================================================
-- 025: Mark all seeded vendors as test vendors + create
--      auth accounts for the 13 vendors not covered by 017
-- ============================================================
-- All bootstrapped vendors are marked is_test_vendor = true.
-- The email service intercepts @owambe.test addresses and
-- redirects them to the configured TEST_EMAIL_INTERCEPT address
-- so the operator can preview notification emails.
-- ============================================================

-- 1. Add is_test_vendor flag to vendors table
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS is_test_vendor BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Mark every vendor currently in the DB as a test vendor
--    (all were bootstrapped via seed migrations)
UPDATE vendors SET is_test_vendor = TRUE;

-- 3. Reuse the seed helper from 017 (recreate it here since it was dropped)
CREATE OR REPLACE FUNCTION _seed_vendor_account(
  p_email       TEXT,
  p_full_name   TEXT,
  p_password    TEXT,
  p_vendor_slug TEXT
) RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    -- Already exists — just make sure the vendor link is set
    SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
    UPDATE vendors SET user_id = v_user_id WHERE slug = p_vendor_slug AND user_id IS NULL;
    RETURN;
  END IF;

  v_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    id, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    aud, role, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) VALUES (
    v_user_id,
    p_email,
    crypt(p_password, gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('sub', v_user_id::text, 'email', p_email),
    'authenticated', 'authenticated',
    '', '', '', ''
  );

  INSERT INTO users (id, email, full_name, role)
  VALUES (v_user_id, p_email, p_full_name, 'vendor')
  ON CONFLICT (id) DO NOTHING;

  UPDATE vendors SET user_id = v_user_id WHERE slug = p_vendor_slug;
END;
$$ LANGUAGE plpgsql;

-- 4. Create accounts for the 13 vendors not covered by migration 017
--    All share password: Owambe2025!
SELECT _seed_vendor_account('oceanview@owambe.test',   'Oceanview Gardens',      'Owambe2025!', 'oceanview-gardens');
SELECT _seed_vendor_account('royalfeast@owambe.test',  'Royal Feast Catering',   'Owambe2025!', 'royal-feast-catering');
SELECT _seed_vendor_account('peppersoup@owambe.test',  'Pepper Soup Kitchen',    'Owambe2025!', 'pepper-soup-kitchen');
SELECT _seed_vendor_account('calabar@owambe.test',     'Calabar Delicacies',     'Owambe2025!', 'calabar-delicacies');
SELECT _seed_vendor_account('clicksdami@owambe.test',  'Clicks by Dami',         'Owambe2025!', 'clicks-by-dami');
SELECT _seed_vendor_account('capitallens@owambe.test', 'Capital Lens',           'Owambe2025!', 'capital-lens');
SELECT _seed_vendor_account('reelmoments@owambe.test', 'Reel Moments',           'Owambe2025!', 'reel-moments');
SELECT _seed_vendor_account('djxcellence@owambe.test', 'DJ Xcellence',           'Owambe2025!', 'dj-xcellence');
SELECT _seed_vendor_account('highlifekings@owambe.test','Highlife Kings',         'Owambe2025!', 'highlife-kings');
SELECT _seed_vendor_account('mcprestige@owambe.test',  'MC Prestige',            'Owambe2025!', 'mc-prestige');
SELECT _seed_vendor_account('elegancedecor@owambe.test','Elegance Décor',        'Owambe2025!', 'elegance-decor');
SELECT _seed_vendor_account('beautykemi@owambe.test',  'Beauty by Kemi',         'Owambe2025!', 'beauty-by-kemi');
SELECT _seed_vendor_account('lordmayormc@owambe.test', 'Lord Mayor MC',          'Owambe2025!', 'lord-mayor-mc');

DROP FUNCTION _seed_vendor_account;
