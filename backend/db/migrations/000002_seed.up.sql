INSERT INTO users (id, email, name, role)
VALUES ('00000000-0000-0000-0000-000000000001', 'owner@prospect.local', 'Owner', 'owner')
ON CONFLICT (email) DO NOTHING;

INSERT INTO sources (slug, name, kind) VALUES
  ('csv',    'Importação CSV',   'file'),
  ('manual', 'Cadastro manual',  'manual'),
  ('google_places', 'Google Places', 'api')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO segments (slug, name, color, icon, sort_order) VALUES
  ('barbearia',            'Barbearia',            'amber',   'Scissors',   1),
  ('dentista',             'Dentista',             'sky',     'Stethoscope',2),
  ('clinica-odontologica', 'Clínica odontológica', 'cyan',    'Building2',  3),
  ('personal-trainer',     'Personal trainer',     'lime',    'Dumbbell',   4),
  ('medico',               'Médico',               'violet',  'HeartPulse', 5),
  ('clinica-medica',       'Clínica médica',       'rose',    'Hospital',   6)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO message_templates (id, name, segment_id, description, created_by)
SELECT '00000000-0000-0000-0000-000000000010',
       'Barbearia 01',
       (SELECT id FROM segments WHERE slug = 'barbearia'),
       'Primeira abordagem para barbearias sem site',
       '00000000-0000-0000-0000-000000000001'
WHERE NOT EXISTS (SELECT 1 FROM message_templates WHERE id = '00000000-0000-0000-0000-000000000010');

INSERT INTO message_template_versions (id, template_id, version, body, variables, created_by)
SELECT '00000000-0000-0000-0000-000000000011',
       '00000000-0000-0000-0000-000000000010',
       1,
       E'Oi, {{nome_empresa}}! Tudo bem?\n\nVi que vocês estão em {{cidade}} e que ainda não têm um site próprio.\n\nEu crio sites rápidos e bonitos para {{segmento}} — com agendamento, fotos do espaço e link direto pro WhatsApp.\n\nPosso te mandar um exemplo?',
       ARRAY['nome_empresa','cidade','segmento'],
       '00000000-0000-0000-0000-000000000001'
WHERE NOT EXISTS (SELECT 1 FROM message_template_versions WHERE id = '00000000-0000-0000-0000-000000000011');

UPDATE message_templates
   SET current_version_id = '00000000-0000-0000-0000-000000000011'
 WHERE id = '00000000-0000-0000-0000-000000000010'
   AND current_version_id IS NULL;
