# AWS Ops Runbook

## Incident triage
1. Confirm alarm source in CloudWatch (API 5xx, Lambda errors/throttles, RDS CPU/storage, SQS queue depth/DLQ).
2. Check recent deploys in CI/CD and ECS service events.
3. Review API logs (`/studyforge/<env>/api`) and Lambda logs for stack traces.
4. If queues back up, inspect DLQ payloads and correlate with worker failures.
5. Validate dependencies: RDS health, secrets retrieval, and S3 access permissions.

## Immediate containment
- Scale ECS API tasks up if API saturation is detected.
- Increase Lambda reserved concurrency temporarily if throttling is sustained.
- Pause upstream producers if SQS backlog is causing cascading failures.
- Apply temporary feature-flag or route-level mitigation to reduce 5xx spikes.

## Rollback basics
1. Identify last known good image tag from deployment history.
2. Update ECS service to previous task definition revision.
3. Re-run smoke checks for auth, core API routes, queue processing.
4. Keep alarm watch for 30 minutes after rollback.

## Post-incident
- Create incident timeline with UTC timestamps.
- Add permanent fix ticket and alarm threshold tuning tasks.
- Record customer impact and comms follow-up.
