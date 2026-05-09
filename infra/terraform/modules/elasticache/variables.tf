variable "name" {
  type = string
}
variable "vpc_id" {
  type = string
}
variable "subnet_ids" {
  type = list(string)
}
variable "allowed_sg_ids" {
  type        = list(string)
  description = "Security group IDs allowed to connect on port 6379"
}
variable "node_type" {
  type    = string
  default = "cache.t3.micro"
}
