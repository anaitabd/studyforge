variable "name" { type = string }
variable "subnet_ids" { type = list(string) }
variable "db_sg_id" { type = string }
variable "instance_class" { type = string default = "db.t4g.micro" }
variable "username" { type = string }
variable "password" { type = string sensitive = true }
variable "db_name" { type = string default = "studyforge" }
