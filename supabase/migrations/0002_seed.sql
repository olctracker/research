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

-- (The spec's illustrative Example A is not seeded: real Spam level 5 costs 14,586.)

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

-- Device and Network prices from hackex.net (levels 2–11, plus Device 12 below).
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

-- Device level 12 (Nova Ultra) from hackex.net.
insert into public.price_observations
  (id, upgrade_id, method, from_level, to_level, cost, cost_type, price_basis, contributor_id, contributor_alias, notes) values
  ('00000000-0000-4000-8000-000000000600', 'device', 'store', 11, 12, 300000, 'per_level', 'final', null, 'hackex.net', 'hackex.net Devices table: Nova Ultra')
on conflict (id) do nothing;

-- hilltop's store paste and home screenshot were taken at reboot R3.
update public.price_observations set reboots = 3
  where contributor_id is null and contributor_alias = 'hilltop' and reboots is null;
update public.level_requirement_observations set reboots = 3
  where contributor_id is null and contributor_alias = 'hilltop' and reboots is null;

-- hackex.net software guide: base (level 1) prices and levels 5, 10, 15.
-- Defensive base prices are list prices before the 15% store discount.
insert into public.price_observations
  (id, upgrade_id, method, from_level, to_level, cost, cost_type, price_basis, contributor_id, contributor_alias, notes) values
  ('00000000-0000-4000-8000-000000000700', 'firewall', 'store', 0, 1, 800, 'per_level', 'before_discount', null, 'hackex.net', 'hackex.net software guide: base price (before 15% defensive discount)'),
  ('00000000-0000-4000-8000-000000000701', 'firewall', 'store', 4, 5, 5511, 'per_level', 'final', null, 'hackex.net', 'hackex.net software guide: Lv 5'),
  ('00000000-0000-4000-8000-000000000702', 'firewall', 'store', 9, 10, 13569, 'per_level', 'final', null, 'hackex.net', 'hackex.net software guide: Lv 10'),
  ('00000000-0000-4000-8000-000000000703', 'firewall', 'store', 14, 15, 22985, 'per_level', 'final', null, 'hackex.net', 'hackex.net software guide: Lv 15'),
  ('00000000-0000-4000-8000-000000000704', 'bypasser', 'store', 0, 1, 800, 'per_level', 'final', null, 'hackex.net', 'hackex.net software guide: base price'),
  ('00000000-0000-4000-8000-000000000705', 'bypasser', 'store', 4, 5, 6483, 'per_level', 'final', null, 'hackex.net', 'hackex.net software guide: Lv 5'),
  ('00000000-0000-4000-8000-000000000706', 'bypasser', 'store', 9, 10, 15963, 'per_level', 'final', null, 'hackex.net', 'hackex.net software guide: Lv 10'),
  ('00000000-0000-4000-8000-000000000707', 'bypasser', 'store', 14, 15, 27041, 'per_level', 'final', null, 'hackex.net', 'hackex.net software guide: Lv 15'),
  ('00000000-0000-4000-8000-000000000708', 'password_cracker', 'store', 0, 1, 1100, 'per_level', 'final', null, 'hackex.net', 'hackex.net software guide: base price'),
  ('00000000-0000-4000-8000-000000000709', 'password_cracker', 'store', 4, 5, 8914, 'per_level', 'final', null, 'hackex.net', 'hackex.net software guide: Lv 5'),
  ('00000000-0000-4000-8000-000000000710', 'password_cracker', 'store', 9, 10, 21948, 'per_level', 'final', null, 'hackex.net', 'hackex.net software guide: Lv 10'),
  ('00000000-0000-4000-8000-000000000711', 'password_cracker', 'store', 14, 15, 37181, 'per_level', 'final', null, 'hackex.net', 'hackex.net software guide: Lv 15'),
  ('00000000-0000-4000-8000-000000000712', 'password_encryptor', 'store', 0, 1, 1100, 'per_level', 'before_discount', null, 'hackex.net', 'hackex.net software guide: base price (before 15% defensive discount)'),
  ('00000000-0000-4000-8000-000000000713', 'password_encryptor', 'store', 4, 5, 7577, 'per_level', 'final', null, 'hackex.net', 'hackex.net software guide: Lv 5'),
  ('00000000-0000-4000-8000-000000000714', 'password_encryptor', 'store', 9, 10, 18656, 'per_level', 'final', null, 'hackex.net', 'hackex.net software guide: Lv 10'),
  ('00000000-0000-4000-8000-000000000715', 'password_encryptor', 'store', 14, 15, 31604, 'per_level', 'final', null, 'hackex.net', 'hackex.net software guide: Lv 15'),
  ('00000000-0000-4000-8000-000000000716', 'antivirus', 'store', 0, 1, 1000, 'per_level', 'before_discount', null, 'hackex.net', 'hackex.net software guide: base price (before 15% defensive discount)'),
  ('00000000-0000-4000-8000-000000000717', 'antivirus', 'store', 4, 5, 6889, 'per_level', 'final', null, 'hackex.net', 'hackex.net software guide: Lv 5'),
  ('00000000-0000-4000-8000-000000000718', 'antivirus', 'store', 9, 10, 16961, 'per_level', 'final', null, 'hackex.net', 'hackex.net software guide: Lv 10'),
  ('00000000-0000-4000-8000-000000000719', 'antivirus', 'store', 14, 15, 28731, 'per_level', 'final', null, 'hackex.net', 'hackex.net software guide: Lv 15'),
  ('00000000-0000-4000-8000-000000000720', 'spam', 'store', 0, 1, 1800, 'per_level', 'final', null, 'hackex.net', 'hackex.net software guide: base price'),
  ('00000000-0000-4000-8000-000000000721', 'spam', 'store', 4, 5, 14586, 'per_level', 'final', null, 'hackex.net', 'hackex.net software guide: Lv 5'),
  ('00000000-0000-4000-8000-000000000722', 'spam', 'store', 9, 10, 35915, 'per_level', 'final', null, 'hackex.net', 'hackex.net software guide: Lv 10'),
  ('00000000-0000-4000-8000-000000000723', 'spam', 'store', 14, 15, 60841, 'per_level', 'final', null, 'hackex.net', 'hackex.net software guide: Lv 15'),
  ('00000000-0000-4000-8000-000000000724', 'siphon', 'store', 0, 1, 1600, 'per_level', 'final', null, 'hackex.net', 'hackex.net software guide: base price'),
  ('00000000-0000-4000-8000-000000000725', 'siphon', 'store', 4, 5, 12966, 'per_level', 'final', null, 'hackex.net', 'hackex.net software guide: Lv 5'),
  ('00000000-0000-4000-8000-000000000726', 'siphon', 'store', 9, 10, 31925, 'per_level', 'final', null, 'hackex.net', 'hackex.net software guide: Lv 10'),
  ('00000000-0000-4000-8000-000000000727', 'siphon', 'store', 14, 15, 54081, 'per_level', 'final', null, 'hackex.net', 'hackex.net software guide: Lv 15'),
  ('00000000-0000-4000-8000-000000000728', 'rootkit', 'store', 0, 1, 1400, 'per_level', 'final', null, 'hackex.net', 'hackex.net software guide: base price'),
  ('00000000-0000-4000-8000-000000000729', 'rootkit', 'store', 4, 5, 11345, 'per_level', 'final', null, 'hackex.net', 'hackex.net software guide: Lv 5'),
  ('00000000-0000-4000-8000-000000000730', 'rootkit', 'store', 9, 10, 27934, 'per_level', 'final', null, 'hackex.net', 'hackex.net software guide: Lv 10'),
  ('00000000-0000-4000-8000-000000000731', 'rootkit', 'store', 14, 15, 47321, 'per_level', 'final', null, 'hackex.net', 'hackex.net software guide: Lv 15'),
  ('00000000-0000-4000-8000-000000000732', 'proxy', 'store', 0, 1, 900, 'per_level', 'before_discount', null, 'hackex.net', 'hackex.net software guide: base price (before 15% defensive discount)'),
  ('00000000-0000-4000-8000-000000000733', 'proxy', 'store', 4, 5, 6200, 'per_level', 'final', null, 'hackex.net', 'hackex.net software guide: Lv 5'),
  ('00000000-0000-4000-8000-000000000734', 'proxy', 'store', 9, 10, 15265, 'per_level', 'final', null, 'hackex.net', 'hackex.net software guide: Lv 10'),
  ('00000000-0000-4000-8000-000000000735', 'proxy', 'store', 14, 15, 25858, 'per_level', 'final', null, 'hackex.net', 'hackex.net software guide: Lv 15'),
  ('00000000-0000-4000-8000-000000000736', 'trace', 'store', 0, 1, 900, 'per_level', 'before_discount', null, 'hackex.net', 'hackex.net software guide: base price (before 15% defensive discount)'),
  ('00000000-0000-4000-8000-000000000737', 'trace', 'store', 4, 5, 6200, 'per_level', 'final', null, 'hackex.net', 'hackex.net software guide: Lv 5'),
  ('00000000-0000-4000-8000-000000000738', 'trace', 'store', 9, 10, 15265, 'per_level', 'final', null, 'hackex.net', 'hackex.net software guide: Lv 10'),
  ('00000000-0000-4000-8000-000000000739', 'trace', 'store', 14, 15, 25858, 'per_level', 'final', null, 'hackex.net', 'hackex.net software guide: Lv 15'),
  ('00000000-0000-4000-8000-000000000740', 'keygen', 'store', 0, 1, 600, 'per_level', 'final', null, 'hackex.net', 'hackex.net software guide: base price'),
  ('00000000-0000-4000-8000-000000000741', 'keygen', 'store', 4, 5, 4862, 'per_level', 'final', null, 'hackex.net', 'hackex.net software guide: Lv 5'),
  ('00000000-0000-4000-8000-000000000742', 'keygen', 'store', 9, 10, 11972, 'per_level', 'final', null, 'hackex.net', 'hackex.net software guide: Lv 10'),
  ('00000000-0000-4000-8000-000000000743', 'keygen', 'store', 14, 15, 20281, 'per_level', 'final', null, 'hackex.net', 'hackex.net software guide: Lv 15'),
  ('00000000-0000-4000-8000-000000000744', 'notepad', 'store', 0, 1, 5000, 'one_time', 'final', null, 'hackex.net', 'hackex.net software guide'),
  ('00000000-0000-4000-8000-000000000745', 'message_encryptor', 'store', 0, 1, 9000, 'one_time', 'final', null, 'hackex.net', 'hackex.net software guide')
on conflict (id) do nothing;

-- Keygen key prices from two friends' Apps screens (LOCKED downloads, Oct 18 2026).
insert into public.price_observations
  (id, upgrade_id, method, from_level, to_level, cost, cost_type, price_basis, keygen_level, contributor_id, contributor_alias, notes) values
  ('00000000-0000-4000-8000-000000000800', 'firewall', 'download', 1, 20, 16090, 'combined', 'final', 30, null, 'friend A (Keygen 30)', 'Apps screen paste: LOCKED download'),
  ('00000000-0000-4000-8000-000000000801', 'password_encryptor', 'download', 1, 20, 22123, 'combined', 'final', 30, null, 'friend A (Keygen 30)', 'Apps screen paste: LOCKED download'),
  ('00000000-0000-4000-8000-000000000802', 'proxy', 'download', 20, 44, 52375, 'combined', 'final', 30, null, 'friend A (Keygen 30)', 'Apps screen paste: LOCKED download'),
  ('00000000-0000-4000-8000-000000000803', 'bypasser', 'download', 20, 40, 48389, 'combined', 'final', 30, null, 'friend A (Keygen 30)', 'Apps screen paste: LOCKED download'),
  ('00000000-0000-4000-8000-000000000804', 'password_cracker', 'download', 20, 35, 45628, 'combined', 'final', 30, null, 'friend A (Keygen 30)', 'Apps screen paste: LOCKED download'),
  ('00000000-0000-4000-8000-000000000805', 'spam', 'download', 20, 32, 57451, 'combined', 'final', 30, null, 'friend A (Keygen 30)', 'Apps screen paste: LOCKED download'),
  ('00000000-0000-4000-8000-000000000806', 'rootkit', 'download', 6, 20, 26789, 'combined', 'final', 30, null, 'friend A (Keygen 30)', 'Apps screen paste: LOCKED download'),
  ('00000000-0000-4000-8000-000000000807', 'siphon', 'download', 17, 30, 49411, 'combined', 'final', 30, null, 'friend A (Keygen 30)', 'Apps screen paste: LOCKED download'),
  ('00000000-0000-4000-8000-000000000808', 'trace', 'download', 0, 35, 38898, 'combined', 'final', 30, null, 'friend A (Keygen 30)', 'Apps screen paste: LOCKED download'),
  ('00000000-0000-4000-8000-000000000809', 'antivirus', 'download', 34, 40, 24895, 'combined', 'final', 50, null, 'friend B (Keygen 50)', 'Apps screen paste: LOCKED download'),
  ('00000000-0000-4000-8000-000000000810', 'password_encryptor', 'download', 1, 47, 69745, 'combined', 'final', 50, null, 'friend B (Keygen 50)', 'Apps screen paste: LOCKED download'),
  ('00000000-0000-4000-8000-000000000811', 'proxy', 'download', 44, 55, 46791, 'combined', 'final', 50, null, 'friend B (Keygen 50)', 'Apps screen paste: LOCKED download'),
  ('00000000-0000-4000-8000-000000000812', 'trace', 'download', 38, 55, 62265, 'combined', 'final', 50, null, 'friend B (Keygen 50)', 'Apps screen paste: LOCKED download'),
  ('00000000-0000-4000-8000-000000000813', 'bypasser', 'download', 50, 58, 43760, 'combined', 'final', 50, null, 'friend B (Keygen 50)', 'Apps screen paste: LOCKED download'),
  ('00000000-0000-4000-8000-000000000814', 'password_cracker', 'download', 40, 56, 87856, 'combined', 'final', 50, null, 'friend B (Keygen 50)', 'Apps screen paste: LOCKED download'),
  ('00000000-0000-4000-8000-000000000815', 'spam', 'download', 36, 41, 50296, 'combined', 'final', 50, null, 'friend B (Keygen 50)', 'Apps screen paste: LOCKED download'),
  ('00000000-0000-4000-8000-000000000816', 'rootkit', 'download', 25, 50, 113178, 'combined', 'final', 50, null, 'friend B (Keygen 50)', 'Apps screen paste: LOCKED download'),
  ('00000000-0000-4000-8000-000000000817', 'siphon', 'download', 35, 41, 48389, 'combined', 'final', 50, null, 'friend B (Keygen 50)', 'Apps screen paste: LOCKED download')
on conflict (id) do nothing;

-- A friend's store screenshot (Oct 18 2026).
insert into public.price_observations
  (id, upgrade_id, method, from_level, to_level, cost, cost_type, price_basis, keygen_level, contributor_id, contributor_alias, notes) values
  ('00000000-0000-4000-8000-000000000900', 'firewall', 'store', 1, 2, 1675, 'per_level', 'final', null, null, 'hilltop''s friend', 'Friend''s store screenshot, Oct 18 2026'),
  ('00000000-0000-4000-8000-000000000901', 'bypasser', 'store', 20, 21, 41877, 'per_level', 'final', null, null, 'hilltop''s friend', 'Friend''s store screenshot, Oct 18 2026'),
  ('00000000-0000-4000-8000-000000000902', 'password_encryptor', 'store', 1, 2, 2303, 'per_level', 'final', null, null, 'hilltop''s friend', 'Friend''s store screenshot, Oct 18 2026'),
  ('00000000-0000-4000-8000-000000000903', 'password_cracker', 'store', 20, 21, 57581, 'per_level', 'final', null, null, 'hilltop''s friend', 'Friend''s store screenshot, Oct 18 2026')
on conflict (id) do nothing;
