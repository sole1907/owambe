-- ============================================================
-- 017: Seed vendor data update + vendor portal accounts
-- ============================================================
-- Run this AFTER migrations 001–016.
-- Creates auth accounts for 12 featured vendors.
-- All accounts share password: !
-- ============================================================

-- ── 0. FIX ROLE CONSTRAINT ──────────────────────────────────
-- users_role_check was created without 'vendor'; add it now.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin', 'vendor'));

-- ── 1. UPDATE VENDOR DATA ───────────────────────────────────

-- VENUES (add capacity + photos + service_fee)
UPDATE vendors SET
  capacity = 2000,
  service_fee = 1000000,
  commitment_fee_percentage = 25,
  balance_payment_methods = ARRAY['bank_transfer', 'pos'],
  photos = ARRAY[
    'https://picsum.photos/seed/landmark1/800/600',
    'https://picsum.photos/seed/landmark2/800/600',
    'https://picsum.photos/seed/landmark3/800/600'
  ]
WHERE slug = 'landmark-event-centre';

UPDATE vendors SET
  capacity = 800,
  service_fee = 1500000,
  commitment_fee_percentage = 25,
  balance_payment_methods = ARRAY['bank_transfer', 'pos'],
  photos = ARRAY[
    'https://picsum.photos/seed/transcorp1/800/600',
    'https://picsum.photos/seed/transcorp2/800/600'
  ]
WHERE slug = 'transcorp-hilton-ballroom';

UPDATE vendors SET
  capacity = 300,
  service_fee = 400000,
  commitment_fee_percentage = 20,
  photos = ARRAY[
    'https://picsum.photos/seed/oceanview1/800/600',
    'https://picsum.photos/seed/oceanview2/800/600'
  ]
WHERE slug = 'oceanview-gardens';

UPDATE vendors SET
  capacity = 1500,
  service_fee = 1200000,
  commitment_fee_percentage = 20,
  balance_payment_methods = ARRAY['bank_transfer', 'pos'],
  photos = ARRAY[
    'https://picsum.photos/seed/civic1/800/600',
    'https://picsum.photos/seed/civic2/800/600',
    'https://picsum.photos/seed/civic3/800/600'
  ]
WHERE slug = 'the-civic-centre';

-- CATERERS (per-head pricing)
UPDATE vendors SET
  service_fee = 50000,
  has_material_costs = TRUE,
  per_unit_cost = 3500,
  per_unit_label = 'per head',
  commitment_fee_percentage = 20,
  photos = ARRAY[
    'https://picsum.photos/seed/nourish1/800/600',
    'https://picsum.photos/seed/nourish2/800/600'
  ]
WHERE slug = 'nourish-and-co';

UPDATE vendors SET
  service_fee = 50000,
  has_material_costs = TRUE,
  per_unit_cost = 4000,
  per_unit_label = 'per head',
  photos = ARRAY['https://picsum.photos/seed/royalfeast1/800/600']
WHERE slug = 'royal-feast-catering';

UPDATE vendors SET
  service_fee = 30000,
  has_material_costs = TRUE,
  per_unit_cost = 2500,
  per_unit_label = 'per head',
  photos = ARRAY['https://picsum.photos/seed/peppersoup1/800/600']
WHERE slug = 'pepper-soup-kitchen';

UPDATE vendors SET
  service_fee = 30000,
  has_material_costs = TRUE,
  per_unit_cost = 2800,
  per_unit_label = 'per head',
  photos = ARRAY['https://picsum.photos/seed/calabar1/800/600']
WHERE slug = 'calabar-delicacies';

-- PHOTOGRAPHERS
UPDATE vendors SET
  service_fee = 400000,
  commitment_fee_percentage = 30,
  photos = ARRAY[
    'https://picsum.photos/seed/motif1/800/600',
    'https://picsum.photos/seed/motif2/800/600',
    'https://picsum.photos/seed/motif3/800/600'
  ]
WHERE slug = 'motif-studios';

UPDATE vendors SET
  service_fee = 200000,
  photos = ARRAY[
    'https://picsum.photos/seed/clicksdami1/800/600',
    'https://picsum.photos/seed/clicksdami2/800/600'
  ]
WHERE slug = 'clicks-by-dami';

UPDATE vendors SET
  service_fee = 300000,
  photos = ARRAY['https://picsum.photos/seed/capitallens1/800/600']
WHERE slug = 'capital-lens';

-- VIDEOGRAPHERS
UPDATE vendors SET
  service_fee = 450000,
  commitment_fee_percentage = 30,
  photos = ARRAY[
    'https://picsum.photos/seed/filmhouse1/800/600',
    'https://picsum.photos/seed/filmhouse2/800/600'
  ]
WHERE slug = 'filmhouse-productions';

UPDATE vendors SET
  service_fee = 200000,
  photos = ARRAY['https://picsum.photos/seed/reelmoments1/800/600']
WHERE slug = 'reel-moments';

-- DJs
UPDATE vendors SET
  service_fee = 250000,
  commitment_fee_percentage = 20,
  photos = ARRAY[
    'https://picsum.photos/seed/djkhalid1/800/600',
    'https://picsum.photos/seed/djkhalid2/800/600'
  ]
WHERE slug = 'dj-khalid-ng';

UPDATE vendors SET
  service_fee = 200000,
  photos = ARRAY['https://picsum.photos/seed/djxcellence1/800/600']
WHERE slug = 'dj-xcellence';

-- LIVE BANDS
UPDATE vendors SET
  service_fee = 600000,
  commitment_fee_percentage = 30,
  photos = ARRAY[
    'https://picsum.photos/seed/afrovibe1/800/600',
    'https://picsum.photos/seed/afrovibe2/800/600'
  ]
WHERE slug = 'the-afro-vibe-band';

UPDATE vendors SET
  service_fee = 400000,
  photos = ARRAY['https://picsum.photos/seed/highlife1/800/600']
WHERE slug = 'highlife-kings';

-- MCs
UPDATE vendors SET
  service_fee = 200000,
  commitment_fee_percentage = 20,
  photos = ARRAY[
    'https://picsum.photos/seed/mctee1/800/600',
    'https://picsum.photos/seed/mctee2/800/600'
  ]
WHERE slug = 'mc-tee';

UPDATE vendors SET
  service_fee = 150000,
  photos = ARRAY['https://picsum.photos/seed/mcprestige1/800/600']
WHERE slug = 'mc-prestige';

-- DECORATORS
UPDATE vendors SET
  service_fee = 800000,
  commitment_fee_percentage = 25,
  balance_payment_methods = ARRAY['bank_transfer', 'pos'],
  photos = ARRAY[
    'https://picsum.photos/seed/bloomdrape1/800/600',
    'https://picsum.photos/seed/bloomdrape2/800/600',
    'https://picsum.photos/seed/bloomdrape3/800/600'
  ]
WHERE slug = 'bloom-and-drape-events';

UPDATE vendors SET
  service_fee = 400000,
  photos = ARRAY['https://picsum.photos/seed/elegance1/800/600']
WHERE slug = 'elegance-decor';

-- MAKEUP ARTISTS
UPDATE vendors SET
  service_fee = 150000,
  commitment_fee_percentage = 20,
  photos = ARRAY[
    'https://picsum.photos/seed/glamtola1/800/600',
    'https://picsum.photos/seed/glamtola2/800/600'
  ]
WHERE slug = 'glam-by-tola';

UPDATE vendors SET
  service_fee = 80000,
  photos = ARRAY['https://picsum.photos/seed/beautykemi1/800/600']
WHERE slug = 'beauty-by-kemi';

-- EVENT COORDINATORS
UPDATE vendors SET
  service_fee = 500000,
  commitment_fee_percentage = 20,
  photos = ARRAY[
    'https://picsum.photos/seed/solaevents1/800/600',
    'https://picsum.photos/seed/solaevents2/800/600'
  ]
WHERE slug = 'sola-events-and-co';

UPDATE vendors SET
  service_fee = 400000,
  photos = ARRAY['https://picsum.photos/seed/abujaplanners1/800/600']
WHERE slug = 'abuja-event-planners';


-- ── 2. VENDOR AUTH ACCOUNTS (featured vendors only) ─────────
-- Password for all accounts: !
-- Requires pgcrypto extension (enabled by default in Supabase)
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION _seed_vendor_account(
  p_email      TEXT,
  p_full_name  TEXT,
  p_password   TEXT,
  p_vendor_slug TEXT
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_user_id UUID := gen_random_uuid();
BEGIN
  -- Skip if account already exists (idempotent)
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

  INSERT INTO users (id, email, full_name, role)
  VALUES (v_user_id, p_email, p_full_name, 'vendor');

  UPDATE vendors SET user_id = v_user_id WHERE slug = p_vendor_slug;
END;
$$;

-- Featured vendors — one per category (or two for venues)
SELECT _seed_vendor_account('landmark@owambe.test',   'Landmark Event Centre',   'Owambe2025!', 'landmark-event-centre');
SELECT _seed_vendor_account('transcorp@owambe.test',  'Transcorp Hilton Ballroom','Owambe2025!', 'transcorp-hilton-ballroom');
SELECT _seed_vendor_account('civic@owambe.test',      'The Civic Centre',        'Owambe2025!', 'the-civic-centre');
SELECT _seed_vendor_account('nourish@owambe.test',    'Nourish & Co',            'Owambe2025!', 'nourish-and-co');
SELECT _seed_vendor_account('motif@owambe.test',      'Motif Studios',           'Owambe2025!', 'motif-studios');
SELECT _seed_vendor_account('filmhouse@owambe.test',  'FilmHouse Productions',   'Owambe2025!', 'filmhouse-productions');
SELECT _seed_vendor_account('djkhalid@owambe.test',   'DJ Khalid NG',            'Owambe2025!', 'dj-khalid-ng');
SELECT _seed_vendor_account('afrovibe@owambe.test',   'The Afro Vibe Band',      'Owambe2025!', 'the-afro-vibe-band');
SELECT _seed_vendor_account('mctee@owambe.test',      'MC Tee',                  'Owambe2025!', 'mc-tee');
SELECT _seed_vendor_account('bloomdrape@owambe.test', 'Bloom & Drape Events',    'Owambe2025!', 'bloom-and-drape-events');
SELECT _seed_vendor_account('glamtola@owambe.test',   'Glam by Tola',            'Owambe2025!', 'glam-by-tola');
SELECT _seed_vendor_account('solaevents@owambe.test', 'Sola Events & Co',        'Owambe2025!', 'sola-events-and-co');

DROP FUNCTION _seed_vendor_account;
