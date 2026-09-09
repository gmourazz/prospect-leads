-- Real login credentials for the account holder, replacing the placeholder
-- owner seeded in migration 000002. password_hash is bcrypt; the plaintext
-- is never stored anywhere.
UPDATE users
   SET email = 'gmouraz@icloud.com',
       name  = 'Geovanna Moura',
       password_hash = '$2a$10$lL2pkXLovS1iCNEHfsIZr.NN5FIaKOWEHIdjFvVjBvr14fw6DDWdm'
 WHERE id = '00000000-0000-0000-0000-000000000001';
