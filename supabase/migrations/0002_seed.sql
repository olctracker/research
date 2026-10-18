-- =====================================================================
-- Seed data: the 16-entry catalog and the spec's Example A observations.
-- Safe to run more than once.
-- =====================================================================

insert into public.upgrade_catalog
  (id, name, category, kind, start_level, max_level, store, download, defensive_discount, sort_order) values
  ('device',             'Device',             'core',      'level',    1, 12,   true, false, false,  1),
  ('network',            'Network',            'core',      'level',    1, 11,   true, false, false,  2),
  ('botnet',             'Botnet',             'core',      'level',    1, 7,    true, false, false,  3),
  ('firewall',           'Firewall',           'defensive', 'level',    1, null, true, true,  true,   4),
  ('password_encryptor', 'Password Encryptor', 'defensive', 'level',    1, null, true, true,  true,   5),
  ('antivirus',          'Antivirus',          'defensive', 'level',    0, null, true, true,  true,   6),
  ('proxy',              'Proxy',              'defensive', 'level',    0, null, true, true,  true,   7),
  ('trace',              'Trace',              'defensive', 'level',    0, null, true, true,  true,   8),
  ('bypasser',           'Bypasser',           'offensive', 'level',    1, null, true, true,  false,  9),
  ('password_cracker',   'Password Cracker',   'offensive', 'level',    1, null, true, true,  false, 10),
  ('spam',               'Spam',               'virus',     'level',    0, null, true, true,  false, 11),
  ('siphon',             'Siphon',             'virus',     'level',    0, null, true, true,  false, 12),
  ('rootkit',            'Rootkit',            'virus',     'level',    0, null, true, true,  false, 13),
  ('keygen',             'Keygen',             'utility',   'level',    0, null, true, false, false, 14),
  ('message_encryptor',  'Message Encryptor',  'one_time',  'one_time', 0, 1,    true, false, false, 15),
  ('notepad',            'Notepad',            'one_time',  'one_time', 0, 1,    true, false, false, 16)
on conflict (id) do update set
  name = excluded.name, category = excluded.category, kind = excluded.kind, start_level = excluded.start_level,
  max_level = excluded.max_level, store = excluded.store, download = excluded.download,
  defensive_discount = excluded.defensive_discount, sort_order = excluded.sort_order;

-- Example A: Spam store levels 2–5 (observed once each; not a confirmed formula).
-- Fixed ids so re-running doesn't duplicate them.
insert into public.price_observations
  (id, upgrade_id, method, from_level, to_level, cost, cost_type, price_basis, contributor_id, contributor_alias, notes) values
  ('00000000-0000-4000-8000-000000000102', 'spam', 'store', 1, 2, 200, 'per_level', 'final', null, 'spec-example', 'Spec Example A (store 1 → 5)'),
  ('00000000-0000-4000-8000-000000000103', 'spam', 'store', 2, 3, 300, 'per_level', 'final', null, 'spec-example', 'Spec Example A (store 1 → 5)'),
  ('00000000-0000-4000-8000-000000000104', 'spam', 'store', 3, 4, 400, 'per_level', 'final', null, 'spec-example', 'Spec Example A (store 1 → 5)'),
  ('00000000-0000-4000-8000-000000000105', 'spam', 'store', 4, 5, 500, 'per_level', 'final', null, 'spec-example', 'Spec Example A (store 1 → 5)')
on conflict (id) do nothing;

insert into public.exp_observations
  (id, upgrade_id, method, from_level, to_level, exp, exp_basis, source, contributor_id, contributor_alias, notes) values
  ('00000000-0000-4000-8000-000000000202', 'spam', 'store', 1, 2, 2, 'per_level', 'entered', null, 'spec-example', 'Spec Example A (store 1 → 5)'),
  ('00000000-0000-4000-8000-000000000203', 'spam', 'store', 2, 3, 3, 'per_level', 'entered', null, 'spec-example', 'Spec Example A (store 1 → 5)'),
  ('00000000-0000-4000-8000-000000000204', 'spam', 'store', 3, 4, 4, 'per_level', 'entered', null, 'spec-example', 'Spec Example A (store 1 → 5)'),
  ('00000000-0000-4000-8000-000000000205', 'spam', 'store', 4, 5, 5, 'per_level', 'entered', null, 'spec-example', 'Spec Example A (store 1 → 5)')
on conflict (id) do nothing;
