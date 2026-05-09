output "redis_url"    { value = "redis://${aws_elasticache_cluster.this.cache_nodes[0].address}:6379/0" }
output "redis_sg_id"  { value = aws_security_group.redis.id }
output "endpoint"     { value = aws_elasticache_cluster.this.cache_nodes[0].address }
