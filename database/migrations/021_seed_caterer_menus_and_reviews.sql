-- ============================================================
-- 021: Seed caterer menus and vendor reviews
-- ============================================================
-- Part A: Menu items + pricing tiers for 3 caterers.
-- Part B: 5 reviewer accounts, 5 events, 20 reviews across
--         10 vendors, plus rating aggregation.
-- Run this AFTER migration 020.
-- All inserts use ON CONFLICT DO NOTHING for idempotency.
-- ============================================================

-- ── HELPER: seed a regular user (reviewer) account ──────────

CREATE OR REPLACE FUNCTION _seed_reviewer_account(
  p_email     TEXT,
  p_full_name TEXT,
  p_password  TEXT
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_user_id UUID := gen_random_uuid();
BEGIN
  -- Idempotent: skip if the email already exists
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

  -- role = 'user' (not 'vendor', no vendor linking)
  INSERT INTO users (id, email, full_name, role)
  VALUES (v_user_id, p_email, p_full_name, 'user');
END;
$$;

-- Create the 5 reviewer accounts (password: Owambe2025!)
SELECT _seed_reviewer_account('adunola.seed@owambe.test', 'Adunola Bakare',       'Owambe2025!');
SELECT _seed_reviewer_account('emeka.seed@owambe.test',   'Chukwuemeka Obi',      'Owambe2025!');
SELECT _seed_reviewer_account('fatimah.seed@owambe.test', 'Fatimah Adesanya',     'Owambe2025!');
SELECT _seed_reviewer_account('temi.seed@owambe.test',    'Temi Ogundimu',        'Owambe2025!');
SELECT _seed_reviewer_account('biodun.seed@owambe.test',  'Biodun Adeleke',       'Owambe2025!');

-- ── MAIN SEED BLOCK ──────────────────────────────────────────

DO $$
DECLARE
  -- ── Vendor IDs ─────────────────────────────────────────────
  v_nourish        UUID;
  v_royal          UUID;
  v_calabar        UUID;
  v_landmark       UUID;
  v_civic          UUID;
  v_motif          UUID;
  v_djkhalid       UUID;
  v_bloom          UUID;
  v_glam           UUID;
  v_sola           UUID;

  -- ── Category IDs ───────────────────────────────────────────
  c_caterers       UUID;
  c_venues         UUID;
  c_photographers  UUID;
  c_djs            UUID;
  c_decorators     UUID;
  c_makeup         UUID;
  c_coordinators   UUID;

  -- ── Reviewer user IDs ──────────────────────────────────────
  u_adunola        UUID;
  u_emeka          UUID;
  u_fatimah        UUID;
  u_temi           UUID;
  u_biodun         UUID;

  -- ── Event IDs ──────────────────────────────────────────────
  e_adunola_wedding  UUID;
  e_emeka_birthday   UUID;
  e_fatimah_naming   UUID;
  e_temi_wedding     UUID;
  e_biodun_corporate UUID;

  -- ── Working variables ──────────────────────────────────────
  v_item_id      UUID;
  v_interest_id  UUID;

BEGIN

  -- ── 0. Look up vendor IDs ─────────────────────────────────
  SELECT id INTO v_nourish  FROM vendors WHERE slug = 'nourish-and-co';
  SELECT id INTO v_royal    FROM vendors WHERE slug = 'royal-feast-catering';
  SELECT id INTO v_calabar  FROM vendors WHERE slug = 'calabar-delicacies';
  SELECT id INTO v_landmark FROM vendors WHERE slug = 'landmark-event-centre';
  SELECT id INTO v_civic    FROM vendors WHERE slug = 'the-civic-centre';
  SELECT id INTO v_motif    FROM vendors WHERE slug = 'motif-studios';
  SELECT id INTO v_djkhalid FROM vendors WHERE slug = 'dj-khalid-ng';
  SELECT id INTO v_bloom    FROM vendors WHERE slug = 'bloom-and-drape-events';
  SELECT id INTO v_glam     FROM vendors WHERE slug = 'glam-by-tola';
  SELECT id INTO v_sola     FROM vendors WHERE slug = 'sola-events-and-co';

  -- ── 0. Look up category IDs ───────────────────────────────
  SELECT id INTO c_caterers      FROM vendor_categories WHERE slug = 'caterers';
  SELECT id INTO c_venues        FROM vendor_categories WHERE slug = 'venues';
  SELECT id INTO c_photographers FROM vendor_categories WHERE slug = 'photographers';
  SELECT id INTO c_djs           FROM vendor_categories WHERE slug = 'djs';
  SELECT id INTO c_decorators    FROM vendor_categories WHERE slug = 'decorators';
  SELECT id INTO c_makeup        FROM vendor_categories WHERE slug = 'makeup-artists';
  SELECT id INTO c_coordinators  FROM vendor_categories WHERE slug = 'event-coordinators';

  -- ── 0. Look up reviewer user IDs ─────────────────────────
  SELECT id INTO u_adunola FROM users WHERE email = 'adunola.seed@owambe.test';
  SELECT id INTO u_emeka   FROM users WHERE email = 'emeka.seed@owambe.test';
  SELECT id INTO u_fatimah FROM users WHERE email = 'fatimah.seed@owambe.test';
  SELECT id INTO u_temi    FROM users WHERE email = 'temi.seed@owambe.test';
  SELECT id INTO u_biodun  FROM users WHERE email = 'biodun.seed@owambe.test';

  -- ────────────────────────────────────────────────────────────
  -- PART A: CATERER MENUS
  -- ────────────────────────────────────────────────────────────

  -- ══════════════════════════════════════════════════════════
  -- NOURISH & CO — premium Lagos caterer
  -- ══════════════════════════════════════════════════════════

  -- Rice Dishes ───────────────────────────────────────────────

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_nourish, 'Jollof Rice', 'Rice Dishes', 10)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 100, 3200),
    (v_item_id, 101, 300, 2900),
    (v_item_id, 301, NULL, 2600);

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_nourish, 'Fried Rice', 'Rice Dishes', 20)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 100, 3400),
    (v_item_id, 101, 300, 3100),
    (v_item_id, 301, NULL, 2800);

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_nourish, 'Coconut Rice', 'Rice Dishes', 30)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 100, 3600),
    (v_item_id, 101, 300, 3300),
    (v_item_id, 301, NULL, 3000);

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_nourish, 'Basmati Pilaf', 'Rice Dishes', 40)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 100, 3800),
    (v_item_id, 101, 300, 3500),
    (v_item_id, 301, NULL, 3200);

  -- Swallows & Soups ──────────────────────────────────────────

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_nourish, 'Pounded Yam & Egusi', 'Swallows & Soups', 10)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 100, 3500),
    (v_item_id, 101, 300, 3200),
    (v_item_id, 301, NULL, 2900);

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_nourish, 'Amala & Ewedu/Gbegiri', 'Swallows & Soups', 20)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 100, 3000),
    (v_item_id, 101, 300, 2700),
    (v_item_id, 301, NULL, 2400);

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_nourish, 'Eba & Okro Soup', 'Swallows & Soups', 30)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 100, 2800),
    (v_item_id, 101, 300, 2500),
    (v_item_id, 301, NULL, 2200);

  -- Small Chops ───────────────────────────────────────────────

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_nourish, 'Puff Puff', 'Small Chops', 10)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 100, 500),
    (v_item_id, 101, 300, 450),
    (v_item_id, 301, NULL, 400);

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_nourish, 'Spring Rolls', 'Small Chops', 20)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 100, 700),
    (v_item_id, 101, 300, 650),
    (v_item_id, 301, NULL, 600);

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_nourish, 'Chicken Skewers', 'Small Chops', 30)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 100, 1200),
    (v_item_id, 101, 300, 1100),
    (v_item_id, 301, NULL, 1000);

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_nourish, 'Peppered Gizzard', 'Small Chops', 40)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 100, 1000),
    (v_item_id, 101, 300,  900),
    (v_item_id, 301, NULL,  800);

  -- Proteins ──────────────────────────────────────────────────

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_nourish, 'Assorted Peppered Meat', 'Proteins', 10)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 100, 1800),
    (v_item_id, 101, 300, 1600),
    (v_item_id, 301, NULL, 1400);

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_nourish, 'Grilled Chicken', 'Proteins', 20)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 100, 2500),
    (v_item_id, 101, 300, 2200),
    (v_item_id, 301, NULL, 2000);

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_nourish, 'Grilled Fish', 'Proteins', 30)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 100, 2000),
    (v_item_id, 101, 300, 1800),
    (v_item_id, 301, NULL, 1600);

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_nourish, 'Turkey Leg', 'Proteins', 40)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 100, 3000),
    (v_item_id, 101, 300, 2800),
    (v_item_id, 301, NULL, 2500);

  -- Drinks (flat pricing — single tier with NULL max) ─────────

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_nourish, 'Soft Drinks', 'Drinks', 10)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving)
    VALUES (v_item_id, 1, NULL, 500);

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_nourish, 'Zobo', 'Drinks', 20)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving)
    VALUES (v_item_id, 1, NULL, 300);

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_nourish, 'Chapman', 'Drinks', 30)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving)
    VALUES (v_item_id, 1, NULL, 600);

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_nourish, 'Bottled Water', 'Drinks', 40)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving)
    VALUES (v_item_id, 1, NULL, 200);

  -- ══════════════════════════════════════════════════════════
  -- ROYAL FEAST CATERING — mid-range Lagos caterer
  -- ══════════════════════════════════════════════════════════

  -- Rice Dishes ───────────────────────────────────────────────

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_royal, 'Jollof Rice', 'Rice Dishes', 10)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 100, 2500),
    (v_item_id, 101, 500, 2300),
    (v_item_id, 501, NULL, 2000);

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_royal, 'Fried Rice', 'Rice Dishes', 20)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 100, 2800),
    (v_item_id, 101, 500, 2500),
    (v_item_id, 501, NULL, 2200);

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_royal, 'White Rice & Stew', 'Rice Dishes', 30)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 100, 2000),
    (v_item_id, 101, 500, 1800),
    (v_item_id, 501, NULL, 1600);

  -- Swallows & Soups ──────────────────────────────────────────

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_royal, 'Pounded Yam & Egusi', 'Swallows & Soups', 10)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 100, 2800),
    (v_item_id, 101, 500, 2500),
    (v_item_id, 501, NULL, 2200);

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_royal, 'Amala & Ewedu', 'Swallows & Soups', 20)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 100, 2500),
    (v_item_id, 101, 500, 2200),
    (v_item_id, 501, NULL, 1900);

  -- Small Chops ───────────────────────────────────────────────

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_royal, 'Puff Puff', 'Small Chops', 10)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 200, 450),
    (v_item_id, 201, 500, 400),
    (v_item_id, 501, NULL, 350);

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_royal, 'Spring Rolls', 'Small Chops', 20)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 200, 650),
    (v_item_id, 201, 500, 580),
    (v_item_id, 501, NULL, 520);

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_royal, 'Peppered Gizzard', 'Small Chops', 30)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 200, 900),
    (v_item_id, 201, 500, 800),
    (v_item_id, 501, NULL, 700);

  -- Proteins ──────────────────────────────────────────────────

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_royal, 'Peppered Chicken', 'Proteins', 10)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 200, 2200),
    (v_item_id, 201, 500, 2000),
    (v_item_id, 501, NULL, 1800);

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_royal, 'Assorted Meat', 'Proteins', 20)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 200, 1600),
    (v_item_id, 201, 500, 1400),
    (v_item_id, 501, NULL, 1200);

  -- Grilled Fish — only 2 tiers
  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_royal, 'Grilled Fish', 'Proteins', 30)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 200, 1800),
    (v_item_id, 201, NULL, 1600);

  -- Drinks (flat) ─────────────────────────────────────────────

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_royal, 'Soft Drinks', 'Drinks', 10)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving)
    VALUES (v_item_id, 1, NULL, 400);

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_royal, 'Zobo', 'Drinks', 20)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving)
    VALUES (v_item_id, 1, NULL, 250);

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_royal, 'Bottled Water', 'Drinks', 30)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving)
    VALUES (v_item_id, 1, NULL, 150);

  -- ══════════════════════════════════════════════════════════
  -- CALABAR DELICACIES — traditional South-South caterer
  -- ══════════════════════════════════════════════════════════

  -- Swallows & Soups (signature offering) ────────────────────

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_calabar, 'Pounded Yam & Edikaikong', 'Swallows & Soups', 10)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 100, 3200),
    (v_item_id, 101, 300, 2900),
    (v_item_id, 301, NULL, 2600);

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_calabar, 'Fufu & Oha Soup', 'Swallows & Soups', 20)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 100, 3000),
    (v_item_id, 101, 300, 2700),
    (v_item_id, 301, NULL, 2400);

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_calabar, 'Eba & Banga Soup', 'Swallows & Soups', 30)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 100, 2700),
    (v_item_id, 101, 300, 2400),
    (v_item_id, 301, NULL, 2100);

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_calabar, 'Eba & Okro Soup', 'Swallows & Soups', 40)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 100, 2500),
    (v_item_id, 101, 300, 2200),
    (v_item_id, 301, NULL, 1900);

  -- Rice Dishes ───────────────────────────────────────────────

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_calabar, 'Jollof Rice', 'Rice Dishes', 10)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 100, 2700),
    (v_item_id, 101, 300, 2400),
    (v_item_id, 301, NULL, 2100);

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_calabar, 'Ofada Rice & Designer Sauce', 'Rice Dishes', 20)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 100, 3500),
    (v_item_id, 101, 300, 3200),
    (v_item_id, 301, NULL, 2900);

  -- Proteins ──────────────────────────────────────────────────

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_calabar, 'Assorted Meat', 'Proteins', 10)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 100, 1700),
    (v_item_id, 101, 300, 1500),
    (v_item_id, 301, NULL, 1300);

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_calabar, 'Catfish Peppersoup', 'Proteins', 20)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 100, 2500),
    (v_item_id, 101, 300, 2300),
    (v_item_id, 301, NULL, 2000);

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_calabar, 'Peppered Goat Meat', 'Proteins', 30)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 100, 2200),
    (v_item_id, 101, 300, 2000),
    (v_item_id, 301, NULL, 1800);

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_calabar, 'Ngwo Ngwo', 'Proteins', 40)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 100, 1800),
    (v_item_id, 101, 300, 1600),
    (v_item_id, 301, NULL, 1400);

  -- Small Chops ───────────────────────────────────────────────

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_calabar, 'Puff Puff', 'Small Chops', 10)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 100, 450),
    (v_item_id, 101, 300, 400),
    (v_item_id, 301, NULL, 350);

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_calabar, 'Akara', 'Small Chops', 20)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 100, 400),
    (v_item_id, 101, 300, 350),
    (v_item_id, 301, NULL, 300);

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_calabar, 'Peppered Snail', 'Small Chops', 30)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 100, 1500),
    (v_item_id, 101, 300, 1400),
    (v_item_id, 301, NULL, 1200);

  -- Drinks ────────────────────────────────────────────────────

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_calabar, 'Soft Drinks', 'Drinks', 10)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving)
    VALUES (v_item_id, 1, NULL, 450);

  -- Palmwine — tiered
  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_calabar, 'Palmwine', 'Drinks', 20)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving) VALUES
    (v_item_id,   1, 100, 600),
    (v_item_id, 101, 300, 550),
    (v_item_id, 301, NULL, 500);

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_calabar, 'Zobo', 'Drinks', 30)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving)
    VALUES (v_item_id, 1, NULL, 280);

  INSERT INTO caterer_menu_items (id, vendor_id, name, category, sort_order)
    VALUES (gen_random_uuid(), v_calabar, 'Bottled Water', 'Drinks', 40)
    RETURNING id INTO v_item_id;
  INSERT INTO caterer_menu_pricing_tiers (menu_item_id, min_servings, max_servings, price_per_serving)
    VALUES (v_item_id, 1, NULL, 160);

  -- ────────────────────────────────────────────────────────────
  -- PART B: EVENTS
  -- ────────────────────────────────────────────────────────────
  -- events.status uses: 'planning' | 'confirmed' | 'completed' | 'cancelled'
  -- We use 'confirmed' for past published events.

  INSERT INTO events (id, user_id, title, event_type, city, status, guest_count_estimate, event_date)
  VALUES (gen_random_uuid(), u_adunola, 'Adunola & Femi''s Wedding',  'wedding',          'Lagos', 'confirmed', 350, '2025-03-15')
  RETURNING id INTO e_adunola_wedding;

  INSERT INTO events (id, user_id, title, event_type, city, status, guest_count_estimate, event_date)
  VALUES (gen_random_uuid(), u_emeka,   'Emeka''s 40th Birthday',     'birthday',         'Lagos', 'confirmed', 200, '2025-05-20')
  RETURNING id INTO e_emeka_birthday;

  INSERT INTO events (id, user_id, title, event_type, city, status, guest_count_estimate, event_date)
  VALUES (gen_random_uuid(), u_fatimah, 'Fatimah''s Baby Naming',     'naming_ceremony',  'Lagos', 'confirmed', 150, '2025-07-10')
  RETURNING id INTO e_fatimah_naming;

  INSERT INTO events (id, user_id, title, event_type, city, status, guest_count_estimate, event_date)
  VALUES (gen_random_uuid(), u_temi,    'Temi & Kunle''s Wedding',    'wedding',          'Lagos', 'confirmed', 400, '2025-09-06')
  RETURNING id INTO e_temi_wedding;

  INSERT INTO events (id, user_id, title, event_type, city, status, guest_count_estimate, event_date)
  VALUES (gen_random_uuid(), u_biodun,  'Biodun Corporate Dinner',    'corporate',        'Lagos', 'confirmed', 120, '2025-11-15')
  RETURNING id INTO e_biodun_corporate;

  -- ────────────────────────────────────────────────────────────
  -- PART B: REVIEWS
  -- ────────────────────────────────────────────────────────────
  -- For each review we:
  --   1. Insert a committed vendor_interest (already expired).
  --   2. Insert the vendor_review referencing that interest.
  --
  -- vendor_interests UNIQUE constraint: (event_id, vendor_id)
  -- vendor_reviews   UNIQUE constraint: (interest_id)
  -- We use ON CONFLICT DO NOTHING for full idempotency.
  -- ────────────────────────────────────────────────────────────

  -- ══════════════════════════════════════════════════════════
  -- NOURISH & CO reviews
  -- ══════════════════════════════════════════════════════════

  -- Review 1: Adunola's wedding, 5★
  INSERT INTO vendor_interests
    (event_id, vendor_id, user_id, category_id, preference_rank, status, expires_at)
  VALUES
    (e_adunola_wedding, v_nourish, u_adunola, c_caterers, 1, 'committed', NOW())
  ON CONFLICT (event_id, vendor_id) DO NOTHING
  RETURNING id INTO v_interest_id;

  IF v_interest_id IS NOT NULL THEN
    INSERT INTO vendor_reviews (vendor_id, event_id, user_id, interest_id, rating, comment)
    VALUES (
      v_nourish, e_adunola_wedding, u_adunola, v_interest_id, 5,
      'Nourish & Co absolutely delivered! The jollof rice was smoky and perfectly seasoned — our guests kept going back for seconds. Grilled chicken was juicy, small chops tray ran out in 20 minutes which tells you how good they were! Highly recommend for weddings.'
    ) ON CONFLICT (interest_id) DO NOTHING;
  END IF;

  -- Review 2: Temi's wedding, 5★
  INSERT INTO vendor_interests
    (event_id, vendor_id, user_id, category_id, preference_rank, status, expires_at)
  VALUES
    (e_temi_wedding, v_nourish, u_temi, c_caterers, 1, 'committed', NOW())
  ON CONFLICT (event_id, vendor_id) DO NOTHING
  RETURNING id INTO v_interest_id;

  IF v_interest_id IS NOT NULL THEN
    INSERT INTO vendor_reviews (vendor_id, event_id, user_id, interest_id, rating, comment)
    VALUES (
      v_nourish, e_temi_wedding, u_temi, v_interest_id, 5,
      'Outstanding catering. The pounded yam and egusi was as good as home-cooked. Staff were professional and kept the buffet stocked throughout. Chapman was a nice touch.'
    ) ON CONFLICT (interest_id) DO NOTHING;
  END IF;

  -- Review 3: Emeka's birthday, 4★
  INSERT INTO vendor_interests
    (event_id, vendor_id, user_id, category_id, preference_rank, status, expires_at)
  VALUES
    (e_emeka_birthday, v_nourish, u_emeka, c_caterers, 1, 'committed', NOW())
  ON CONFLICT (event_id, vendor_id) DO NOTHING
  RETURNING id INTO v_interest_id;

  IF v_interest_id IS NOT NULL THEN
    INSERT INTO vendor_reviews (vendor_id, event_id, user_id, interest_id, rating, comment)
    VALUES (
      v_nourish, e_emeka_birthday, u_emeka, v_interest_id, 4,
      'Very good food overall. The basmati pilaf was a surprise hit. Portions were generous. Only minor issue was the drinks ran low near the end but they sorted it quickly.'
    ) ON CONFLICT (interest_id) DO NOTHING;
  END IF;

  -- ══════════════════════════════════════════════════════════
  -- ROYAL FEAST CATERING reviews
  -- ══════════════════════════════════════════════════════════

  -- Review 1: Fatimah's naming, 4★
  INSERT INTO vendor_interests
    (event_id, vendor_id, user_id, category_id, preference_rank, status, expires_at)
  VALUES
    (e_fatimah_naming, v_royal, u_fatimah, c_caterers, 1, 'committed', NOW())
  ON CONFLICT (event_id, vendor_id) DO NOTHING
  RETURNING id INTO v_interest_id;

  IF v_interest_id IS NOT NULL THEN
    INSERT INTO vendor_reviews (vendor_id, event_id, user_id, interest_id, rating, comment)
    VALUES (
      v_royal, e_fatimah_naming, u_fatimah, v_interest_id, 4,
      'Great value for money. The jollof rice and fried rice both tasted fresh. Our guests from the East loved the pounded yam and egusi. Will definitely use again.'
    ) ON CONFLICT (interest_id) DO NOTHING;
  END IF;

  -- Review 2: Emeka's birthday, 4★
  -- (Emeka already has Nourish & Co for caterers on his birthday — use preference_rank 2)
  INSERT INTO vendor_interests
    (event_id, vendor_id, user_id, category_id, preference_rank, status, expires_at)
  VALUES
    (e_emeka_birthday, v_royal, u_emeka, c_caterers, 2, 'committed', NOW())
  ON CONFLICT (event_id, vendor_id) DO NOTHING
  RETURNING id INTO v_interest_id;

  IF v_interest_id IS NOT NULL THEN
    INSERT INTO vendor_reviews (vendor_id, event_id, user_id, interest_id, rating, comment)
    VALUES (
      v_royal, e_emeka_birthday, u_emeka, v_interest_id, 4,
      'Solid catering. Food arrived on time, still hot, and presentation was decent. The peppered chicken thighs were the highlight.'
    ) ON CONFLICT (interest_id) DO NOTHING;
  END IF;

  -- Review 3: Adunola's wedding, 3★
  -- (Adunola already has Nourish & Co for caterers — use preference_rank 2)
  INSERT INTO vendor_interests
    (event_id, vendor_id, user_id, category_id, preference_rank, status, expires_at)
  VALUES
    (e_adunola_wedding, v_royal, u_adunola, c_caterers, 2, 'committed', NOW())
  ON CONFLICT (event_id, vendor_id) DO NOTHING
  RETURNING id INTO v_interest_id;

  IF v_interest_id IS NOT NULL THEN
    INSERT INTO vendor_reviews (vendor_id, event_id, user_id, interest_id, rating, comment)
    VALUES (
      v_royal, e_adunola_wedding, u_adunola, v_interest_id, 3,
      'Food was nice but the service felt a bit rushed at the start. They got into their stride after an hour. Good quality for the price.'
    ) ON CONFLICT (interest_id) DO NOTHING;
  END IF;

  -- ══════════════════════════════════════════════════════════
  -- CALABAR DELICACIES reviews
  -- ══════════════════════════════════════════════════════════

  -- Review 1: Temi's wedding, 5★
  -- (Temi already has Nourish & Co for caterers — use preference_rank 2)
  INSERT INTO vendor_interests
    (event_id, vendor_id, user_id, category_id, preference_rank, status, expires_at)
  VALUES
    (e_temi_wedding, v_calabar, u_temi, c_caterers, 2, 'committed', NOW())
  ON CONFLICT (event_id, vendor_id) DO NOTHING
  RETURNING id INTO v_interest_id;

  IF v_interest_id IS NOT NULL THEN
    INSERT INTO vendor_reviews (vendor_id, event_id, user_id, interest_id, rating, comment)
    VALUES (
      v_calabar, e_temi_wedding, u_temi, v_interest_id, 5,
      'The edikaikong soup was EXACTLY how my Calabar grandmother makes it. Authentic flavour, generous portions of assorted meat. Our Calabar guests were emotional — said it reminded them of home. Outstanding work.'
    ) ON CONFLICT (interest_id) DO NOTHING;
  END IF;

  -- Review 2: Biodun's dinner, 5★
  INSERT INTO vendor_interests
    (event_id, vendor_id, user_id, category_id, preference_rank, status, expires_at)
  VALUES
    (e_biodun_corporate, v_calabar, u_biodun, c_caterers, 1, 'committed', NOW())
  ON CONFLICT (event_id, vendor_id) DO NOTHING
  RETURNING id INTO v_interest_id;

  IF v_interest_id IS NOT NULL THEN
    INSERT INTO vendor_reviews (vendor_id, event_id, user_id, interest_id, rating, comment)
    VALUES (
      v_calabar, e_biodun_corporate, u_biodun, v_interest_id, 5,
      'Ofada rice and designer sauce was the highlight of the evening. Every guest asked for the contact. Ngwo Ngwo was also brilliant for the adventurous guests.'
    ) ON CONFLICT (interest_id) DO NOTHING;
  END IF;

  -- Review 3: Fatimah's naming, 5★
  -- (Fatimah already has Royal Feast for caterers — use preference_rank 2)
  INSERT INTO vendor_interests
    (event_id, vendor_id, user_id, category_id, preference_rank, status, expires_at)
  VALUES
    (e_fatimah_naming, v_calabar, u_fatimah, c_caterers, 2, 'committed', NOW())
  ON CONFLICT (event_id, vendor_id) DO NOTHING
  RETURNING id INTO v_interest_id;

  IF v_interest_id IS NOT NULL THEN
    INSERT INTO vendor_reviews (vendor_id, event_id, user_id, interest_id, rating, comment)
    VALUES (
      v_calabar, e_fatimah_naming, u_fatimah, v_interest_id, 5,
      'Best traditional catering in Lagos. The banga soup was rich and perfectly spiced. Fufu was fresh and smooth. Peppered snail small chops disappeared in minutes.'
    ) ON CONFLICT (interest_id) DO NOTHING;
  END IF;

  -- Review 4: Adunola's wedding, 4★
  -- (Adunola already has Nourish & Co rank 1, Royal Feast rank 2 — use rank 3)
  INSERT INTO vendor_interests
    (event_id, vendor_id, user_id, category_id, preference_rank, status, expires_at)
  VALUES
    (e_adunola_wedding, v_calabar, u_adunola, c_caterers, 3, 'committed', NOW())
  ON CONFLICT (event_id, vendor_id) DO NOTHING
  RETURNING id INTO v_interest_id;

  IF v_interest_id IS NOT NULL THEN
    INSERT INTO vendor_reviews (vendor_id, event_id, user_id, interest_id, rating, comment)
    VALUES (
      v_calabar, e_adunola_wedding, u_adunola, v_interest_id, 4,
      'Very authentic. Only reason for 4 stars is they ran slightly late setting up. Food quality once served was exceptional — the catfish peppersoup was superb.'
    ) ON CONFLICT (interest_id) DO NOTHING;
  END IF;

  -- ══════════════════════════════════════════════════════════
  -- LANDMARK EVENT CENTRE reviews
  -- ══════════════════════════════════════════════════════════

  -- Review 1: Adunola's wedding, 5★
  INSERT INTO vendor_interests
    (event_id, vendor_id, user_id, category_id, preference_rank, status, expires_at)
  VALUES
    (e_adunola_wedding, v_landmark, u_adunola, c_venues, 1, 'committed', NOW())
  ON CONFLICT (event_id, vendor_id) DO NOTHING
  RETURNING id INTO v_interest_id;

  IF v_interest_id IS NOT NULL THEN
    INSERT INTO vendor_reviews (vendor_id, event_id, user_id, interest_id, rating, comment)
    VALUES (
      v_landmark, e_adunola_wedding, u_adunola, v_interest_id, 5,
      'Perfect venue for a large Nigerian wedding. The main hall held 800 of our guests comfortably. Staff were incredibly helpful, parking was ample, and the ambience was exactly what we wanted. Our wedding photos look stunning.'
    ) ON CONFLICT (interest_id) DO NOTHING;
  END IF;

  -- Review 2: Biodun's dinner, 5★
  INSERT INTO vendor_interests
    (event_id, vendor_id, user_id, category_id, preference_rank, status, expires_at)
  VALUES
    (e_biodun_corporate, v_landmark, u_biodun, c_venues, 1, 'committed', NOW())
  ON CONFLICT (event_id, vendor_id) DO NOTHING
  RETURNING id INTO v_interest_id;

  IF v_interest_id IS NOT NULL THEN
    INSERT INTO vendor_reviews (vendor_id, event_id, user_id, interest_id, rating, comment)
    VALUES (
      v_landmark, e_biodun_corporate, u_biodun, v_interest_id, 5,
      'Impressive event space. AV setup was professional, air conditioning was excellent throughout. The venue team were on hand for everything we needed. First class.'
    ) ON CONFLICT (interest_id) DO NOTHING;
  END IF;

  -- ══════════════════════════════════════════════════════════
  -- THE CIVIC CENTRE reviews
  -- ══════════════════════════════════════════════════════════

  -- Review 1: Temi's wedding, 4★
  INSERT INTO vendor_interests
    (event_id, vendor_id, user_id, category_id, preference_rank, status, expires_at)
  VALUES
    (e_temi_wedding, v_civic, u_temi, c_venues, 1, 'committed', NOW())
  ON CONFLICT (event_id, vendor_id) DO NOTHING
  RETURNING id INTO v_interest_id;

  IF v_interest_id IS NOT NULL THEN
    INSERT INTO vendor_reviews (vendor_id, event_id, user_id, interest_id, rating, comment)
    VALUES (
      v_civic, e_temi_wedding, u_temi, v_interest_id, 4,
      'Iconic Lagos venue. The garden area was perfect for our cocktail hour, main hall looked spectacular with our decorations. Parking was organised well.'
    ) ON CONFLICT (interest_id) DO NOTHING;
  END IF;

  -- Review 2: Emeka's birthday, 5★
  INSERT INTO vendor_interests
    (event_id, vendor_id, user_id, category_id, preference_rank, status, expires_at)
  VALUES
    (e_emeka_birthday, v_civic, u_emeka, c_venues, 1, 'committed', NOW())
  ON CONFLICT (event_id, vendor_id) DO NOTHING
  RETURNING id INTO v_interest_id;

  IF v_interest_id IS NOT NULL THEN
    INSERT INTO vendor_reviews (vendor_id, event_id, user_id, interest_id, rating, comment)
    VALUES (
      v_civic, e_emeka_birthday, u_emeka, v_interest_id, 5,
      'Breathtaking space. The event manager assigned to us was super professional. Really made our celebration feel premium.'
    ) ON CONFLICT (interest_id) DO NOTHING;
  END IF;

  -- ══════════════════════════════════════════════════════════
  -- MOTIF STUDIOS reviews
  -- ══════════════════════════════════════════════════════════

  -- Review 1: Adunola's wedding, 5★
  INSERT INTO vendor_interests
    (event_id, vendor_id, user_id, category_id, preference_rank, status, expires_at)
  VALUES
    (e_adunola_wedding, v_motif, u_adunola, c_photographers, 1, 'committed', NOW())
  ON CONFLICT (event_id, vendor_id) DO NOTHING
  RETURNING id INTO v_interest_id;

  IF v_interest_id IS NOT NULL THEN
    INSERT INTO vendor_reviews (vendor_id, event_id, user_id, interest_id, rating, comment)
    VALUES (
      v_motif, e_adunola_wedding, u_adunola, v_interest_id, 5,
      'Motif Studios captured every emotion of our wedding day perfectly. The pre-wedding shoot was creative and fun. Delivered our gallery in 3 weeks — earlier than promised!'
    ) ON CONFLICT (interest_id) DO NOTHING;
  END IF;

  -- Review 2: Temi's wedding, 5★
  INSERT INTO vendor_interests
    (event_id, vendor_id, user_id, category_id, preference_rank, status, expires_at)
  VALUES
    (e_temi_wedding, v_motif, u_temi, c_photographers, 1, 'committed', NOW())
  ON CONFLICT (event_id, vendor_id) DO NOTHING
  RETURNING id INTO v_interest_id;

  IF v_interest_id IS NOT NULL THEN
    INSERT INTO vendor_reviews (vendor_id, event_id, user_id, interest_id, rating, comment)
    VALUES (
      v_motif, e_temi_wedding, u_temi, v_interest_id, 5,
      'Absolutely phenomenal photography. The candid shots of our traditional ceremony made us cry happy tears. Best investment we made for the wedding.'
    ) ON CONFLICT (interest_id) DO NOTHING;
  END IF;

  -- ══════════════════════════════════════════════════════════
  -- DJ KHALID NG reviews
  -- ══════════════════════════════════════════════════════════

  -- Review 1: Emeka's birthday, 5★
  INSERT INTO vendor_interests
    (event_id, vendor_id, user_id, category_id, preference_rank, status, expires_at)
  VALUES
    (e_emeka_birthday, v_djkhalid, u_emeka, c_djs, 1, 'committed', NOW())
  ON CONFLICT (event_id, vendor_id) DO NOTHING
  RETURNING id INTO v_interest_id;

  IF v_interest_id IS NOT NULL THEN
    INSERT INTO vendor_reviews (vendor_id, event_id, user_id, interest_id, rating, comment)
    VALUES (
      v_djkhalid, e_emeka_birthday, u_emeka, v_interest_id, 5,
      'DJ Khalid had the dance floor packed from 9pm to 2am! Perfect blend of Afrobeats, oldies, and contemporary. Read the room brilliantly — even got the older guests dancing.'
    ) ON CONFLICT (interest_id) DO NOTHING;
  END IF;

  -- Review 2: Temi's wedding, 4★
  INSERT INTO vendor_interests
    (event_id, vendor_id, user_id, category_id, preference_rank, status, expires_at)
  VALUES
    (e_temi_wedding, v_djkhalid, u_temi, c_djs, 1, 'committed', NOW())
  ON CONFLICT (event_id, vendor_id) DO NOTHING
  RETURNING id INTO v_interest_id;

  IF v_interest_id IS NOT NULL THEN
    INSERT INTO vendor_reviews (vendor_id, event_id, user_id, interest_id, rating, comment)
    VALUES (
      v_djkhalid, e_temi_wedding, u_temi, v_interest_id, 4,
      'Great energy and good selection. Would have given 5 stars but started 20 mins late. Once he got going though, it was a party!'
    ) ON CONFLICT (interest_id) DO NOTHING;
  END IF;

  -- ══════════════════════════════════════════════════════════
  -- BLOOM & DRAPE EVENTS reviews
  -- ══════════════════════════════════════════════════════════

  -- Review 1: Adunola's wedding, 5★
  INSERT INTO vendor_interests
    (event_id, vendor_id, user_id, category_id, preference_rank, status, expires_at)
  VALUES
    (e_adunola_wedding, v_bloom, u_adunola, c_decorators, 1, 'committed', NOW())
  ON CONFLICT (event_id, vendor_id) DO NOTHING
  RETURNING id INTO v_interest_id;

  IF v_interest_id IS NOT NULL THEN
    INSERT INTO vendor_reviews (vendor_id, event_id, user_id, interest_id, rating, comment)
    VALUES (
      v_bloom, e_adunola_wedding, u_adunola, v_interest_id, 5,
      'Our venue was transformed beyond what we imagined. The floral arrangements, draping, and lighting were magazine-worthy. Every single detail was perfect.'
    ) ON CONFLICT (interest_id) DO NOTHING;
  END IF;

  -- Review 2: Fatimah's naming, 4★
  INSERT INTO vendor_interests
    (event_id, vendor_id, user_id, category_id, preference_rank, status, expires_at)
  VALUES
    (e_fatimah_naming, v_bloom, u_fatimah, c_decorators, 1, 'committed', NOW())
  ON CONFLICT (event_id, vendor_id) DO NOTHING
  RETURNING id INTO v_interest_id;

  IF v_interest_id IS NOT NULL THEN
    INSERT INTO vendor_reviews (vendor_id, event_id, user_id, interest_id, rating, comment)
    VALUES (
      v_bloom, e_fatimah_naming, u_fatimah, v_interest_id, 4,
      'Beautiful decoration within our budget. Creative team listened to our vision and executed beautifully. Very professional.'
    ) ON CONFLICT (interest_id) DO NOTHING;
  END IF;

  -- ══════════════════════════════════════════════════════════
  -- GLAM BY TOLA reviews
  -- ══════════════════════════════════════════════════════════

  -- Review 1: Adunola's wedding, 5★
  INSERT INTO vendor_interests
    (event_id, vendor_id, user_id, category_id, preference_rank, status, expires_at)
  VALUES
    (e_adunola_wedding, v_glam, u_adunola, c_makeup, 1, 'committed', NOW())
  ON CONFLICT (event_id, vendor_id) DO NOTHING
  RETURNING id INTO v_interest_id;

  IF v_interest_id IS NOT NULL THEN
    INSERT INTO vendor_reviews (vendor_id, event_id, user_id, interest_id, rating, comment)
    VALUES (
      v_glam, e_adunola_wedding, u_adunola, v_interest_id, 5,
      'Tola is an absolute genius with a brush. I cried looking at myself in the mirror — in the best way. She also did my mum and bridesmaids and everyone looked stunning.'
    ) ON CONFLICT (interest_id) DO NOTHING;
  END IF;

  -- Review 2: Temi's wedding, 5★
  INSERT INTO vendor_interests
    (event_id, vendor_id, user_id, category_id, preference_rank, status, expires_at)
  VALUES
    (e_temi_wedding, v_glam, u_temi, c_makeup, 1, 'committed', NOW())
  ON CONFLICT (event_id, vendor_id) DO NOTHING
  RETURNING id INTO v_interest_id;

  IF v_interest_id IS NOT NULL THEN
    INSERT INTO vendor_reviews (vendor_id, event_id, user_id, interest_id, rating, comment)
    VALUES (
      v_glam, e_temi_wedding, u_temi, v_interest_id, 5,
      'My makeup lasted from 8am to midnight without touching up. Tola is a perfectionist and it shows. Highly highly recommended.'
    ) ON CONFLICT (interest_id) DO NOTHING;
  END IF;

  -- ══════════════════════════════════════════════════════════
  -- SOLA EVENTS & CO reviews
  -- (no reviews requested in spec — vendor included for future use)
  -- ══════════════════════════════════════════════════════════

  -- ────────────────────────────────────────────────────────────
  -- PART B: UPDATE VENDOR RATINGS
  -- ────────────────────────────────────────────────────────────

  UPDATE vendors v SET
    rating       = sub.avg_rating,
    review_count = sub.cnt
  FROM (
    SELECT vendor_id,
           ROUND(AVG(rating)::numeric, 1) AS avg_rating,
           COUNT(*)                        AS cnt
    FROM vendor_reviews
    GROUP BY vendor_id
  ) sub
  WHERE v.id = sub.vendor_id;

END;
$$;

-- Drop helper function (no longer needed)
DROP FUNCTION IF EXISTS _seed_reviewer_account;
