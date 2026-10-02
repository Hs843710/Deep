-- Harden PIOS public-source ingestion jobs.
-- The secret value is never stored here; cron reads it at execution time from system_secrets.
-- Jobs 1,2,3,4,5,8 must send x-pios-cron-token and the corresponding Edge Functions
-- must verify it against the scheduled_intelligence secret before using service-role writes.
select jobid,jobname,schedule,active
from cron.job
where jobid in (1,2,3,4,5,8);
