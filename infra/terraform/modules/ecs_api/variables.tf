variable "name" {
  type = string
}
variable "region" {
  type = string
}
variable "image" {
  type        = string
  description = "API (and Celery) container image URI"
}
variable "web_image" {
  type        = string
  default     = ""
  description = "Web container image URI; leave empty to skip web service"
}
variable "port" {
  type    = number
  default = 8000
}
variable "task_role_arn" {
  type        = string
  description = "IAM role ARN assumed by the running container (app permissions: S3, SQS, Bedrock...)"
}
variable "private_subnet_ids" {
  type = list(string)
}
variable "vpc_id" {
  type = string
}
variable "api_sg_id" {
  type        = string
  description = "Shared ECS security group for API, Celery, and Web tasks"
}
variable "log_group_name" {
  type = string
}
variable "secrets" {
  type        = map(string)
  default     = {}
  description = "Map of ENV_VAR_NAME → Secrets Manager valueFrom ARN"
}
variable "web_secrets" {
  type    = map(string)
  default = {}
}
variable "environment_vars" {
  type    = list(object({ name = string, value = string }))
  default = []
}
variable "web_environment_vars" {
  type    = list(object({ name = string, value = string }))
  default = []
}
variable "api_target_group_arn" {
  type    = string
  default = ""
}
variable "web_target_group_arn" {
  type    = string
  default = ""
}
