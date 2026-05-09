variable "name" {
  type = string
}
variable "vpc_id" {
  type = string
}
variable "public_subnet_ids" {
  type = list(string)
}
variable "api_sg_id" {
  type        = string
  description = "ECS tasks security group — ALB ingress rules will be added to it"
}
