-- Segmento adicional pedido pela usuária, e um template pronto para cada
-- segmento inicial (advocacia, barbearia, dentista, personal trainer).
INSERT INTO segments (slug, name, color, icon, sort_order) VALUES
  ('advocacia', 'Advocacia', 'violet', 'Scale', 0)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO message_templates (id, name, segment_id, description, created_by)
SELECT '00000000-0000-0000-0000-000000000020',
       'Advocacia 01',
       (SELECT id FROM segments WHERE slug = 'advocacia'),
       'Primeira abordagem para escritórios de advocacia sem site',
       '00000000-0000-0000-0000-000000000001'
WHERE NOT EXISTS (SELECT 1 FROM message_templates WHERE id = '00000000-0000-0000-0000-000000000020');

INSERT INTO message_template_versions (id, template_id, version, body, variables, created_by)
SELECT '00000000-0000-0000-0000-000000000021',
       '00000000-0000-0000-0000-000000000020',
       1,
       E'Oi, {{nome_empresa}}! Tudo bem?\n\nVi que o escritório atua em {{cidade}} e ainda não tem um site próprio.\n\nEu crio sites institucionais para {{segmento}} — com áreas de atuação, formulário de contato e link direto pro WhatsApp, transmitindo mais credibilidade para novos clientes.\n\nPosso te mandar um exemplo?',
       ARRAY['nome_empresa','cidade','segmento'],
       '00000000-0000-0000-0000-000000000001'
WHERE NOT EXISTS (SELECT 1 FROM message_template_versions WHERE id = '00000000-0000-0000-0000-000000000021');

UPDATE message_templates SET current_version_id = '00000000-0000-0000-0000-000000000021'
 WHERE id = '00000000-0000-0000-0000-000000000020' AND current_version_id IS NULL;

INSERT INTO message_templates (id, name, segment_id, description, created_by)
SELECT '00000000-0000-0000-0000-000000000030',
       'Dentista 01',
       (SELECT id FROM segments WHERE slug = 'dentista'),
       'Primeira abordagem para dentistas sem site',
       '00000000-0000-0000-0000-000000000001'
WHERE NOT EXISTS (SELECT 1 FROM message_templates WHERE id = '00000000-0000-0000-0000-000000000030');

INSERT INTO message_template_versions (id, template_id, version, body, variables, created_by)
SELECT '00000000-0000-0000-0000-000000000031',
       '00000000-0000-0000-0000-000000000030',
       1,
       E'Oi, {{nome_empresa}}! Tudo bem?\n\nVi que o consultório fica em {{cidade}} e ainda não tem um site próprio.\n\nEu crio sites para {{segmento}} — com tratamentos, fotos do consultório e agendamento direto pelo WhatsApp.\n\nPosso te mandar um exemplo?',
       ARRAY['nome_empresa','cidade','segmento'],
       '00000000-0000-0000-0000-000000000001'
WHERE NOT EXISTS (SELECT 1 FROM message_template_versions WHERE id = '00000000-0000-0000-0000-000000000031');

UPDATE message_templates SET current_version_id = '00000000-0000-0000-0000-000000000031'
 WHERE id = '00000000-0000-0000-0000-000000000030' AND current_version_id IS NULL;

INSERT INTO message_templates (id, name, segment_id, description, created_by)
SELECT '00000000-0000-0000-0000-000000000040',
       'Personal Trainer 01',
       (SELECT id FROM segments WHERE slug = 'personal-trainer'),
       'Primeira abordagem para personal trainers sem site',
       '00000000-0000-0000-0000-000000000001'
WHERE NOT EXISTS (SELECT 1 FROM message_templates WHERE id = '00000000-0000-0000-0000-000000000040');

INSERT INTO message_template_versions (id, template_id, version, body, variables, created_by)
SELECT '00000000-0000-0000-0000-000000000041',
       '00000000-0000-0000-0000-000000000040',
       1,
       E'Oi, {{nome_curto}}! Tudo bem?\n\nVi seu trabalho como personal em {{cidade}} e que você ainda não tem um site próprio.\n\nEu crio páginas para {{segmento}} — com seus planos, depoimentos e botão direto pro WhatsApp, pra facilitar a captação de novos alunos.\n\nPosso te mandar um exemplo?',
       ARRAY['nome_curto','cidade','segmento'],
       '00000000-0000-0000-0000-000000000001'
WHERE NOT EXISTS (SELECT 1 FROM message_template_versions WHERE id = '00000000-0000-0000-0000-000000000041');

UPDATE message_templates SET current_version_id = '00000000-0000-0000-0000-000000000041'
 WHERE id = '00000000-0000-0000-0000-000000000040' AND current_version_id IS NULL;
