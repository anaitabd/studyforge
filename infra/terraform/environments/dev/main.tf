terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

locals {
  name = "studyforge-${var.environment}"
  tags = { Environment = var.environment, Project = "studyforge" }

  queue_names     = [for k in keys(var.queues) : "${local.name}-${k}"]
  dlq_queue_names = [for k in keys(var.queues) : "${local.name}-${k}-dlq"]

  secret_arn = module.secrets.secret_arn

  # ECS secret references: Secrets Manager JSON key extraction syntax
  # "arn:...:secret-name:JSON_KEY::" — ECS pulls just that key's value
  api_secrets = {
    DATABASE_URL         = "${local.secret_arn}:DATABASE_URL::"
    SECRET_KEY           = "${local.secret_arn}:SECRET_KEY::"
    CLERK_SECRET_KEY     = "${local.secret_arn}:CLERK_SECRET_KEY::"
    CLERK_WEBHOOK_SECRET = "${local.secret_arn}:CLERK_WEBHOOK_SECRET::"
    STRIPE_SECRET_KEY    = "${local.secret_arn}:STRIPE_SECRET_KEY::"
    SENDGRID_API_KEY     = "${local.secret_arn}:SENDGRID_API_KEY::"
    TWILIO_ACCOUNT_SID   = "${local.secret_arn}:TWILIO_ACCOUNT_SID::"
    TWILIO_AUTH_TOKEN    = "${local.secret_arn}:TWILIO_AUTH_TOKEN::"
  }
  web_secrets = {
    CLERK_SECRET_KEY = "${local.secret_arn}:CLERK_SECRET_KEY::"
  }

  chroma_host = "chroma.${local.name}.local"

  api_env_vars = [
    { name = "APP_ENV",                          value = var.environment },
    { name = "AWS_REGION",                       value = var.aws_region },
    { name = "AI_PROVIDER",                      value = "bedrock" },
    { name = "BEDROCK_CHAT_MODEL_ID",            value = "us.anthropic.claude-sonnet-4-5-20250929-v1:0" },
    { name = "BEDROCK_EMBED_MODEL_ID",           value = "amazon.titan-embed-text-v2:0" },
    { name = "REDIS_URL",                        value = module.elasticache.redis_url },
    { name = "S3_BUCKET",                        value = module.s3.uploads_bucket },
    { name = "S3_REGION",                        value = var.aws_region },
    { name = "S3_USE_AWS_MANAGED_CREDENTIALS",   value = "true" },
    { name = "CHROMA_HOST",                      value = local.chroma_host },
    { name = "CHROMA_PORT",                      value = "8000" },
    { name = "FRONTEND_URL",                     value = "http://${module.alb.alb_dns_name}" },
    { name = "FRONTEND_URLS",                    value = "http://${module.alb.alb_dns_name}" },
    { name = "TASK_EXECUTION_MODE",              value = "celery" },
    { name = "TASK_SQS_FILE_QUEUE_URL",          value = module.sqs.queue_urls["files"] },
    { name = "TASK_SQS_SLIDE_QUEUE_URL",         value = module.sqs.queue_urls["slides"] },
    { name = "TASK_SQS_NOTIFICATION_QUEUE_URL",  value = module.sqs.queue_urls["notifications"] },
    { name = "TWILIO_WHATSAPP_FROM",             value = "whatsapp:+14155238886" },
  ]
}

# ---------------------------------------------------------------------------
# Core infrastructure
# ---------------------------------------------------------------------------
module "network" {
  source          = "../../modules/network"
  name            = local.name
  vpc_cidr        = var.vpc_cidr
  public_subnets  = var.public_subnets
  private_subnets = var.private_subnets
  tags            = local.tags
}

module "security" {
  source   = "../../modules/security"
  name     = local.name
  vpc_id   = module.network.vpc_id
  api_port = var.api_port
}

module "ecr" {
  source = "../../modules/ecr"
  name   = local.name
}

module "s3" {
  source = "../../modules/s3"
  name   = local.name
}

module "sqs" {
  source = "../../modules/sqs"
  name   = local.name
  queues = var.queues
}

module "eventbridge" {
  source    = "../../modules/eventbridge"
  name      = local.name
  schedules = var.schedules
}

module "rds" {
  source         = "../../modules/rds"
  name           = local.name
  subnet_ids     = module.network.private_subnet_ids
  db_sg_id       = module.security.db_sg_id
  username       = var.db_username
  password       = var.db_password
  db_name        = var.db_name
  instance_class = var.db_instance_class
}

module "elasticache" {
  source         = "../../modules/elasticache"
  name           = local.name
  vpc_id         = module.network.vpc_id
  subnet_ids     = module.network.private_subnet_ids
  allowed_sg_ids = [module.security.api_sg_id]
}

module "secrets" {
  source = "../../modules/secrets"
  name   = local.name
  # DATABASE_URL is computed from RDS output — always in sync with the actual endpoint
  secret_values = merge(var.secret_values, {
    DATABASE_URL = "postgresql+asyncpg://${var.db_username}:${var.db_password}@${module.rds.endpoint}/${var.db_name}"
  })
  ssm_parameters = var.ssm_parameters
}

module "alb" {
  source            = "../../modules/alb"
  name              = local.name
  vpc_id            = module.network.vpc_id
  public_subnet_ids = module.network.public_subnet_ids
  api_sg_id         = module.security.api_sg_id
}

# ---------------------------------------------------------------------------
# IAM — app role with S3, SQS, Bedrock, Secrets Manager permissions
# ---------------------------------------------------------------------------
module "iam" {
  source             = "../../modules/iam"
  name               = local.name
  cicd_principal_arn = var.cicd_principal_arn

  api_policy_json = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:HeadObject"]
        Resource = ["${module.s3.assets_arn}/*", "${module.s3.uploads_arn}/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = [module.s3.assets_arn, module.s3.uploads_arn]
      },
      {
        Effect   = "Allow"
        Action   = ["sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
        Resource = values(module.sqs.queue_arns)
      },
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = [module.secrets.secret_arn]
      },
      {
        Effect   = "Allow"
        Action   = ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"]
        Resource = ["arn:aws:ssm:${var.aws_region}:*:parameter/${local.name}/*"]
      },
      {
        Effect = "Allow"
        Action = ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"]
        Resource = [
          "arn:aws:bedrock:${var.aws_region}::foundation-model/anthropic.claude-sonnet-4-5-20250929-v1:0",
          "arn:aws:bedrock:*::foundation-model/anthropic.claude-sonnet-4-5-20250929-v1:0",
          "arn:aws:bedrock:${var.aws_region}:${var.aws_account_id}:inference-profile/us.anthropic.claude-sonnet-4-5-20250929-v1:0",
          "arn:aws:bedrock:${var.aws_region}::foundation-model/amazon.titan-embed-text-v2:0"
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = ["*"]
      }
    ]
  })

  lambda_policy_json = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = ["*"]
      },
      {
        Effect   = "Allow"
        Action   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
        Resource = values(module.sqs.queue_arns)
      },
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = [module.secrets.secret_arn]
      }
    ]
  })

  cicd_policy_json = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecs:DescribeServices", "ecs:UpdateService",
          "ecs:RegisterTaskDefinition", "ecs:DescribeTaskDefinition"
        ]
        Resource = ["*"]
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken", "ecr:BatchGetImage",
          "ecr:BatchCheckLayerAvailability", "ecr:PutImage",
          "ecr:InitiateLayerUpload", "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload", "ecr:GetDownloadUrlForLayer"
        ]
        Resource = ["*"]
      },
      {
        Effect   = "Allow"
        Action   = ["iam:PassRole"]
        Resource = ["arn:aws:iam::*:role/${local.name}-api-role", "arn:aws:iam::*:role/${local.name}-lambda-role"]
      }
    ]
  })
}

# ---------------------------------------------------------------------------
# Observability
# ---------------------------------------------------------------------------
module "observability" {
  source                      = "../../modules/observability"
  name                        = local.name
  api_target_group_arn_suffix = module.alb.api_tg_arn_suffix
  lambda_function_names       = ["${local.name}-worker"]
  rds_instance_id             = "${local.name}-postgres"
  sqs_queue_names             = local.queue_names
  dlq_queue_names             = local.dlq_queue_names
}

# ---------------------------------------------------------------------------
# ECS — API, Celery worker, Celery beat, ChromaDB, Web
# ---------------------------------------------------------------------------
module "ecs_api" {
  source = "../../modules/ecs_api"

  name               = local.name
  region             = var.aws_region
  image              = var.api_image
  web_image          = var.web_image
  task_role_arn      = module.iam.api_role_arn
  private_subnet_ids = module.network.private_subnet_ids
  vpc_id             = module.network.vpc_id
  api_sg_id          = module.security.api_sg_id
  log_group_name     = "/studyforge/${local.name}/api"

  secrets     = local.api_secrets
  web_secrets = local.web_secrets

  environment_vars = local.api_env_vars
  web_environment_vars = [
    { name = "NEXT_PUBLIC_API_URL",                 value = "http://${module.alb.alb_dns_name}" },
    { name = "NEXT_PUBLIC_CLERK_SIGN_IN_URL",       value = "/sign-in" },
    { name = "NEXT_PUBLIC_CLERK_SIGN_UP_URL",       value = "/sign-up" },
    { name = "NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL", value = "/dashboard" },
    { name = "NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL", value = "/dashboard" },
  ]

  api_target_group_arn = module.alb.api_target_group_arn
  web_target_group_arn = module.alb.web_target_group_arn
}
