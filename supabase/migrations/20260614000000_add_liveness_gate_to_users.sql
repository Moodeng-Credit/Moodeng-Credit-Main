-- Liveness pre-gate state for the shared verification flow (runs before both World ID and
-- Didit ID verification). Distinct from is_world_id / is_didit, which are the final
-- "verified" flags. liveness_status tracks the most recent liveness attempt so the frontend
-- can resume after the Didit redirect; liveness_session_id pins it to that attempt.
--
--   liveness_status: 'PENDING' | 'APPROVED' | 'DUPLICATE' | 'DECLINED' | null
alter table users add column if not exists liveness_status text;
alter table users add column if not exists liveness_session_id text;
