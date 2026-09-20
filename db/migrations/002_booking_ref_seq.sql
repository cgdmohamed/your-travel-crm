-- Concurrency-safe BK-#### ref generation for bookings (Phase 3).
-- Previously computed client-side from array length (`BK-${1049 + prev.length}`)
-- which races under concurrent inserts. A dedicated sequence guarantees a
-- unique, monotonically increasing number regardless of concurrent writers.
begin;

create sequence if not exists booking_ref_seq start 1050;

commit;
