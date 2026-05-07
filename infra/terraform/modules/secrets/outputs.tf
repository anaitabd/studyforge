output "secret_arn" { value = aws_secretsmanager_secret.app.arn }
output "ssm_parameter_names" { value = [for p in aws_ssm_parameter.runtime : p.name] }
