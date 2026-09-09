-- Two changes, both from live copy feedback:
--
-- 1. Every template claimed Geovanna works "em {{cidade}}" / "aqui de
--    {{cidade}}" — a false locality claim for a lead in a city she's never
--    been to. Dropped from all six; {{cidade}} no longer appears in any
--    body, so it's dropped from each version's variable list too.
--
-- 2. "Melhoria de site (informal)" opened with a flat self-introduction
--    that didn't hook the reader. Rewritten to lead with the pain (a slow
--    or hard-to-contact site quietly costs the business customers) before
--    introducing the sender, with a subject line that creates curiosity
--    instead of reading as institutional.
--
-- New versions only, per the standing rule: nothing already sent is
-- rewritten.

WITH v AS (
  INSERT INTO message_template_versions (template_id, version, subject, body, variables, created_by)
  SELECT t.id,
         (SELECT COALESCE(MAX(version), 0) + 1 FROM message_template_versions WHERE template_id = t.id),
         'Site para {{nome_empresa}}',
         E'Olá, tudo bem?\n\n' ||
         E'Me chamo Geovanna, sou desenvolvedora e crio sites para escritórios e profissionais liberais.\n\n' ||
         E'Percebi que o escritório ainda não tem um site próprio. Anexei um exemplo de modelo apenas como referência (é um material genérico, não foi feito para o escritório).\n\n' ||
         E'Se fizer sentido, posso preparar uma versão com a identidade visual de vocês, sem compromisso.',
         ARRAY['nome_empresa']::text[],
         (SELECT created_by FROM message_template_versions WHERE id = t.current_version_id)
    FROM message_templates t WHERE t.id = '00000000-0000-0000-0000-000000000020'
  RETURNING id, template_id
)
UPDATE message_templates t SET current_version_id = v.id, updated_at = now() FROM v WHERE t.id = v.template_id;

WITH v AS (
  INSERT INTO message_template_versions (template_id, version, subject, body, variables, created_by)
  SELECT t.id,
         (SELECT COALESCE(MAX(version), 0) + 1 FROM message_template_versions WHERE template_id = t.id),
         'Site para {{nome_empresa}}',
         E'Oi, {{nome_curto}}! Tudo bem?\n\n' ||
         E'Me chamo Geovanna, sou desenvolvedora e faço sites para negócios locais.\n\n' ||
         E'Reparei que a barbearia ainda não tem site próprio, e quem procura no Google acaba não achando vocês direito. Anexei um exemplo de modelo pra você ver o estilo (é uma referência genérica, não foi feita para a barbearia).\n\n' ||
         E'Se curtir a ideia, eu monto uma versão com a cara da sua barbearia, sem compromisso nenhum.',
         ARRAY['nome_curto', 'nome_empresa']::text[],
         (SELECT created_by FROM message_template_versions WHERE id = t.current_version_id)
    FROM message_templates t WHERE t.id = '00000000-0000-0000-0000-000000000010'
  RETURNING id, template_id
)
UPDATE message_templates t SET current_version_id = v.id, updated_at = now() FROM v WHERE t.id = v.template_id;

WITH v AS (
  INSERT INTO message_template_versions (template_id, version, subject, body, variables, created_by)
  SELECT t.id,
         (SELECT COALESCE(MAX(version), 0) + 1 FROM message_template_versions WHERE template_id = t.id),
         'Site para {{nome_empresa}}',
         E'Olá, tudo bem?\n\n' ||
         E'Me chamo Geovanna, sou desenvolvedora e faço sites para clínicas e consultórios.\n\n' ||
         E'Vi que a clínica ainda não tem site próprio. Hoje muita gente pesquisa no Google antes de marcar consulta, e um site simples com os serviços, o endereço e um botão de agendamento já resolve bem isso.\n\n' ||
         E'Anexei um exemplo de modelo só como referência (não foi feito para a clínica). Se gostar, eu faço uma versão personalizada, sem compromisso.',
         ARRAY['nome_empresa']::text[],
         (SELECT created_by FROM message_template_versions WHERE id = t.current_version_id)
    FROM message_templates t WHERE t.id = '00000000-0000-0000-0000-000000000030'
  RETURNING id, template_id
)
UPDATE message_templates t SET current_version_id = v.id, updated_at = now() FROM v WHERE t.id = v.template_id;

WITH v AS (
  INSERT INTO message_template_versions (template_id, version, subject, body, variables, created_by)
  SELECT t.id,
         (SELECT COALESCE(MAX(version), 0) + 1 FROM message_template_versions WHERE template_id = t.id),
         'Uma ideia para o site de {{nome_empresa}}',
         E'Olá, tudo bem?\n\n' ||
         E'Me chamo Geovanna, sou desenvolvedora e trabalho com sites de empresas e profissionais.\n\n' ||
         E'Vi que vocês já têm um site, então não escrevo para oferecer um novo. Nesses casos costumo revisar o que já existe e apontar melhorias objetivas: desempenho no celular, clareza das informações de contato e presença nas buscas do Google.\n\n' ||
         E'Se houver interesse, posso analisar o site de vocês e enviar as sugestões, sem compromisso. Abaixo deixo meu portfólio para conhecer o trabalho.',
         ARRAY['nome_empresa']::text[],
         (SELECT created_by FROM message_template_versions WHERE id = t.current_version_id)
    FROM message_templates t WHERE t.id = '00000000-0000-0000-0000-000000000060'
  RETURNING id, template_id
)
UPDATE message_templates t SET current_version_id = v.id, updated_at = now() FROM v WHERE t.id = v.template_id;

WITH v AS (
  INSERT INTO message_template_versions (template_id, version, subject, body, variables, created_by)
  SELECT t.id,
         (SELECT COALESCE(MAX(version), 0) + 1 FROM message_template_versions WHERE template_id = t.id),
         'Site para {{nome_curto}}',
         E'Oi, {{nome_curto}}! Tudo bem?\n\n' ||
         E'Me chamo Geovanna, sou desenvolvedora e faço sites para profissionais.\n\n' ||
         E'Vi que você ainda não tem um site próprio para divulgar os treinos e planos. Anexei um exemplo de modelo para você ver o estilo (é uma referência genérica, não foi feita para você).\n\n' ||
         E'Se curtir, eu monto uma versão com a sua identidade, sem compromisso.',
         ARRAY['nome_curto']::text[],
         (SELECT created_by FROM message_template_versions WHERE id = t.current_version_id)
    FROM message_templates t WHERE t.id = '00000000-0000-0000-0000-000000000040'
  RETURNING id, template_id
)
UPDATE message_templates t SET current_version_id = v.id, updated_at = now() FROM v WHERE t.id = v.template_id;

-- Melhoria de site (informal): rewritten to hook before introducing.
WITH v AS (
  INSERT INTO message_template_versions (template_id, version, subject, body, variables, created_by)
  SELECT t.id,
         (SELECT COALESCE(MAX(version), 0) + 1 FROM message_template_versions WHERE template_id = t.id),
         '{{nome_empresa}}, seu site pode estar perdendo cliente sem você notar',
         E'Oi, {{nome_curto}}! Tudo bem?\n\n' ||
         E'Rapidinho: muito negócio local perde cliente sem perceber, porque o site demora pra carregar no celular ou dificulta o contato pelo WhatsApp. Geralmente ninguém nota até parar pra olhar de fora.\n\n' ||
         E'Me chamo Geovanna, sou desenvolvedora, e separei um tempo pra montar como ficaria o site de vocês numa versão mais moderna e premium. Posso te mostrar esse design, sem compromisso nenhum.\n\n' ||
         E'Trabalho bem caprichoso e sou bem elogiada nisso. Dá uma olhada no meu portfólio abaixo e me diz se faz sentido pra vocês.',
         ARRAY['nome_curto', 'nome_empresa']::text[],
         (SELECT created_by FROM message_template_versions WHERE id = t.current_version_id)
    FROM message_templates t WHERE t.id = '00000000-0000-0000-0000-000000000050'
  RETURNING id, template_id
)
UPDATE message_templates t SET current_version_id = v.id, updated_at = now() FROM v WHERE t.id = v.template_id;
