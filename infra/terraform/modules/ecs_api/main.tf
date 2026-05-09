# ---------------------------------------------------------------------------
# ECS Cluster (shared by all services)
# ---------------------------------------------------------------------------
resource "aws_ecs_cluster" "this" {
  name = "${var.name}-cluster"
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# Execution role: trusted by ECS agent to pull images and read secrets
resource "aws_iam_role" "execution" {
  name = "${var.name}-ecs-execution-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Effect = "Allow", Action = "sts:AssumeRole", Principal = { Service = "ecs-tasks.amazonaws.com" } }]
  })
}

resource "aws_iam_role_policy_attachment" "execution_managed" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "execution_secrets" {
  name = "secrets-ssm-access"
  role = aws_iam_role.execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = ["arn:aws:secretsmanager:${var.region}:*:secret:${var.name}*"]
      },
      {
        Effect   = "Allow"
        Action   = ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"]
        Resource = ["arn:aws:ssm:${var.region}:*:parameter/${var.name}/*"]
      }
    ]
  })
}

# ---------------------------------------------------------------------------
# Cloud Map — internal service discovery for ChromaDB
# ---------------------------------------------------------------------------
resource "aws_service_discovery_private_dns_namespace" "internal" {
  name = "${var.name}.local"
  vpc  = var.vpc_id
}

resource "aws_service_discovery_service" "chroma" {
  name = "chroma"
  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.internal.id
    dns_records {
      ttl  = 10
      type = "A"
    }
    routing_policy = "MULTIVALUE"
  }
  health_check_custom_config { failure_threshold = 1 }
}

# ---------------------------------------------------------------------------
# ChromaDB — dedicated security group + ECS service
# ---------------------------------------------------------------------------
resource "aws_security_group" "chroma" {
  name   = "${var.name}-chroma-sg"
  vpc_id = var.vpc_id

  ingress {
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [var.api_sg_id]
    description     = "API and Celery to ChromaDB"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.name}-chroma-sg" }
}

# ---------------------------------------------------------------------------
# Shared locals
# ---------------------------------------------------------------------------
locals {
  log_config = {
    logDriver = "awslogs"
    options = {
      "awslogs-group"         = var.log_group_name
      "awslogs-region"        = var.region
      "awslogs-stream-prefix" = "ecs"
    }
  }
  secrets_list     = [for k, v in var.secrets     : { name = k, valueFrom = v }]
  web_secrets_list = [for k, v in var.web_secrets : { name = k, valueFrom = v }]
}

# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------
resource "aws_ecs_task_definition" "api" {
  family                   = "${var.name}-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = var.task_role_arn
  container_definitions = jsonencode([{
    name         = "api"
    image        = var.image
    essential    = true
    portMappings = [{ containerPort = var.port, hostPort = var.port }]
    environment  = var.environment_vars
    secrets      = local.secrets_list
    logConfiguration = local.log_config
  }])
}

resource "aws_ecs_service" "api" {
  name                               = "${var.name}-api"
  cluster                            = aws_ecs_cluster.this.id
  task_definition                    = aws_ecs_task_definition.api.arn
  desired_count                      = 1
  launch_type                        = "FARGATE"
  health_check_grace_period_seconds  = 60

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.api_sg_id]
    assign_public_ip = false
  }

  dynamic "load_balancer" {
    for_each = var.api_target_group_arn != "" ? [1] : []
    content {
      target_group_arn = var.api_target_group_arn
      container_name   = "api"
      container_port   = var.port
    }
  }

  depends_on = [aws_iam_role_policy_attachment.execution_managed]
}

# ---------------------------------------------------------------------------
# Celery Worker
# ---------------------------------------------------------------------------
resource "aws_ecs_task_definition" "celery_worker" {
  family                   = "${var.name}-celery-worker"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = var.task_role_arn
  container_definitions = jsonencode([{
    name      = "celery-worker"
    image     = var.image
    essential = true
    command   = ["celery", "-A", "app.tasks.celery_app", "worker",
                 "--loglevel=info", "-Q", "files,notifications,slides",
                 "--concurrency=1", "--max-tasks-per-child=5", "--pool=solo"]
    environment      = var.environment_vars
    secrets          = local.secrets_list
    logConfiguration = local.log_config
  }])
}

resource "aws_ecs_service" "celery_worker" {
  name            = "${var.name}-celery-worker"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.celery_worker.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.api_sg_id]
    assign_public_ip = false
  }

  depends_on = [aws_iam_role_policy_attachment.execution_managed]
}

# ---------------------------------------------------------------------------
# Celery Beat
# ---------------------------------------------------------------------------
resource "aws_ecs_task_definition" "celery_beat" {
  family                   = "${var.name}-celery-beat"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = var.task_role_arn
  container_definitions = jsonencode([{
    name      = "celery-beat"
    image     = var.image
    essential = true
    command   = ["celery", "-A", "app.tasks.celery_app", "beat", "--loglevel=info"]
    environment      = var.environment_vars
    secrets          = local.secrets_list
    logConfiguration = local.log_config
  }])
}

resource "aws_ecs_service" "celery_beat" {
  name            = "${var.name}-celery-beat"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.celery_beat.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.api_sg_id]
    assign_public_ip = false
  }

  depends_on = [aws_iam_role_policy_attachment.execution_managed]
}

# ---------------------------------------------------------------------------
# ChromaDB
# ---------------------------------------------------------------------------
resource "aws_ecs_task_definition" "chroma" {
  family                   = "${var.name}-chroma"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = var.task_role_arn
  container_definitions = jsonencode([{
    name      = "chroma"
    image     = "chromadb/chroma:0.5.3"
    essential = true
    portMappings = [{ containerPort = 8000, hostPort = 8000 }]
    environment = [
      { name = "IS_PERSISTENT",        value = "TRUE"  },
      { name = "ANONYMIZED_TELEMETRY", value = "FALSE" }
    ]
    logConfiguration = local.log_config
  }])
}

resource "aws_ecs_service" "chroma" {
  name            = "${var.name}-chroma"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.chroma.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.chroma.id]
    assign_public_ip = false
  }

  service_registries {
    registry_arn = aws_service_discovery_service.chroma.arn
  }

  depends_on = [aws_iam_role_policy_attachment.execution_managed]
}

# ---------------------------------------------------------------------------
# Web (Next.js) — only deployed when web_image is set
# ---------------------------------------------------------------------------
resource "aws_ecs_task_definition" "web" {
  count                    = var.web_image != "" ? 1 : 0
  family                   = "${var.name}-web"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = var.task_role_arn
  container_definitions = jsonencode([{
    name         = "web"
    image        = var.web_image
    essential    = true
    portMappings = [{ containerPort = 3000, hostPort = 3000 }]
    environment  = var.web_environment_vars
    secrets      = local.web_secrets_list
    logConfiguration = local.log_config
  }])
}

resource "aws_ecs_service" "web" {
  count                             = var.web_image != "" ? 1 : 0
  name                              = "${var.name}-web"
  cluster                           = aws_ecs_cluster.this.id
  task_definition                   = aws_ecs_task_definition.web[0].arn
  desired_count                     = 1
  launch_type                       = "FARGATE"
  health_check_grace_period_seconds = 60

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.api_sg_id]
    assign_public_ip = false
  }

  dynamic "load_balancer" {
    for_each = var.web_target_group_arn != "" ? [1] : []
    content {
      target_group_arn = var.web_target_group_arn
      container_name   = "web"
      container_port   = 3000
    }
  }

  depends_on = [aws_iam_role_policy_attachment.execution_managed]
}
