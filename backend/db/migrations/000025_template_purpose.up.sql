-- Same organizational idea as channel (000024): a template is also written
-- for a specific moment in the relationship — the cold first touch, or a
-- remarketing nudge to someone already contacted before. Purely a label for
-- picking the right message; it gates nothing on its own.
ALTER TABLE message_templates
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'first_contact';
