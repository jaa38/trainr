
-- TRAINR Sprint 11A
-- Migration 2: booking session-rate references and snapshots
--
-- Historical bookings intentionally retain NULL session-rate references and
-- NULL session detail snapshots. Their existing price/currency values remain
-- untouched. New bookings must populate the complete snapshot via the
-- create_trainer_booking RPC introduced in the next migration.

BEGIN;

-- A composite unique key allows the booking FK to enforce that the selected
-- session rate belongs to the same trainer as the booking.
ALTER TABLE public.trainer_session_rates
    ADD CONSTRAINT trainer_session_rates_id_trainer_unique
    UNIQUE (id, trainer_id);

ALTER TABLE public.trainer_bookings
    ADD COLUMN session_rate_id uuid,
    ADD COLUMN session_type text,
    ADD COLUMN training_format text,
    ADD COLUMN session_duration_minutes integer;

ALTER TABLE public.trainer_bookings
    ADD CONSTRAINT trainer_bookings_session_rate_trainer_fkey
    FOREIGN KEY (session_rate_id, trainer_id)
    REFERENCES public.trainer_session_rates (id, trainer_id)
    ON DELETE RESTRICT;

-- Historical rows have all four fields NULL. New rate-backed bookings must
-- store all four together.
ALTER TABLE public.trainer_bookings
    ADD CONSTRAINT trainer_bookings_session_snapshot_complete
    CHECK (
        (
            session_rate_id IS NULL
            AND session_type IS NULL
            AND training_format IS NULL
            AND session_duration_minutes IS NULL
        )
        OR
        (
            session_rate_id IS NOT NULL
            AND session_type IS NOT NULL
            AND training_format IS NOT NULL
            AND session_duration_minutes IS NOT NULL
        )
    );

ALTER TABLE public.trainer_bookings
    ADD CONSTRAINT trainer_bookings_session_type_check
    CHECK (
        session_type IS NULL
        OR session_type IN ('one_to_one', 'group_training', 'online_training')
    );

ALTER TABLE public.trainer_bookings
    ADD CONSTRAINT trainer_bookings_training_format_check
    CHECK (
        training_format IS NULL
        OR training_format IN ('online', 'in_person', 'both')
    );

ALTER TABLE public.trainer_bookings
    ADD CONSTRAINT trainer_bookings_session_duration_check
    CHECK (
        session_duration_minutes IS NULL
        OR session_duration_minutes IN (30, 45, 60, 90)
    );

-- Ensure the snapshot duration matches the actual booking interval.
-- Historical bookings remain valid because their snapshot duration is NULL.
ALTER TABLE public.trainer_bookings
    ADD CONSTRAINT trainer_bookings_session_duration_matches_interval
    CHECK (
        session_duration_minutes IS NULL
        OR scheduled_end = (
            scheduled_start
            + pg_catalog.make_interval(
                mins => session_duration_minutes
            )
        )
    );

CREATE INDEX trainer_bookings_session_rate_id_idx
    ON public.trainer_bookings (session_rate_id)
    WHERE session_rate_id IS NOT NULL;

COMMENT ON COLUMN public.trainer_bookings.session_rate_id IS
    'Selected trainer session-rate record. NULL for historical bookings created before rate references were introduced.';

COMMENT ON COLUMN public.trainer_bookings.session_type IS
    'Immutable booking-time snapshot of the selected session type.';

COMMENT ON COLUMN public.trainer_bookings.training_format IS
    'Immutable booking-time snapshot of the selected training format.';

COMMENT ON COLUMN public.trainer_bookings.session_duration_minutes IS
    'Immutable booking-time snapshot of the selected session duration.';

COMMIT;
