variable "name"                       { type = string }
variable "api_target_group_arn_suffix" { type = string }
variable "rds_instance_id"             { type = string }
variable "lambda_function_names" {
  type    = list(string)
  default = []
}
variable "rds_allocated_storage_gb" {
  type    = number
  default = 20
}
variable "sqs_queue_names" {
  type    = list(string)
  default = []
}
variable "dlq_queue_names" {
  type    = list(string)
  default = []
}
