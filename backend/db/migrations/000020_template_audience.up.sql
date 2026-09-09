-- Two different pitches, two different audiences: a business with no site
-- gets "você não tem site, eu faço", one that already has a site gets "posso
-- melhorar o que você já tem". Sending the wrong one is embarrassing, so the
-- template records who it is for and the campaign screen can say it out loud.
ALTER TABLE message_templates
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'any';

-- The four originals were all written for businesses without a site.
UPDATE message_templates
   SET audience = 'no_website'
 WHERE id IN (
   '00000000-0000-0000-0000-000000000010',
   '00000000-0000-0000-0000-000000000020',
   '00000000-0000-0000-0000-000000000030',
   '00000000-0000-0000-0000-000000000040'
 );

-- The improvement pitch, in two tones: relaxed for local trades, formal for
-- offices and clinics. Neither promises anything specific about their site,
-- because we have not looked at it yet — it offers a look, not a verdict.
INSERT INTO message_templates (id, name, description, segment_id, audience, created_by)
VALUES
  ('00000000-0000-0000-0000-000000000050',
   'Melhoria de site (informal)',
   'Para quem já tem site: oferta de melhoria, tom próximo',
   NULL, 'has_website',
   (SELECT created_by FROM message_templates WHERE id = '00000000-0000-0000-0000-000000000010')),
  ('00000000-0000-0000-0000-000000000060',
   'Melhoria de site (formal)',
   'Para quem já tem site: oferta de melhoria, tom formal',
   NULL, 'has_website',
   (SELECT created_by FROM message_templates WHERE id = '00000000-0000-0000-0000-000000000020'))
ON CONFLICT (id) DO NOTHING;

WITH v AS (
  INSERT INTO message_template_versions (template_id, version, subject, body, variables, created_by)
  VALUES (
    '00000000-0000-0000-0000-000000000050', 1,
    'Uma ideia para o site de {{nome_empresa}}',
    E'Oi, {{nome_curto}}! Tudo bem?\n\n' ||
    E'Me chamo Geovanna, sou desenvolvedora e trabalho com sites de negócios aqui de {{cidade}}.\n\n' ||
    E'Vi que vocês já têm site, então não vim oferecer um do zero. O que costumo fazer nesses casos é dar uma olhada no que já existe e sugerir melhorias pontuais: deixar mais rápido no celular, facilitar o contato pelo WhatsApp e melhorar o que aparece no Google.\n\n' ||
    E'Se quiser, eu olho o site de vocês e te mando algumas sugestões, sem compromisso. Dá uma olhada no meu trabalho e me diz se faz sentido.',
    ARRAY['cidade', 'nome_curto', 'nome_empresa']::text[],
    (SELECT created_by FROM message_templates WHERE id = '00000000-0000-0000-0000-000000000050')
  )
  RETURNING id, template_id
)
UPDATE message_templates t SET current_version_id = v.id FROM v WHERE t.id = v.template_id;

WITH v AS (
  INSERT INTO message_template_versions (template_id, version, subject, body, variables, created_by)
  VALUES (
    '00000000-0000-0000-0000-000000000060', 1,
    'Uma ideia para o site de {{nome_empresa}}',
    E'Olá, tudo bem?\n\n' ||
    E'Me chamo Geovanna, sou desenvolvedora e trabalho com sites de empresas e profissionais em {{cidade}}.\n\n' ||
    E'Vi que vocês já têm um site, então não escrevo para oferecer um novo. Nesses casos costumo revisar o que já existe e apontar melhorias objetivas: desempenho no celular, clareza das informações de contato e presença nas buscas do Google.\n\n' ||
    E'Se houver interesse, posso analisar o site de vocês e enviar as sugestões, sem compromisso. Abaixo deixo meu portfólio para conhecer o trabalho.',
    ARRAY['cidade', 'nome_empresa']::text[],
    (SELECT created_by FROM message_templates WHERE id = '00000000-0000-0000-0000-000000000060')
  )
  RETURNING id, template_id
)
UPDATE message_templates t SET current_version_id = v.id FROM v WHERE t.id = v.template_id;
