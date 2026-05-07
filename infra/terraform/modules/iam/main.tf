data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "api" {
  name               = "${var.name}-api-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role" "lambda" {
  name = "${var.name}-lambda-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Action = "sts:AssumeRole", Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" } }]
  })
}

resource "aws_iam_role" "cicd" {
  name = "${var.name}-cicd-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Action = "sts:AssumeRole", Effect = "Allow", Principal = { AWS = var.cicd_principal_arn } }]
  })
}

resource "aws_iam_role_policy" "api" {
  name   = "${var.name}-api-policy"
  role   = aws_iam_role.api.id
  policy = var.api_policy_json
}

resource "aws_iam_role_policy" "lambda" {
  name   = "${var.name}-lambda-policy"
  role   = aws_iam_role.lambda.id
  policy = var.lambda_policy_json
}

resource "aws_iam_role_policy" "cicd" {
  name   = "${var.name}-cicd-policy"
  role   = aws_iam_role.cicd.id
  policy = var.cicd_policy_json
}
