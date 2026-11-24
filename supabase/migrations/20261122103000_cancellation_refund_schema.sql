
-- TRAINR Sprint 11A
-- Migration 4: cancellation policy snapshots and refund schema
--
-- This migration creates the schema foundation only. It does not cancel
-- bookings, execute refunds, call Paystack, or modify existing financial rows.
--
-- Historical bookings retain NULL cancellation-policy snapshots.
-- The secure booking creation RPC must populate both policy snapshot columns
-- for new bookings.
--
-- Initial policy activation occurs only after the policy validation trigger
-- has been created.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Versioned cancellation policies
-- ---------------------------------------------------------------------------

CREATE TABLE public.cancellation_policies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_name text NOT NULL,
    version_number integer NOT NULL CHECK (version_number > 0),
    description text,
    status text NOT NULL DEFAULT 'inactive'
        CHECK (status IN ('active', 'inactive', 'retired')),
    effective_from timestamptz NOT NULL DEFAULT transaction_timestamp(),
    effective_until timestamptz,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT cancellation_policies_version_unique
        UNIQUE (version_number),
    CONSTRAINT cancellation_policies_effective_window_check
        CHECK (
            effective_until IS NULL
            OR effective_until > effective_from
        )
);

CREATE UNIQUE INDEX cancellation_policies_one_active_idx
    ON public.cancellation_policies ((status))
    WHERE status = 'active';

CREATE TABLE public.cancellation_policy_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id uuid NOT NULL
        REFERENCES public.cancellation_policies(id) ON DELETE RESTRICT,
    cancellation_initiator text NOT NULL
        CHECK (cancellation_initiator IN ('gym_goer', 'trainer')),
    window_key text NOT NULL,
    minimum_hours_before numeric(10, 4),
    maximum_hours_before numeric(10, 4),
    minimum_inclusive boolean NOT NULL DEFAULT true,
    maximum_inclusive boolean NOT NULL DEFAULT false,
    refund_percentage numeric(5, 2) NOT NULL
        CHECK (refund_percentage >= 0 AND refund_percentage <= 100),
    created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
    CONSTRAINT cancellation_policy_rules_window_unique
        UNIQUE (policy_id, cancellation_initiator, window_key),
    CONSTRAINT cancellation_policy_rules_bounds_check
        CHECK (
            (minimum_hours_before IS NULL OR minimum_hours_before >= 0)
            AND (maximum_hours_before IS NULL OR maximum_hours_before >= 0)
            AND (
                minimum_hours_before IS NULL
                OR maximum_hours_before IS NULL
                OR minimum_hours_before < maximum_hours_before
            )
        )
);

CREATE INDEX cancellation_policy_rules_policy_idx
    ON public.cancellation_policy_rules (policy_id);

COMMENT ON TABLE public.cancellation_policies IS
    'Versioned cancellation policy definitions. A booking stores the selected policy version and a rule snapshot.';

COMMENT ON TABLE public.cancellation_policy_rules IS
    'Refund percentages by cancellation initiator and hours-before-session window. Null bounds represent an open-ended window.';


-- Seed version 1 as inactive.
-- It is activated later, after the validation trigger is installed.
INSERT INTO public.cancellation_policies (
    id,
    policy_name,
    version_number,
    description,
    status,
    effective_from
)
VALUES (
    '00000000-0000-4000-8000-000000000011',
    'TRAINR Standard Cancellation Policy',
    1,
    'Initial versioned cancellation and refund policy.',
    'inactive',
    transaction_timestamp()
);


-- Initial policy values are seeded from the TRAINR Sprint 11A specification.
--
-- Gym-goer windows use explicit inclusivity:
--   More than 24 hours: (24, infinity)
--   12 to 24 hours:     [12, 24]
--   Less than 12 hours: [0, 12)
--   After session start: (-infinity, 0)
--
-- Trainer cancellation applies at all times.
INSERT INTO public.cancellation_policy_rules (
    policy_id,
    cancellation_initiator,
    window_key,
    minimum_hours_before,
    maximum_hours_before,
    minimum_inclusive,
    maximum_inclusive,
    refund_percentage
)
SELECT
    policy.id,
    rule.cancellation_initiator,
    rule.window_key,
    rule.minimum_hours_before,
    rule.maximum_hours_before,
    rule.minimum_inclusive,
    rule.maximum_inclusive,
    rule.refund_percentage
FROM public.cancellation_policies AS policy
CROSS JOIN (
    VALUES
        (
            'gym_goer'::text,
            'more_than_24_hours'::text,
            24::numeric,
            NULL::numeric,
            false,
            false,
            100::numeric
        ),
        (
            'gym_goer'::text,
            '12_to_24_hours'::text,
            12::numeric,
            24::numeric,
            true,
            true,
            50::numeric
        ),
        (
            'gym_goer'::text,
            'less_than_12_hours'::text,
            0::numeric,
            12::numeric,
            true,
            false,
            0::numeric
        ),
        (
            'gym_goer'::text,
            'after_session_start'::text,
            NULL::numeric,
            0::numeric,
            false,
            false,
            0::numeric
        ),
        (
            'trainer'::text,
            'any_time'::text,
            NULL::numeric,
            NULL::numeric,
            false,
            false,
            100::numeric
        )
) AS rule(
    cancellation_initiator,
    window_key,
    minimum_hours_before,
    maximum_hours_before,
    minimum_inclusive,
    maximum_inclusive,
    refund_percentage
)
WHERE policy.version_number = 1;


-- ---------------------------------------------------------------------------
-- 2. Booking-time policy snapshot
-- ---------------------------------------------------------------------------

ALTER TABLE public.trainer_bookings
    ADD COLUMN cancellation_policy_version_id uuid,
    ADD COLUMN cancellation_policy_snapshot jsonb;

ALTER TABLE public.trainer_bookings
    ADD CONSTRAINT trainer_bookings_cancellation_policy_version_fkey
    FOREIGN KEY (cancellation_policy_version_id)
    REFERENCES public.cancellation_policies(id)
    ON DELETE RESTRICT;

ALTER TABLE public.trainer_bookings
    ADD CONSTRAINT trainer_bookings_cancellation_policy_snapshot_check
    CHECK (
        (
            cancellation_policy_version_id IS NULL
            AND cancellation_policy_snapshot IS NULL
        )
        OR
        (
            cancellation_policy_version_id IS NOT NULL
            AND cancellation_policy_snapshot IS NOT NULL
            AND jsonb_typeof(cancellation_policy_snapshot) = 'object'
        )
    );

CREATE INDEX trainer_bookings_cancellation_policy_version_idx
    ON public.trainer_bookings (cancellation_policy_version_id)
    WHERE cancellation_policy_version_id IS NOT NULL;

COMMENT ON COLUMN public.trainer_bookings.cancellation_policy_version_id IS
    'Cancellation policy version selected when this booking was created; NULL for historical bookings.';

COMMENT ON COLUMN public.trainer_bookings.cancellation_policy_snapshot IS
    'Immutable booking-time JSON snapshot of the applicable cancellation policy rules; NULL for historical bookings.';


-- ---------------------------------------------------------------------------
-- 3. Cancellation history
-- ---------------------------------------------------------------------------

-- Required as the target of composite foreign keys below.
ALTER TABLE public.booking_payments
    ADD CONSTRAINT booking_payments_id_booking_unique
    UNIQUE (id, booking_id);

CREATE TABLE public.booking_cancellations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id uuid NOT NULL UNIQUE
        REFERENCES public.trainer_bookings(id) ON DELETE RESTRICT,
    cancelled_by uuid NOT NULL
        REFERENCES public.profiles(id) ON DELETE RESTRICT,
    cancelled_by_role text NOT NULL
        CHECK (cancelled_by_role IN ('gym_goer', 'trainer', 'admin')),
    cancellation_reason text NOT NULL,
    cancellation_comments text,
    cancellation_type text NOT NULL
        CHECK (
            cancellation_type IN (
                'gym_goer_initiated',
                'trainer_initiated',
                'admin_initiated'
            )
        ),
    policy_version_id uuid
        REFERENCES public.cancellation_policies(id) ON DELETE RESTRICT,
    policy_snapshot jsonb NOT NULL
        CHECK (jsonb_typeof(policy_snapshot) = 'object'),
    cancelled_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
    hours_before_session numeric(12, 4),
    refund_eligible boolean NOT NULL DEFAULT false,
    refund_percentage numeric(5, 2) NOT NULL DEFAULT 0
        CHECK (refund_percentage >= 0 AND refund_percentage <= 100),
    eligible_refund_amount numeric(20, 6) NOT NULL DEFAULT 0
        CHECK (eligible_refund_amount >= 0),
    currency text NOT NULL
        CHECK (currency ~ '^[A-Z]{3}$'),
    payment_id uuid,
    created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),

    CONSTRAINT booking_cancellations_id_booking_unique
        UNIQUE (id, booking_id),

    CONSTRAINT booking_cancellations_payment_booking_fkey
        FOREIGN KEY (payment_id, booking_id)
        REFERENCES public.booking_payments(id, booking_id)
        ON DELETE RESTRICT,

    CONSTRAINT booking_cancellations_actor_type_check
        CHECK (
            (
                cancelled_by_role = 'gym_goer'
                AND cancellation_type = 'gym_goer_initiated'
            )
            OR (
                cancelled_by_role = 'trainer'
                AND cancellation_type = 'trainer_initiated'
            )
            OR (
                cancelled_by_role = 'admin'
                AND cancellation_type = 'admin_initiated'
            )
        ),

    CONSTRAINT booking_cancellations_refund_consistency_check
        CHECK (
            (
                refund_eligible
                AND refund_percentage > 0
                AND eligible_refund_amount > 0
                AND payment_id IS NOT NULL
            )
            OR
            (
                NOT refund_eligible
                AND refund_percentage = 0
                AND eligible_refund_amount = 0
                AND payment_id IS NULL
            )
        )
);

CREATE INDEX booking_cancellations_cancelled_by_idx
    ON public.booking_cancellations (cancelled_by, cancelled_at DESC);

CREATE INDEX booking_cancellations_payment_id_idx
    ON public.booking_cancellations (payment_id)
    WHERE payment_id IS NOT NULL;

COMMENT ON TABLE public.booking_cancellations IS
    'Immutable cancellation history and server-calculated refund eligibility for a booking.';


-- ---------------------------------------------------------------------------
-- 4. Refund requests and audit history
-- ---------------------------------------------------------------------------

CREATE TABLE public.payment_refunds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cancellation_id uuid NOT NULL UNIQUE,
    booking_id uuid NOT NULL,
    payment_id uuid NOT NULL,
    initiated_by uuid NOT NULL
        REFERENCES public.profiles(id) ON DELETE RESTRICT,
    refund_reason text NOT NULL,
    original_amount numeric(20, 6) NOT NULL
        CHECK (original_amount > 0),
    refund_percentage numeric(5, 2) NOT NULL
        CHECK (refund_percentage > 0 AND refund_percentage <= 100),
    refund_amount numeric(20, 6) NOT NULL
        CHECK (refund_amount > 0 AND refund_amount <= original_amount),
    currency text NOT NULL
        CHECK (currency ~ '^[A-Z]{3}$'),
    refund_status text NOT NULL DEFAULT 'awaiting_review'
        CHECK (
            refund_status IN (
                'awaiting_review',
                'approved',
                'awaiting_integration',
                'processing',
                'completed',
                'failed',
                'rejected',
                'reversed'
            )
        ),
    provider text NOT NULL DEFAULT 'paystack'
        CHECK (provider = 'paystack'),
    provider_reference text UNIQUE,
    idempotency_key uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),

    CONSTRAINT payment_refunds_cancellation_booking_fkey
        FOREIGN KEY (cancellation_id, booking_id)
        REFERENCES public.booking_cancellations(id, booking_id)
        ON DELETE RESTRICT,

    CONSTRAINT payment_refunds_payment_booking_fkey
        FOREIGN KEY (payment_id, booking_id)
        REFERENCES public.booking_payments(id, booking_id)
        ON DELETE RESTRICT,

    CONSTRAINT payment_refunds_one_per_payment
        UNIQUE (payment_id)
);

CREATE INDEX payment_refunds_booking_id_idx
    ON public.payment_refunds (booking_id, created_at DESC);

CREATE INDEX payment_refunds_payment_id_idx
    ON public.payment_refunds (payment_id);

CREATE INDEX payment_refunds_status_idx
    ON public.payment_refunds (refund_status, created_at);

COMMENT ON TABLE public.payment_refunds IS
    'Trainer/Admin-controlled refund requests linked to the original booking payment. Provider execution is a separate integration.';


CREATE TABLE public.refund_audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    refund_id uuid NOT NULL
        REFERENCES public.payment_refunds(id) ON DELETE RESTRICT,
    actor_id uuid
        REFERENCES public.profiles(id) ON DELETE RESTRICT,
    action text NOT NULL,
    previous_status text,
    new_status text,
    remarks text,
    created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),

    CONSTRAINT refund_audit_logs_metadata_check
        CHECK (
            previous_status IS NULL
            OR previous_status IN (
                'awaiting_review',
                'approved',
                'awaiting_integration',
                'processing',
                'completed',
                'failed',
                'rejected',
                'reversed'
            )
        ),

    CONSTRAINT refund_audit_logs_new_status_check
        CHECK (
            new_status IS NULL
            OR new_status IN (
                'awaiting_review',
                'approved',
                'awaiting_integration',
                'processing',
                'completed',
                'failed',
                'rejected',
                'reversed'
            )
        )
);

CREATE INDEX refund_audit_logs_refund_id_idx
    ON public.refund_audit_logs (refund_id, created_at);

COMMENT ON TABLE public.refund_audit_logs IS
    'Append-only audit history for refund review, approval, provider processing and outcome changes.';


-- ---------------------------------------------------------------------------
-- 5. Integrity and append-only protections
-- ---------------------------------------------------------------------------

-- Policy rules cannot be changed after their policy version is published.
-- Parent policy rows are locked in a consistent order to prevent concurrent
-- rule mutations and policy activation from bypassing these protections.
CREATE OR REPLACE FUNCTION public.guard_published_cancellation_policy_rules()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
    v_old_policy_id uuid;
    v_new_policy_id uuid;
    v_policy_id uuid;
    v_old_policy_status text;
    v_new_policy_status text;
    v_new_range numrange;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        v_old_policy_id := OLD.policy_id;
    END IF;

    IF TG_OP <> 'DELETE' THEN
        v_new_policy_id := NEW.policy_id;
    END IF;

    -- Lock affected policies in deterministic order.
    FOR v_policy_id IN
        SELECT policy.id
        FROM public.cancellation_policies AS policy
        WHERE policy.id IN (v_old_policy_id, v_new_policy_id)
        ORDER BY policy.id
        FOR UPDATE
    LOOP
        NULL;
    END LOOP;

    -- New or updated rules cannot belong to an active policy.
    IF v_new_policy_id IS NOT NULL THEN
        SELECT policy.status
        INTO v_new_policy_status
        FROM public.cancellation_policies AS policy
        WHERE policy.id = v_new_policy_id;

        IF v_new_policy_status = 'active' THEN
            RAISE EXCEPTION
                'Rules belonging to an active cancellation policy are immutable.'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    -- Existing rules cannot be deleted or moved out of an active policy.
    IF v_old_policy_id IS NOT NULL
       AND v_old_policy_id IS DISTINCT FROM v_new_policy_id THEN

        SELECT policy.status
        INTO v_old_policy_status
        FROM public.cancellation_policies AS policy
        WHERE policy.id = v_old_policy_id;

        IF v_old_policy_status = 'active' THEN
            RAISE EXCEPTION
                'Rules cannot be moved out of an active cancellation policy.'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    -- Prevent overlapping time windows for the same initiator and policy.
    IF TG_OP <> 'DELETE' THEN
        v_new_range := pg_catalog.numrange(
            NEW.minimum_hours_before,
            NEW.maximum_hours_before,
            (CASE WHEN NEW.minimum_inclusive THEN '[' ELSE '(' END)
            || (CASE WHEN NEW.maximum_inclusive THEN ']' ELSE ')' END)
        );

        IF EXISTS (
            SELECT 1
            FROM public.cancellation_policy_rules AS existing
            WHERE existing.policy_id = NEW.policy_id
              AND existing.cancellation_initiator = NEW.cancellation_initiator
              AND existing.id IS DISTINCT FROM NEW.id
              AND pg_catalog.numrange(
                    existing.minimum_hours_before,
                    existing.maximum_hours_before,
                    (CASE WHEN existing.minimum_inclusive THEN '[' ELSE '(' END)
                    || (CASE WHEN existing.maximum_inclusive THEN ']' ELSE ')' END)
                  ) && v_new_range
        ) THEN
            RAISE EXCEPTION
                'Cancellation policy rule windows cannot overlap.'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$function$;

ALTER FUNCTION public.guard_published_cancellation_policy_rules()
OWNER TO postgres;

REVOKE ALL ON FUNCTION public.guard_published_cancellation_policy_rules()
FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER cancellation_policy_rules_guard
BEFORE INSERT OR UPDATE OR DELETE
ON public.cancellation_policy_rules
FOR EACH ROW
EXECUTE FUNCTION public.guard_published_cancellation_policy_rules();


-- Once a policy is active, its identity and descriptive definition cannot be
-- rewritten. It may remain active or be retired, but cannot be deactivated.
CREATE OR REPLACE FUNCTION public.guard_active_cancellation_policy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
    IF OLD.status = 'active' THEN
        IF NEW.status = 'inactive' THEN
            RAISE EXCEPTION
                'An active cancellation policy cannot be deactivated. Retire it instead.'
                USING ERRCODE = '23514';
        END IF;

        IF NEW.policy_name IS DISTINCT FROM OLD.policy_name
           OR NEW.version_number IS DISTINCT FROM OLD.version_number
           OR NEW.description IS DISTINCT FROM OLD.description
           OR NEW.effective_from IS DISTINCT FROM OLD.effective_from THEN
            RAISE EXCEPTION
                'An active cancellation policy definition is immutable.'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

ALTER FUNCTION public.guard_active_cancellation_policy()
OWNER TO postgres;

REVOKE ALL ON FUNCTION public.guard_active_cancellation_policy()
FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER cancellation_policies_guard_active
BEFORE UPDATE ON public.cancellation_policies
FOR EACH ROW
EXECUTE FUNCTION public.guard_active_cancellation_policy();


-- A policy must contain all required cancellation categories before it
-- becomes active. Refund percentages and time thresholds remain configurable.
CREATE OR REPLACE FUNCTION public.validate_cancellation_policy_activation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
    v_missing_rule_count integer;
BEGIN
    IF NEW.status <> 'active' THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.status = 'active' THEN
            RETURN NEW;
        END IF;
    END IF;

    SELECT COUNT(*)
    INTO v_missing_rule_count
    FROM (
        VALUES
            ('gym_goer'::text, 'more_than_24_hours'::text),
            ('gym_goer'::text, '12_to_24_hours'::text),
            ('gym_goer'::text, 'less_than_12_hours'::text),
            ('gym_goer'::text, 'after_session_start'::text),
            ('trainer'::text, 'any_time'::text)
    ) AS required_rules(initiator, window_key)
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.cancellation_policy_rules AS rule
        WHERE rule.policy_id = NEW.id
          AND rule.cancellation_initiator = required_rules.initiator
          AND rule.window_key = required_rules.window_key
    );

    IF v_missing_rule_count > 0 THEN
        RAISE EXCEPTION
            'Cancellation policy cannot be activated: % required rule categories are missing.',
            v_missing_rule_count
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$function$;

ALTER FUNCTION public.validate_cancellation_policy_activation()
OWNER TO postgres;

REVOKE ALL ON FUNCTION public.validate_cancellation_policy_activation()
FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER cancellation_policies_validate_activation_insert
BEFORE INSERT
ON public.cancellation_policies
FOR EACH ROW
EXECUTE FUNCTION public.validate_cancellation_policy_activation();

CREATE TRIGGER cancellation_policies_validate_activation_update
BEFORE UPDATE OF status
ON public.cancellation_policies
FOR EACH ROW
EXECUTE FUNCTION public.validate_cancellation_policy_activation();


-- Publish version 1 only after all five rules have been seeded and the
-- activation-validation trigger has been installed.
UPDATE public.cancellation_policies
SET status = 'active',
    updated_at = transaction_timestamp()
WHERE version_number = 1
  AND status = 'inactive';


-- Booking-time policy snapshots cannot be modified after creation.
CREATE OR REPLACE FUNCTION public.protect_booking_cancellation_policy_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
    IF NEW.cancellation_policy_version_id
           IS DISTINCT FROM OLD.cancellation_policy_version_id
       OR NEW.cancellation_policy_snapshot
           IS DISTINCT FROM OLD.cancellation_policy_snapshot THEN

        RAISE EXCEPTION
            'Booking cancellation policy snapshots are immutable.'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$function$;

ALTER FUNCTION public.protect_booking_cancellation_policy_snapshot()
OWNER TO postgres;

REVOKE ALL ON FUNCTION public.protect_booking_cancellation_policy_snapshot()
FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER trainer_bookings_cancellation_policy_snapshot_immutable
BEFORE UPDATE OF cancellation_policy_version_id, cancellation_policy_snapshot
ON public.trainer_bookings
FOR EACH ROW
EXECUTE FUNCTION public.protect_booking_cancellation_policy_snapshot();


-- Cancellation and audit rows are append-only. Corrections require a separate
-- audited administrative process rather than rewriting financial history.
CREATE OR REPLACE FUNCTION public.reject_financial_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
    RAISE EXCEPTION
        '% is append-only; UPDATE and DELETE are not permitted.',
        TG_TABLE_NAME
        USING ERRCODE = '23514';
END;
$function$;

ALTER FUNCTION public.reject_financial_history_mutation()
OWNER TO postgres;

REVOKE ALL ON FUNCTION public.reject_financial_history_mutation()
FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER booking_cancellations_append_only
BEFORE UPDATE OR DELETE ON public.booking_cancellations
FOR EACH ROW
EXECUTE FUNCTION public.reject_financial_history_mutation();

CREATE TRIGGER refund_audit_logs_append_only
BEFORE UPDATE OR DELETE ON public.refund_audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.reject_financial_history_mutation();


-- Validate refund values against the cancellation and original successful
-- payment at the database boundary, even for trusted service-role inserts.
CREATE OR REPLACE FUNCTION public.validate_payment_refund_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_cancellation public.booking_cancellations%ROWTYPE;
    v_payment public.booking_payments%ROWTYPE;
BEGIN
    IF NEW.refund_status <> 'awaiting_review'
       OR NEW.provider_reference IS NOT NULL THEN

        RAISE EXCEPTION
            'New refund requests must begin in awaiting_review without a provider reference.'
            USING ERRCODE = '23514';
    END IF;

    SELECT cancellation.*
    INTO v_cancellation
    FROM public.booking_cancellations AS cancellation
    WHERE cancellation.id = NEW.cancellation_id
      AND cancellation.booking_id = NEW.booking_id;

    IF NOT FOUND OR NOT v_cancellation.refund_eligible THEN
        RAISE EXCEPTION
            'A refund must reference an eligible cancellation for the same booking.'
            USING ERRCODE = '23514';
    END IF;

    SELECT payment.*
    INTO v_payment
    FROM public.booking_payments AS payment
    WHERE payment.id = NEW.payment_id
      AND payment.booking_id = NEW.booking_id
    FOR UPDATE;

    IF NOT FOUND
       OR v_payment.status <> 'successful'
       OR v_payment.superseded_by IS NOT NULL THEN

        RAISE EXCEPTION
            'A refund must reference the original successful, non-superseded payment.'
            USING ERRCODE = '23514';
    END IF;

    IF NEW.original_amount IS DISTINCT FROM v_payment.amount
       OR NEW.currency IS DISTINCT FROM v_payment.currency
       OR NEW.provider IS DISTINCT FROM v_payment.provider
       OR NEW.refund_percentage IS DISTINCT FROM v_cancellation.refund_percentage
       OR NEW.refund_amount IS DISTINCT FROM v_cancellation.eligible_refund_amount
       OR v_cancellation.payment_id IS DISTINCT FROM v_payment.id
       OR v_cancellation.currency IS DISTINCT FROM v_payment.currency THEN

        RAISE EXCEPTION
            'Refund amount, percentage, currency and provider must match the cancellation and original payment.'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$function$;

ALTER FUNCTION public.validate_payment_refund_insert()
OWNER TO postgres;

REVOKE ALL ON FUNCTION public.validate_payment_refund_insert()
FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER payment_refunds_validate_insert
BEFORE INSERT ON public.payment_refunds
FOR EACH ROW
EXECUTE FUNCTION public.validate_payment_refund_insert();


-- Enforce refund status transitions and append an audit row atomically.
CREATE OR REPLACE FUNCTION public.enforce_payment_refund_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_allowed boolean := false;
BEGIN
    IF NEW.cancellation_id IS DISTINCT FROM OLD.cancellation_id
       OR NEW.booking_id IS DISTINCT FROM OLD.booking_id
       OR NEW.payment_id IS DISTINCT FROM OLD.payment_id
       OR NEW.initiated_by IS DISTINCT FROM OLD.initiated_by
       OR NEW.refund_reason IS DISTINCT FROM OLD.refund_reason
       OR NEW.original_amount IS DISTINCT FROM OLD.original_amount
       OR NEW.refund_percentage IS DISTINCT FROM OLD.refund_percentage
       OR NEW.refund_amount IS DISTINCT FROM OLD.refund_amount
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.provider IS DISTINCT FROM OLD.provider
       OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key THEN

        RAISE EXCEPTION
            'Refund financial identity and amount fields are immutable.'
            USING ERRCODE = '23514';
    END IF;

    IF NEW.refund_status IS NOT DISTINCT FROM OLD.refund_status THEN
        RETURN NEW;
    END IF;

    v_allowed := CASE OLD.refund_status
        WHEN 'awaiting_review'
            THEN NEW.refund_status IN ('approved', 'rejected')
        WHEN 'approved'
            THEN NEW.refund_status = 'awaiting_integration'
        WHEN 'awaiting_integration'
            THEN NEW.refund_status = 'processing'
        WHEN 'processing'
            THEN NEW.refund_status IN ('completed', 'failed')
        WHEN 'failed'
            THEN NEW.refund_status = 'awaiting_integration'
        WHEN 'completed'
            THEN NEW.refund_status = 'reversed'
        ELSE false
    END;

    IF NOT v_allowed THEN
        RAISE EXCEPTION
            'Invalid refund status transition: % -> %.',
            OLD.refund_status,
            NEW.refund_status
            USING ERRCODE = '23514';
    END IF;

    NEW.updated_at := pg_catalog.statement_timestamp();

    INSERT INTO public.refund_audit_logs (
        refund_id,
        actor_id,
        action,
        previous_status,
        new_status,
        remarks
    )
    VALUES (
        OLD.id,
        auth.uid(),
        'refund_status_changed',
        OLD.refund_status,
        NEW.refund_status,
        'Status transition recorded by database trigger.'
    );

    RETURN NEW;
END;
$function$;

ALTER FUNCTION public.enforce_payment_refund_status_transition()
OWNER TO postgres;

REVOKE ALL ON FUNCTION public.enforce_payment_refund_status_transition()
FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER payment_refunds_status_transition
BEFORE UPDATE ON public.payment_refunds
FOR EACH ROW
EXECUTE FUNCTION public.enforce_payment_refund_status_transition();


-- ---------------------------------------------------------------------------
-- 6. Access control
-- ---------------------------------------------------------------------------

ALTER TABLE public.cancellation_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cancellation_policy_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_cancellations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_audit_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
    public.cancellation_policies,
    public.cancellation_policy_rules,
    public.booking_cancellations,
    public.payment_refunds,
    public.refund_audit_logs
FROM PUBLIC, anon, authenticated, service_role;


-- Clients may read the active policy and its rules, but cannot mutate policy
-- versions or any cancellation/refund financial record directly.
GRANT SELECT ON TABLE
    public.cancellation_policies,
    public.cancellation_policy_rules
TO authenticated;

CREATE POLICY cancellation_policies_read_active
ON public.cancellation_policies
FOR SELECT
TO authenticated
USING (
    status = 'active'
    AND effective_from <= transaction_timestamp()
    AND (
        effective_until IS NULL
        OR effective_until > transaction_timestamp()
    )
);

CREATE POLICY cancellation_policy_rules_read_active
ON public.cancellation_policy_rules
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.cancellation_policies AS policy
        WHERE policy.id = cancellation_policy_rules.policy_id
          AND policy.status = 'active'
          AND policy.effective_from <= transaction_timestamp()
          AND (
              policy.effective_until IS NULL
              OR policy.effective_until > transaction_timestamp()
          )
    )
);


-- Participants may read cancellation and refund history for their own booking.
-- Writes are reserved for trusted SECURITY DEFINER RPCs owned by postgres.
GRANT SELECT ON TABLE
    public.booking_cancellations,
    public.payment_refunds
TO authenticated;

CREATE POLICY booking_cancellations_read_participant
ON public.booking_cancellations
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.trainer_bookings AS booking
        WHERE booking.id = booking_cancellations.booking_id
          AND auth.uid() IN (
              booking.gym_goer_id,
              booking.trainer_id
          )
    )
);

CREATE POLICY payment_refunds_read_participant
ON public.payment_refunds
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.trainer_bookings AS booking
        WHERE booking.id = payment_refunds.booking_id
          AND auth.uid() IN (
              booking.gym_goer_id,
              booking.trainer_id
          )
    )
);


-- Audit logs are not exposed directly to clients. Trusted backend functions
-- can read/write them under the postgres owner; service_role is granted access
-- for controlled backend operations only.
GRANT ALL ON TABLE
    public.cancellation_policies,
    public.cancellation_policy_rules,
    public.booking_cancellations,
    public.payment_refunds,
    public.refund_audit_logs
TO service_role;


-- Close the old booking/cancellation entry points during the short
-- schema-to-RPC migration interval. Migration 5 restores the secure RPCs.
REVOKE ALL ON FUNCTION
    public.create_trainer_booking(uuid, timestamptz, uuid, text)
FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION
    public.cancel_trainer_booking(uuid)
FROM PUBLIC, anon, authenticated, service_role;

REVOKE UPDATE (status)
ON TABLE public.trainer_bookings
FROM PUBLIC, anon, authenticated;

COMMIT;
