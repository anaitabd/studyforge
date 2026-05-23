Set up automated database backups with point-in-time recovery for PostgreSQL.

For GCP Cloud SQL:
1. Enable automated backups in Terraform (google_sql_database_instance resource):
   ```hcl
   backup_configuration {
     enabled                        = true
     start_time                     = "02:00"
     point_in_time_recovery_enabled = true
     transaction_log_retention_days = 7
     backup_retention_settings {
       retained_backups = 30
     }
   }
   ```

2. Add a scheduled export job (Cloud Scheduler → Cloud Run Job):
   - Daily at 03:00 UTC: pg_dump → gzip → upload to GCS bucket studyforge-backups
   - Keep 90 days of dumps in GCS with lifecycle policy
   - Script: scripts/backup_db.sh

3. ChromaDB backup:
   - tar.gz the ChromaDB data directory → upload to same GCS backup bucket
   - Add to the same daily export job

4. Document restore procedure in docs/RESTORE.md:
   - PITR restore (last known good time)
   - Full dump restore from GCS
   - Test restore to staging instance (do this monthly)

5. For local dev (docker-compose), add scripts/backup_local_db.sh:
   - Runs pg_dump inside postgres container
   - Saves to ./backups/YYYY-MM-DD.sql.gz

6. Add GCP alert: fire if backup has not run in the last 25 hours → send to ops email

Show complete Terraform config, backup script, restore documentation, and GCP alert setup.
