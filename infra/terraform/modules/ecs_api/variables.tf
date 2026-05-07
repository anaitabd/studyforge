variable "name" { type = string }
variable "region" { type = string }
variable "image" { type = string }
variable "port" { type = number default = 8000 }
variable "execution_role_arn" { type = string }
variable "task_role_arn" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "api_sg_id" { type = string }
variable "log_group_name" { type = string }
variable "secrets" { type = map(string) default = {} }
