-- Seed vendor data
-- Category IDs are referenced by slug for portability

WITH cats AS (
  SELECT id, slug FROM vendor_categories
)
INSERT INTO vendors (category_id, name, slug, description, location, city, price_min, price_max, phone, whatsapp, instagram, rating, review_count, is_featured)
VALUES

-- Venues
((SELECT id FROM cats WHERE slug = 'venues'),
 'Landmark Event Centre', 'landmark-event-centre',
 'One of Lagos'' most prestigious event venues, located on the waterfront in Victoria Island. Capacity up to 2,000 guests.',
 'Victoria Island', 'Lagos', 500000, 2000000, '+2341-700-000-001', '+2341-700-000-001', '@landmarkevents', 4.8, 124, TRUE),

((SELECT id FROM cats WHERE slug = 'venues'),
 'Transcorp Hilton Ballroom', 'transcorp-hilton-ballroom',
 'Abuja''s premier luxury event space inside the iconic Transcorp Hilton Hotel. Ideal for weddings and corporate events.',
 'Maitama', 'Abuja', 800000, 3000000, '+2341-700-000-002', '+2341-700-000-002', '@transcorphilton', 4.9, 87, TRUE),

((SELECT id FROM cats WHERE slug = 'venues'),
 'Oceanview Gardens', 'oceanview-gardens',
 'A stunning outdoor garden venue overlooking the water, perfect for intimate weddings and ceremonies in Port Harcourt.',
 'GRA Phase 2', 'Port Harcourt', 200000, 800000, '+2341-700-000-003', '+2341-700-000-003', '@oceanviewph', 4.5, 62, FALSE),

((SELECT id FROM cats WHERE slug = 'venues'),
 'The Civic Centre', 'the-civic-centre',
 'A classic Lagos event venue on the Lagos Harbour, known for large-scale weddings and galas.',
 'Victoria Island', 'Lagos', 600000, 2500000, '+2341-700-000-004', '+2341-700-000-004', '@civiccentrelagos', 4.7, 95, TRUE),

-- Caterers
((SELECT id FROM cats WHERE slug = 'caterers'),
 'Nourish & Co', 'nourish-and-co',
 'Specialising in contemporary Nigerian cuisine and continental dishes. Known for presentation and quality at large events.',
 'Lekki', 'Lagos', 150000, 600000, '+2341-700-000-005', '+2341-700-000-005', '@nourishandco', 4.7, 143, TRUE),

((SELECT id FROM cats WHERE slug = 'caterers'),
 'Royal Feast Catering', 'royal-feast-catering',
 'Abuja''s top catering service for weddings and corporate events. Specialises in buffet and sit-down dining experiences.',
 'Wuse 2', 'Abuja', 200000, 700000, '+2341-700-000-006', '+2341-700-000-006', '@royalfeastabuja', 4.6, 98, FALSE),

((SELECT id FROM cats WHERE slug = 'caterers'),
 'Pepper Soup Kitchen', 'pepper-soup-kitchen',
 'Authentic Nigerian street food elevated for events. Famous for their jollof rice, suya stations, and live cooking experiences.',
 'Surulere', 'Lagos', 80000, 300000, '+2341-700-000-007', '+2341-700-000-007', '@peppersoupkitchen', 4.4, 77, FALSE),

((SELECT id FROM cats WHERE slug = 'caterers'),
 'Calabar Delicacies', 'calabar-delicacies',
 'Specialises in Cross River cuisine and South-South Nigerian dishes. Popular for naming ceremonies and traditional events.',
 'Trans Amadi', 'Port Harcourt', 100000, 400000, '+2341-700-000-008', '+2341-700-000-008', '@calabardelicacies', 4.5, 54, FALSE),

-- Photographers
((SELECT id FROM cats WHERE slug = 'photographers'),
 'Motif Studios', 'motif-studios',
 'Award-winning wedding and event photography studio based in Lagos. Known for cinematic storytelling and editorial-style imagery.',
 'Ikeja', 'Lagos', 200000, 800000, '+2341-700-000-009', '+2341-700-000-009', '@motifstudios', 4.9, 201, TRUE),

((SELECT id FROM cats WHERE slug = 'photographers'),
 'Clicks by Dami', 'clicks-by-dami',
 'Vibrant, colourful event photography capturing the energy of Nigerian celebrations. Available across Lagos and Abuja.',
 'Lekki Phase 1', 'Lagos', 120000, 450000, '+2341-700-000-010', '+2341-700-000-010', '@clicksbydami', 4.6, 112, FALSE),

((SELECT id FROM cats WHERE slug = 'photographers'),
 'Capital Lens', 'capital-lens',
 'Abuja''s leading event photography studio. Specialises in weddings, corporate events, and political functions.',
 'Garki', 'Abuja', 150000, 500000, '+2341-700-000-011', '+2341-700-000-011', '@capitallens', 4.7, 88, FALSE),

-- Videographers
((SELECT id FROM cats WHERE slug = 'videographers'),
 'FilmHouse Productions', 'filmhouse-productions',
 'Cinematic wedding films and event documentaries. Known for emotional storytelling and high-production-value edits.',
 'Victoria Island', 'Lagos', 250000, 900000, '+2341-700-000-012', '+2341-700-000-012', '@filmhouseproductions', 4.8, 134, TRUE),

((SELECT id FROM cats WHERE slug = 'videographers'),
 'Reel Moments', 'reel-moments',
 'Affordable event videography with same-day highlight reels. Serves Lagos, Abuja and Port Harcourt.',
 'Yaba', 'Lagos', 100000, 400000, '+2341-700-000-013', '+2341-700-000-013', '@reelmoments', 4.4, 67, FALSE),

-- DJs
((SELECT id FROM cats WHERE slug = 'djs'),
 'DJ Khalid NG', 'dj-khalid-ng',
 'High-energy DJ known for Afrobeats, Amapiano, and cross-genre sets. A staple at Lagos owambe events.',
 'Ajah', 'Lagos', 150000, 500000, '+2341-700-000-014', '+2341-700-000-014', '@djkhalidng', 4.8, 189, TRUE),

((SELECT id FROM cats WHERE slug = 'djs'),
 'DJ Xcellence', 'dj-xcellence',
 'Abuja''s go-to DJ for weddings and corporate events. Known for reading the crowd and seamless transitions.',
 'Asokoro', 'Abuja', 120000, 400000, '+2341-700-000-015', '+2341-700-000-015', '@djxcellence', 4.6, 103, FALSE),

-- Live Bands
((SELECT id FROM cats WHERE slug = 'live-bands'),
 'The Afro Vibe Band', 'the-afro-vibe-band',
 'A 10-piece live band performing Afrobeats, Highlife, and Afro-juju. Perfect for owambe receptions.',
 'Ikeja', 'Lagos', 350000, 1200000, '+2341-700-000-016', '+2341-700-000-016', '@afrovibeband', 4.9, 76, TRUE),

((SELECT id FROM cats WHERE slug = 'live-bands'),
 'Highlife Kings', 'highlife-kings',
 'Traditional Highlife and Afro-juju band. Brings a classic Nigerian feel to weddings and celebrations.',
 'Enugu', 'Enugu', 200000, 700000, '+2341-700-000-017', '+2341-700-000-017', '@highlifekings', 4.5, 48, FALSE),

-- MCs
((SELECT id FROM cats WHERE slug = 'mcs'),
 'MC Tee', 'mc-tee',
 'Lagos'' most booked MC. Known for sharp wit, crowd control, and seamless bilingual (Yoruba/English) hosting.',
 'Surulere', 'Lagos', 100000, 350000, '+2341-700-000-018', '+2341-700-000-018', '@mcteelagos', 4.9, 231, TRUE),

((SELECT id FROM cats WHERE slug = 'mcs'),
 'MC Prestige', 'mc-prestige',
 'Corporate and wedding MC based in Abuja. Professional, polished and experienced with high-profile events.',
 'Maitama', 'Abuja', 80000, 250000, '+2341-700-000-019', '+2341-700-000-019', '@mcprestigeabuja', 4.7, 92, FALSE),

-- Decorators
((SELECT id FROM cats WHERE slug = 'decorators'),
 'Bloom & Drape Events', 'bloom-and-drape-events',
 'Luxury floral and draping specialists. Known for transforming venues into breathtaking, magazine-worthy spaces.',
 'Lekki', 'Lagos', 400000, 2000000, '+2341-700-000-020', '+2341-700-000-020', '@bloomanddrape', 4.9, 167, TRUE),

((SELECT id FROM cats WHERE slug = 'decorators'),
 'Elegance Décor', 'elegance-decor',
 'Abuja-based décor company specialising in traditional and contemporary Nigerian wedding setups.',
 'Wuse', 'Abuja', 200000, 900000, '+2341-700-000-021', '+2341-700-000-021', '@elegancedecor', 4.6, 81, FALSE),

-- Makeup Artists
((SELECT id FROM cats WHERE slug = 'makeup-artists'),
 'Glam by Tola', 'glam-by-tola',
 'Bridal and event makeup specialist with a signature flawless, long-lasting finish. Serves Lagos and travels nationwide.',
 'Victoria Island', 'Lagos', 80000, 350000, '+2341-700-000-022', '+2341-700-000-022', '@glambytola', 4.8, 156, TRUE),

((SELECT id FROM cats WHERE slug = 'makeup-artists'),
 'Beauty by Kemi', 'beauty-by-kemi',
 'Affordable bridal makeup and group packages for bridal parties. Based in Abuja.',
 'Kubwa', 'Abuja', 40000, 150000, '+2341-700-000-023', '+2341-700-000-023', '@beautybykemi', 4.5, 89, FALSE),

-- Event Coordinators
((SELECT id FROM cats WHERE slug = 'event-coordinators'),
 'Sola Events & Co', 'sola-events-and-co',
 'Full-service event planning and day-of coordination. Has managed over 300 events across Nigeria.',
 'Ikoyi', 'Lagos', 300000, 1200000, '+2341-700-000-024', '+2341-700-000-024', '@solaeventsco', 4.9, 118, TRUE),

((SELECT id FROM cats WHERE slug = 'event-coordinators'),
 'Abuja Event Planners', 'abuja-event-planners',
 'Abuja''s trusted event coordination team for weddings, corporate events, and private parties.',
 'Gwarinpa', 'Abuja', 200000, 800000, '+2341-700-000-025', '+2341-700-000-025', '@abujaeventplanners', 4.6, 74, FALSE);
