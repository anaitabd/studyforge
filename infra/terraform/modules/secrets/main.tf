resource "aws_secretsmanager_secret" "app" { name = "${var.name}/app" }
resource "aws_secretsmanager_secret_version" "app" {
  secret_id     = aws_secretsmanager_secret.app.id
  secret_string = jsonencode(var.secret_values)
}
resource "aws_ssm_parameter" "runtime" {
  for_each = var.ssm_parameters
  name  = "/${var.name}/${each.key}"
  type  = "SecureString"
  value = each.value
}
