variable "aws_region" { type = string default = "us-east-1" }
variable "environment" { type = string }
variable "vpc_cidr" { type = string }
variable "public_subnets" { type = map(object({ cidr = string, az = string })) }
variable "private_subnets" { type = map(object({ cidr = string, az = string })) }
variable "queues" { type = map(object({})) }
variable "schedules" { type = map(string) }
variable "api_port" { type = number default = 8000 }
variable "api_image" { type = string }
variable "db_username" { type = string }
variable "db_password" { type = string sensitive = true }
variable "db_name" { type = string default = "studyforge" }
variable "db_instance_class" { type = string default = "db.t4g.micro" }
variable "secret_values" { type = map(string) sensitive = true }
variable "ssm_parameters" { type = map(string) sensitive = true }
