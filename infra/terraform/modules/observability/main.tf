resource "aws_cloudwatch_log_group" "api" { name = "/studyforge/${var.name}/api" retention_in_days = 14 }
resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  alarm_name = "${var.name}-api-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods = 2
  metric_name = "CPUUtilization"
  namespace = "AWS/ECS"
  period = 60
  statistic = "Average"
  threshold = 80
  alarm_description = "High CPU on API service"
}
