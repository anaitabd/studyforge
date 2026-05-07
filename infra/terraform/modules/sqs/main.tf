resource "aws_sqs_queue" "dlq" {
  for_each = var.queues
  name = "${var.name}-${each.key}-dlq"
}
resource "aws_sqs_queue" "main" {
  for_each = var.queues
  name = "${var.name}-${each.key}"
  redrive_policy = jsonencode({ deadLetterTargetArn = aws_sqs_queue.dlq[each.key].arn, maxReceiveCount = 5 })
}
