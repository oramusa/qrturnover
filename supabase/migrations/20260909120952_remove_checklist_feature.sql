-- Remove the retired checklist feature and its stored checklist data.
-- QR sets, property zones, scan events, proof photos, and turnover sessions remain intact.
drop table if exists public.scan_item_completions cascade;
drop table if exists public.zone_checklist_items cascade;
drop table if exists public.checklist_template_items cascade;
drop table if exists public.checklist_templates cascade;
