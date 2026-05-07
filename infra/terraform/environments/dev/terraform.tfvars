environment = "dev"
vpc_cidr = "10.10.0.0/16"
public_subnets = { a = { cidr = "10.10.1.0/24", az = "us-east-1a" }, b = { cidr = "10.10.2.0/24", az = "us-east-1b" } }
private_subnets = { a = { cidr = "10.10.11.0/24", az = "us-east-1a" }, b = { cidr = "10.10.12.0/24", az = "us-east-1b" } }
queues = { ingest = {}, notifications = {} }
schedules = { daily_maintenance = "cron(0 3 * * ? *)" }
api_image = "ghcr.io/example/studyforge-api:latest"
db_username = "studyforge"
db_password = "replace-me"
secret_values = { DATABASE_URL = "replace-me", JWT_SECRET = "replace-me" }
ssm_parameters = { OPENAI_API_KEY = "replace-me" }

cicd_principal_arn = "arn:aws:iam::123456789012:root"
