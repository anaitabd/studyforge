resource "aws_ecs_cluster" "this" { name = "${var.name}-cluster" }
resource "aws_ecs_task_definition" "api" {
  family                   = "${var.name}-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn
  container_definitions = jsonencode([
    { name = "api", image = var.image, essential = true, portMappings = [{containerPort = var.port, hostPort = var.port}],
      secrets = [for k,v in var.secrets : { name = k, valueFrom = v }],
      logConfiguration = { logDriver = "awslogs", options = { awslogs-group = var.log_group_name, awslogs-region = var.region, awslogs-stream-prefix = "ecs" } }
    }
  ])
}
resource "aws_ecs_service" "api" {
  name = "${var.name}-api"
  cluster = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count = 1
  launch_type = "FARGATE"
  network_configuration { subnets = var.private_subnet_ids security_groups = [var.api_sg_id] assign_public_ip = false }
}
