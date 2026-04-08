-- Remove legacy demo rows that were inserted by the old seed scripts.
-- These records used fixed ids and could appear inside real user accounts.

DELETE FROM approval_audit
WHERE review_id IN ('rv1', 'rv2', 'rv3', 'rv4', 'rv5', 'rv6');

DELETE FROM pending_reviews
WHERE id IN ('rv1', 'rv2', 'rv3', 'rv4', 'rv5', 'rv6');

DELETE FROM activity_log
WHERE agent_id IN ('a1', 'a2', 'a3', 'a4', 'a5', 'a6');

DELETE FROM tasks
WHERE id IN ('t1', 't2', 't3', 't4', 't5')
   OR agent_id IN ('a1', 'a2', 'a3', 'a4', 'a5', 'a6');

DELETE FROM agents
WHERE id IN ('a1', 'a2', 'a3', 'a4', 'a5', 'a6');
