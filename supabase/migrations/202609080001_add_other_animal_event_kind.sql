-- "Other event" records are created by the Farm operation screen.
-- This enum value must exist remotely so queued offline records can upload.
alter type public.animal_event_kind add value if not exists 'other';
