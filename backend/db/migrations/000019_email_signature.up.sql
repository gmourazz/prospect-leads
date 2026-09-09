-- The signature belongs to the sender, not to any one template: it is the
-- same in every message and changing a phone number should not mean editing
-- four templates and hoping none was missed. It lives here as a single row
-- and gets appended to every outgoing email at send time.
CREATE TABLE IF NOT EXISTS app_settings (
  id              int PRIMARY KEY DEFAULT 1,
  email_signature text NOT NULL DEFAULT '',
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_singleton CHECK (id = 1)
);

INSERT INTO app_settings (id, email_signature)
VALUES (1, E'--\nGeovanna Moura\nDesenvolvedora Web\n\nPortfólio: https://geovannamoura.com.br\nWhatsApp: https://wa.me/5534999865512\ngeovannamouradeveloper@gmail.com')
ON CONFLICT (id) DO NOTHING;

-- With the signature carrying the portfolio, the WhatsApp and the sign-off,
-- the template bodies no longer repeat any of it: they end at the actual
-- pitch. New versions again, never rewriting what was already sent.
WITH new_version AS (
  INSERT INTO message_template_versions (template_id, version, subject, body, variables, created_by)
  SELECT t.id,
         (SELECT COALESCE(MAX(v.version), 0) + 1
            FROM message_template_versions v WHERE v.template_id = t.id),
         'Site para {{nome_empresa}}',
         E'Oi, {{nome_curto}}! Tudo bem?\n\n' ||
         E'Me chamo Geovanna, sou desenvolvedora e faço sites para negócios locais aqui de {{cidade}}.\n\n' ||
         E'Reparei que a barbearia ainda não tem site próprio, e quem procura no Google acaba não achando vocês direito. Anexei um exemplo de modelo pra você ver o estilo (é uma referência genérica, não foi feita para a barbearia).\n\n' ||
         E'Se curtir a ideia, eu monto uma versão com a cara da sua barbearia, sem compromisso nenhum.',
         ARRAY['cidade', 'nome_curto', 'nome_empresa']::text[],
         (SELECT v.created_by FROM message_template_versions v WHERE v.id = t.current_version_id)
    FROM message_templates t
   WHERE t.id = '00000000-0000-0000-0000-000000000010'
  RETURNING id, template_id
)
UPDATE message_templates t SET current_version_id = nv.id, updated_at = now()
  FROM new_version nv WHERE t.id = nv.template_id;

WITH new_version AS (
  INSERT INTO message_template_versions (template_id, version, subject, body, variables, created_by)
  SELECT t.id,
         (SELECT COALESCE(MAX(v.version), 0) + 1
            FROM message_template_versions v WHERE v.template_id = t.id),
         'Site para {{nome_empresa}}',
         E'Olá, tudo bem?\n\n' ||
         E'Me chamo Geovanna, sou desenvolvedora e crio sites para escritórios e profissionais liberais em {{cidade}}.\n\n' ||
         E'Percebi que o escritório ainda não tem um site próprio. Anexei um exemplo de modelo apenas como referência (é um material genérico, não foi feito para o escritório).\n\n' ||
         E'Se fizer sentido, posso preparar uma versão com a identidade visual de vocês, sem compromisso.',
         ARRAY['cidade', 'nome_empresa']::text[],
         (SELECT v.created_by FROM message_template_versions v WHERE v.id = t.current_version_id)
    FROM message_templates t
   WHERE t.id = '00000000-0000-0000-0000-000000000020'
  RETURNING id, template_id
)
UPDATE message_templates t SET current_version_id = nv.id, updated_at = now()
  FROM new_version nv WHERE t.id = nv.template_id;

WITH new_version AS (
  INSERT INTO message_template_versions (template_id, version, subject, body, variables, created_by)
  SELECT t.id,
         (SELECT COALESCE(MAX(v.version), 0) + 1
            FROM message_template_versions v WHERE v.template_id = t.id),
         'Site para {{nome_empresa}}',
         E'Olá, tudo bem?\n\n' ||
         E'Me chamo Geovanna, sou desenvolvedora e faço sites para clínicas e consultórios em {{cidade}}.\n\n' ||
         E'Vi que a clínica ainda não tem site próprio. Hoje muita gente pesquisa no Google antes de marcar consulta, e um site simples com os serviços, o endereço e um botão de agendamento já resolve bem isso.\n\n' ||
         E'Anexei um exemplo de modelo só como referência (não foi feito para a clínica). Se gostar, eu faço uma versão personalizada, sem compromisso.',
         ARRAY['cidade', 'nome_empresa']::text[],
         (SELECT v.created_by FROM message_template_versions v WHERE v.id = t.current_version_id)
    FROM message_templates t
   WHERE t.id = '00000000-0000-0000-0000-000000000030'
  RETURNING id, template_id
)
UPDATE message_templates t SET current_version_id = nv.id, updated_at = now()
  FROM new_version nv WHERE t.id = nv.template_id;

WITH new_version AS (
  INSERT INTO message_template_versions (template_id, version, subject, body, variables, created_by)
  SELECT t.id,
         (SELECT COALESCE(MAX(v.version), 0) + 1
            FROM message_template_versions v WHERE v.template_id = t.id),
         'Site para {{nome_curto}}',
         E'Oi, {{nome_curto}}! Tudo bem?\n\n' ||
         E'Me chamo Geovanna, sou desenvolvedora e faço sites para profissionais de {{cidade}}.\n\n' ||
         E'Vi que você ainda não tem um site próprio para divulgar os treinos e planos. Anexei um exemplo de modelo para você ver o estilo (é uma referência genérica, não foi feita para você).\n\n' ||
         E'Se curtir, eu monto uma versão com a sua identidade, sem compromisso.',
         ARRAY['cidade', 'nome_curto']::text[],
         (SELECT v.created_by FROM message_template_versions v WHERE v.id = t.current_version_id)
    FROM message_templates t
   WHERE t.id = '00000000-0000-0000-0000-000000000040'
  RETURNING id, template_id
)
UPDATE message_templates t SET current_version_id = nv.id, updated_at = now()
  FROM new_version nv WHERE t.id = nv.template_id;
