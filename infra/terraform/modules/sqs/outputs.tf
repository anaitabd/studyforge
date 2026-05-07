output "queue_urls" { value = { for k,v in aws_sqs_queue.main : k => v.id } }
output "queue_arns" { value = { for k,v in aws_sqs_queue.main : k => v.arn } }
