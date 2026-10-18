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

-- Botnet tier prices from hackex.net (site tier 0 "Free" = our level 1) and the
-- next-level prices from hilltop's store screen paste (Oct 18 2026).
insert into public.price_observations
  (id, upgrade_id, method, from_level, to_level, cost, cost_type, price_basis, contributor_id, contributor_alias, notes) values
  ('00000000-0000-4000-8000-000000000300', 'botnet', 'store', 1, 2, 800, 'per_level', 'final', null, 'hackex.net', 'hackex.net Botnet Tiers: Node · 4 slots · needs player LVL 3 (site tier 0)'),
  ('00000000-0000-4000-8000-000000000301', 'botnet', 'store', 2, 3, 3500, 'per_level', 'final', null, 'hackex.net', 'hackex.net Botnet Tiers: Cluster · 8 slots (site tier 1)'),
  ('00000000-0000-4000-8000-000000000302', 'botnet', 'store', 3, 4, 15000, 'per_level', 'final', null, 'hackex.net', 'hackex.net Botnet Tiers: Grid · 16 slots (site tier 2)'),
  ('00000000-0000-4000-8000-000000000303', 'botnet', 'store', 4, 5, 42000, 'per_level', 'final', null, 'hackex.net', 'hackex.net Botnet Tiers: Farm · 28 slots (site tier 3)'),
  ('00000000-0000-4000-8000-000000000304', 'botnet', 'store', 5, 6, 95000, 'per_level', 'final', null, 'hackex.net', 'hackex.net Botnet Tiers: Hive · 44 slots (site tier 4)'),
  ('00000000-0000-4000-8000-000000000305', 'botnet', 'store', 6, 7, 180000, 'per_level', 'final', null, 'hackex.net', 'hackex.net Botnet Tiers: Nexus · 64 slots (site tier 5)'),
  ('00000000-0000-4000-8000-000000000306', 'device', 'store', 4, 5, 28000, 'per_level', 'final', null, 'hilltop', 'Store screen paste, Oct 18 2026'),
  ('00000000-0000-4000-8000-000000000307', 'network', 'store', 9, 10, 120000, 'per_level', 'final', null, 'hilltop', 'Store screen paste, Oct 18 2026'),
  ('00000000-0000-4000-8000-000000000308', 'botnet', 'store', 6, 7, 180000, 'per_level', 'final', null, 'hilltop', 'Store screen paste, Oct 18 2026'),
  ('00000000-0000-4000-8000-000000000309', 'firewall', 'store', 21, 22, 37815, 'per_level', 'final', null, 'hilltop', 'Store screen paste, Oct 18 2026'),
  ('00000000-0000-4000-8000-000000000310', 'bypasser', 'store', 20, 21, 41877, 'per_level', 'final', null, 'hilltop', 'Store screen paste, Oct 18 2026'),
  ('00000000-0000-4000-8000-000000000311', 'password_encryptor', 'store', 1, 2, 2303, 'per_level', 'final', null, 'hilltop', 'Store screen paste, Oct 18 2026'),
  ('00000000-0000-4000-8000-000000000312', 'password_cracker', 'store', 1, 2, 2709, 'per_level', 'final', null, 'hilltop', 'Store screen paste, Oct 18 2026'),
  ('00000000-0000-4000-8000-000000000313', 'spam', 'store', 20, 21, 94224, 'per_level', 'final', null, 'hilltop', 'Store screen paste, Oct 18 2026'),
  ('00000000-0000-4000-8000-000000000314', 'siphon', 'store', 17, 18, 68545, 'per_level', 'final', null, 'hilltop', 'Store screen paste, Oct 18 2026'),
  ('00000000-0000-4000-8000-000000000315', 'rootkit', 'store', 0, 1, 1400, 'per_level', 'final', null, 'hilltop', 'Store screen paste, Oct 18 2026'),
  ('00000000-0000-4000-8000-000000000316', 'antivirus', 'store', 1, 2, 2094, 'per_level', 'final', null, 'hilltop', 'Store screen paste, Oct 18 2026'),
  ('00000000-0000-4000-8000-000000000317', 'proxy', 'store', 20, 21, 40046, 'per_level', 'final', null, 'hilltop', 'Store screen paste, Oct 18 2026'),
  ('00000000-0000-4000-8000-000000000318', 'trace', 'store', 0, 1, 765, 'per_level', 'final', null, 'hilltop', 'Store screen paste, Oct 18 2026'),
  ('00000000-0000-4000-8000-000000000319', 'keygen', 'store', 20, 21, 31408, 'per_level', 'final', null, 'hilltop', 'Store screen paste, Oct 18 2026'),
  ('00000000-0000-4000-8000-000000000320', 'notepad', 'store', 0, 1, 5000, 'one_time', 'final', null, 'hilltop', 'Store screen paste, Oct 18 2026')
on conflict (id) do nothing;

-- Character LVL 24 needs 17,993 XP (game home screenshot, Oct 18 2026).
insert into public.level_requirement_observations
  (id, level, exp_required, contributor_id, contributor_alias, notes) values
  ('00000000-0000-4000-8000-000000000400', 24, 17993, null, 'hilltop', 'Game home screenshot, Oct 18 2026')
on conflict (id) do nothing;

-- Device and Network prices from hackex.net (levels 2–11; Device level 12 not yet recorded).
insert into public.price_observations
  (id, upgrade_id, method, from_level, to_level, cost, cost_type, price_basis, contributor_id, contributor_alias, notes) values
  ('00000000-0000-4000-8000-000000000500', 'device', 'store', 1, 2, 4000, 'per_level', 'final', null, 'hackex.net', 'hackex.net Devices table: Raider II'),
  ('00000000-0000-4000-8000-000000000501', 'device', 'store', 2, 3, 10000, 'per_level', 'final', null, 'hackex.net', 'hackex.net Devices table: Raider III'),
  ('00000000-0000-4000-8000-000000000502', 'device', 'store', 3, 4, 18000, 'per_level', 'final', null, 'hackex.net', 'hackex.net Devices table: Bolt'),
  ('00000000-0000-4000-8000-000000000503', 'device', 'store', 4, 5, 28000, 'per_level', 'final', null, 'hackex.net', 'hackex.net Devices table: Bolt II'),
  ('00000000-0000-4000-8000-000000000504', 'device', 'store', 5, 6, 40000, 'per_level', 'final', null, 'hackex.net', 'hackex.net Devices table: Bolt III'),
  ('00000000-0000-4000-8000-000000000505', 'device', 'store', 6, 7, 56000, 'per_level', 'final', null, 'hackex.net', 'hackex.net Devices table: Nova'),
  ('00000000-0000-4000-8000-000000000506', 'device', 'store', 7, 8, 82000, 'per_level', 'final', null, 'hackex.net', 'hackex.net Devices table: Nova II'),
  ('00000000-0000-4000-8000-000000000507', 'device', 'store', 8, 9, 120000, 'per_level', 'final', null, 'hackex.net', 'hackex.net Devices table: Nova III'),
  ('00000000-0000-4000-8000-000000000508', 'device', 'store', 9, 10, 160000, 'per_level', 'final', null, 'hackex.net', 'hackex.net Devices table: Nova S'),
  ('00000000-0000-4000-8000-000000000509', 'device', 'store', 10, 11, 220000, 'per_level', 'final', null, 'hackex.net', 'hackex.net Devices table: Nova X'),
  ('00000000-0000-4000-8000-000000000510', 'network', 'store', 1, 2, 3000, 'per_level', 'final', null, 'hackex.net', 'hackex.net Network table: Cable'),
  ('00000000-0000-4000-8000-000000000511', 'network', 'store', 2, 3, 7000, 'per_level', 'final', null, 'hackex.net', 'hackex.net Network table: Cable+'),
  ('00000000-0000-4000-8000-000000000512', 'network', 'store', 3, 4, 12000, 'per_level', 'final', null, 'hackex.net', 'hackex.net Network table: 4G LTE'),
  ('00000000-0000-4000-8000-000000000513', 'network', 'store', 4, 5, 20000, 'per_level', 'final', null, 'hackex.net', 'hackex.net Network table: 5G'),
  ('00000000-0000-4000-8000-000000000514', 'network', 'store', 5, 6, 30000, 'per_level', 'final', null, 'hackex.net', 'hackex.net Network table: 5G+'),
  ('00000000-0000-4000-8000-000000000515', 'network', 'store', 6, 7, 44000, 'per_level', 'final', null, 'hackex.net', 'hackex.net Network table: Fiber'),
  ('00000000-0000-4000-8000-000000000516', 'network', 'store', 7, 8, 60000, 'per_level', 'final', null, 'hackex.net', 'hackex.net Network table: Fiber+'),
  ('00000000-0000-4000-8000-000000000517', 'network', 'store', 8, 9, 85000, 'per_level', 'final', null, 'hackex.net', 'hackex.net Network table: 10G Fiber'),
  ('00000000-0000-4000-8000-000000000518', 'network', 'store', 9, 10, 120000, 'per_level', 'final', null, 'hackex.net', 'hackex.net Network table: 10G Fiber+'),
  ('00000000-0000-4000-8000-000000000519', 'network', 'store', 10, 11, 170000, 'per_level', 'final', null, 'hackex.net', 'hackex.net Network table: Quantum Link')
on conflict (id) do nothing;
