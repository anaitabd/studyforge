output "vpc_id"              { value = module.network.vpc_id }
output "private_subnets"    { value = module.network.private_subnet_ids }
output "public_subnets"     { value = module.network.public_subnet_ids }
output "api_security_group" { value = module.security.api_sg_id }
output "db_endpoint"        { value = module.rds.endpoint }
output "assets_bucket"      { value = module.s3.assets_bucket }
output "uploads_bucket"     { value = module.s3.uploads_bucket }
output "queue_arns"         { value = module.sqs.queue_arns }
output "app_role_arn"       { value = module.iam.api_role_arn }
output "secret_arn"         { value = module.secrets.secret_arn }
output "alb_dns_name"       { value = module.alb.alb_dns_name }
output "ecr_api_url"        { value = module.ecr.api_repository_url }
output "ecr_web_url"        { value = module.ecr.web_repository_url }
output "ecs_cluster_name"   { value = "${local.name}-cluster" }

output "redis_url" {
  value     = module.elasticache.redis_url
  sensitive = true
}
