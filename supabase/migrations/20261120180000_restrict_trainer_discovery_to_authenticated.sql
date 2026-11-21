BEGIN;

-- Remove anonymous and inherited public execution access.
REVOKE EXECUTE
ON FUNCTION public.discover_published_trainers()
FROM PUBLIC, anon;

-- Preserve access for authenticated users and trusted backend operations.
GRANT EXECUTE
ON FUNCTION public.discover_published_trainers()
TO authenticated, service_role;

COMMIT;
