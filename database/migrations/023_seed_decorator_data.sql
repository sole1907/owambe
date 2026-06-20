-- ============================================================
-- 023: Seed decorator styles and packages
-- ============================================================
-- Seeds style tags + Basic/Standard/Premium packages (each with
-- three guest-count pricing tiers) for every active decorator
-- vendor. Vendor IDs are looked up by slug, never hardcoded.
-- Idempotent: skips a decorator if it already has styles.
-- Run this AFTER migration 022.
-- ============================================================

DO $$
DECLARE
  c_decorators  UUID;
  v_id          UUID;
  v_pkg_id      UUID;
  v_idx         INT := 0;
  -- Style pool to rotate through per decorator
  style_pool    TEXT[] := ARRAY[
    'Afro-Luxe', 'Garden Floral', 'Minimalist Modern', 'Traditional Nigerian',
    'Fairy Light Canopy', 'Grand Ballroom', 'Rustic Chic', 'Tropical Glam'
  ];
  s             TEXT;
  decorator_rec RECORD;
BEGIN
  SELECT id INTO c_decorators FROM vendor_categories WHERE slug = 'decorators';
  IF c_decorators IS NULL THEN
    RAISE NOTICE 'No decorators category found — skipping seed.';
    RETURN;
  END IF;

  FOR decorator_rec IN
    SELECT id, name FROM vendors
    WHERE category_id = c_decorators AND is_active = true
    ORDER BY name
  LOOP
    v_id := decorator_rec.id;

    -- Idempotency: skip decorators that already have styles seeded
    IF EXISTS (SELECT 1 FROM decorator_styles WHERE vendor_id = v_id) THEN
      CONTINUE;
    END IF;

    -- ── STYLES: pick 4 styles, rotating through the pool so each
    --    decorator gets a slightly different aesthetic mix ───────
    FOR i IN 0..3 LOOP
      s := style_pool[((v_idx + i) % array_length(style_pool, 1)) + 1];
      INSERT INTO decorator_styles (vendor_id, style, sort_order)
      VALUES (v_id, s, i * 10);
    END LOOP;
    v_idx := v_idx + 2;  -- shift the window for the next decorator

    -- ── PACKAGES: Basic / Standard / Premium ──────────────────
    -- Each with three guest tiers (1–150, 151–300, 301+).
    -- Prices scale with package tier and guest band.

    -- Basic
    INSERT INTO decorator_packages (vendor_id, name, description, includes, sort_order)
    VALUES (
      v_id, 'Basic',
      'Essential décor to set the scene — clean, elegant, and budget-friendly.',
      ARRAY[
        'Stage backdrop & couple/celebrant seating',
        'Head table styling',
        'Up to 10 guest table centrepieces',
        'Basic draping & entrance arch'
      ],
      10
    ) RETURNING id INTO v_pkg_id;
    INSERT INTO decorator_package_guest_tiers (package_id, min_guests, max_guests, price) VALUES
      (v_pkg_id,   1, 150, 350000),
      (v_pkg_id, 151, 300, 500000),
      (v_pkg_id, 301, NULL, 700000);

    -- Standard
    INSERT INTO decorator_packages (vendor_id, name, description, includes, sort_order)
    VALUES (
      v_id, 'Standard',
      'A fuller transformation with premium florals, lighting, and lounge styling.',
      ARRAY[
        'Custom stage & backdrop design',
        'Premium floral centrepieces (all guest tables)',
        'Ambient uplighting & fairy lights',
        'Draped ceiling treatment',
        'Lounge / cocktail area styling',
        'Walkway & entrance feature'
      ],
      20
    ) RETURNING id INTO v_pkg_id;
    INSERT INTO decorator_package_guest_tiers (package_id, min_guests, max_guests, price) VALUES
      (v_pkg_id,   1, 150, 750000),
      (v_pkg_id, 151, 300, 1100000),
      (v_pkg_id, 301, NULL, 1500000);

    -- Premium
    INSERT INTO decorator_packages (vendor_id, name, description, includes, sort_order)
    VALUES (
      v_id, 'Premium',
      'Full magazine-worthy build-out with bespoke installations and luxury finishes.',
      ARRAY[
        'Bespoke themed concept & 3D design preview',
        'Luxury floral installations & hanging gardens',
        'Full ceiling draping with chandeliers',
        'Programmable stage & dance-floor lighting',
        'Multiple lounge zones & photo moment',
        'Custom furniture & charger plate settings',
        'On-site décor team for the full event day'
      ],
      30
    ) RETURNING id INTO v_pkg_id;
    INSERT INTO decorator_package_guest_tiers (package_id, min_guests, max_guests, price) VALUES
      (v_pkg_id,   1, 150, 1400000),
      (v_pkg_id, 151, 300, 1900000),
      (v_pkg_id, 301, NULL, 2500000);

  END LOOP;
END $$;
