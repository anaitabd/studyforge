terraform {
  required_version = ">= 1.5.0"
  required_providers { aws = { source = "hashicorp/aws" version = "~> 5.0" } }
}
provider "aws" { region = var.aws_region }

locals {
  name = "studyforge-${var.environment}"
  tags = { Environment = var.environment Project = "studyforge" }
  queue_names     = [for k in keys(var.queues) : "${local.name}-${k}"]
  dlq_queue_names = [for k in keys(var.queues) : "${local.name}-${k}-dlq"]
}

module "network" { source = "../../modules/network" name = local.name vpc_cidr = var.vpc_cidr public_subnets = var.public_subnets private_subnets = var.private_subnets tags = local.tags }
module "security" { source = "../../modules/security" name = local.name vpc_id = module.network.vpc_id api_port = var.api_port }
module "s3" { source = "../../modules/s3" name = local.name }
module "sqs" { source = "../../modules/sqs" name = local.name queues = var.queues }
module "eventbridge" { source = "../../modules/eventbridge" name = local.name schedules = var.schedules }
module "iam" {
  source = "../../modules/iam"
  name   = local.name
  cicd_principal_arn = var.cicd_principal_arn
  api_policy_json = jsonencode({Version="2012-10-17",Statement=[
    {Effect="Allow",Action=["s3:GetObject","s3:PutObject"],Resource=["${module.s3.assets_arn}/*","${module.s3.uploads_arn}/*"]},
    {Effect="Allow",Action=["sqs:SendMessage","sqs:ReceiveMessage","sqs:DeleteMessage","sqs:GetQueueAttributes"],Resource=values(module.sqs.queue_arns)},
    {Effect="Allow",Action=["secretsmanager:GetSecretValue","ssm:GetParameter"],Resource=[module.secrets.secret_arn,"arn:aws:ssm:${var.aws_region}:*:parameter/${local.name}/*"]}
  ]})
  lambda_policy_json = jsonencode({Version="2012-10-17",Statement=[
    {Effect="Allow",Action=["logs:CreateLogGroup","logs:CreateLogStream","logs:PutLogEvents"],Resource=["*"]},
    {Effect="Allow",Action=["sqs:ReceiveMessage","sqs:DeleteMessage","sqs:GetQueueAttributes"],Resource=values(module.sqs.queue_arns)},
    {Effect="Allow",Action=["secretsmanager:GetSecretValue","ssm:GetParameter"],Resource=[module.secrets.secret_arn,"arn:aws:ssm:${var.aws_region}:*:parameter/${local.name}/*"]}
  ]})
  cicd_policy_json = jsonencode({Version="2012-10-17",Statement=[
    {Effect="Allow",Action=["ecs:DescribeServices","ecs:UpdateService"],Resource=["*"]},
    {Effect="Allow",Action=["ecr:GetAuthorizationToken","ecr:BatchGetImage","ecr:PutImage","ecr:InitiateLayerUpload","ecr:UploadLayerPart","ecr:CompleteLayerUpload"],Resource=["*"]},
    {Effect="Allow",Action=["iam:PassRole"],Resource=["arn:aws:iam::*:role/${local.name}-api-role","arn:aws:iam::*:role/${local.name}-lambda-role"]}
  ]})
}
module "rds" { source = "../../modules/rds" name = local.name subnet_ids = module.network.private_subnet_ids db_sg_id = module.security.db_sg_id username = var.db_username password = var.db_password db_name = var.db_name instance_class = var.db_instance_class }
module "observability" {
  source = "../../modules/observability"
  name   = local.name
  api_target_group_arn_suffix = "dummy/target-group"
  lambda_function_names        = ["${local.name}-worker"]
  rds_instance_id              = "${local.name}-postgres"
  sqs_queue_names              = local.queue_names
  dlq_queue_names              = local.dlq_queue_names
}
module "secrets" { source = "../../modules/secrets" name = local.name secret_values = var.secret_values ssm_parameters = var.ssm_parameters }
module "ecs_api" {
  source = "../../modules/ecs_api"
  name = local.name
  region = var.aws_region
  image = var.api_image
  execution_role_arn = module.iam.api_role_arn
  task_role_arn = module.iam.api_role_arn
  private_subnet_ids = module.network.private_subnet_ids
  api_sg_id = module.security.api_sg_id
  log_group_name = "/studyforge/${local.name}/api"
  secrets = { DATABASE_URL = module.secrets.secret_arn }
}
