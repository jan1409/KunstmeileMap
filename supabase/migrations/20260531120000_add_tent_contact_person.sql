-- Adds an optional 'contact_person' field to tents. The exhibitor 'name' may
-- be a company/collective; this field captures the person to ask for.
alter table tents add column contact_person text;
