resource "aws_cloudwatch_event_rule" "schedule" {
  for_each = var.schedules
  name = "${var.name}-${each.key}"
  schedule_expression = each.value
}
