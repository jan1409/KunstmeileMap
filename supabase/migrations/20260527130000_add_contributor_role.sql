-- Adds a third, narrower role to the per-event role enum.
-- Ordering: contributor < editor < owner. A separate migration is required
-- because Postgres does not allow ADD VALUE and uses of the new value in the
-- same transaction. The follow-up migration 20260527130001 references this
-- value in policies and helper functions.
alter type event_role add value 'contributor' before 'editor';
