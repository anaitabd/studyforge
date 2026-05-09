output "cluster_arn"          { value = aws_ecs_cluster.this.arn }
output "cluster_name"         { value = aws_ecs_cluster.this.name }
output "execution_role_arn"   { value = aws_iam_role.execution.arn }
output "chroma_sg_id"         { value = aws_security_group.chroma.id }
output "cloudmap_namespace_id" { value = aws_service_discovery_private_dns_namespace.internal.id }
