-- Internal-only phone number for a tent's contact. Enterable by admins,
-- included in CSV/XLSX import and the static HTML export, but never shown on the
-- public site (rendered the same way as email_public: omitted from SidePanel).
alter table tents add column phone text;
