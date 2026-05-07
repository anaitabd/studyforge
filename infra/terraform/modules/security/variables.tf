variable "name" { type = string }
variable "vpc_id" { type = string }
variable "api_port" { type = number default = 8000 }
variable "allowed_api_cidrs" { type = list(string) default = ["0.0.0.0/0"] }
