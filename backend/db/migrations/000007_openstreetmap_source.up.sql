INSERT INTO sources (slug, name, kind) VALUES
  ('openstreetmap', 'OpenStreetMap (Overpass API)', 'api')
ON CONFLICT (slug) DO NOTHING;
