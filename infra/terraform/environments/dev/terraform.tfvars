environment = "dev"
aws_region  = "us-east-1"

vpc_cidr        = "10.10.0.0/16"
public_subnets  = { a = { cidr = "10.10.1.0/24", az = "us-east-1a" }, b = { cidr = "10.10.2.0/24", az = "us-east-1b" } }
private_subnets = { a = { cidr = "10.10.11.0/24", az = "us-east-1a" }, b = { cidr = "10.10.12.0/24", az = "us-east-1b" } }

queues = {
  files         = {}
  slides        = {}
  notifications = {}
}

schedules = { daily_maintenance = "cron(0 3 * * ? *)" }

# Filled in after first apply + image push
api_image = "811783768235.dkr.ecr.us-east-1.amazonaws.com/studyforge-dev-api:latest"
web_image = "811783768235.dkr.ecr.us-east-1.amazonaws.com/studyforge-dev-web:latest"

db_username       = "studyforge"
db_password       = "replace-me"
db_name           = "studyforge"
db_instance_class = "db.t4g.micro"

secret_values = {
  # DATABASE_URL is computed automatically from RDS output in main.tf
  SECRET_KEY           = "replace-me"
  CLERK_SECRET_KEY     = ""
  CLERK_WEBHOOK_SECRET = ""
  STRIPE_SECRET_KEY    = ""
  STRIPE_WEBHOOK_SECRET             = ""
  STRIPE_PERSONAL_MONTHLY_PRICE_ID  = ""
  STRIPE_PERSONAL_ANNUAL_PRICE_ID   = ""
  SENDGRID_API_KEY   = ""
  TWILIO_ACCOUNT_SID = ""
  TWILIO_AUTH_TOKEN  = ""
}

ssm_parameters = {}

cicd_principal_arn = "arn:aws:iam::811783768235:root"
