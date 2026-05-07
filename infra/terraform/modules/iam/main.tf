data "aws_iam_policy_document" "ecs_assume" {
  statement { actions = ["sts:AssumeRole"] principals { type = "Service" identifiers = ["ecs-tasks.amazonaws.com"] } }
}
resource "aws_iam_role" "app" { name = "${var.name}-app-role" assume_role_policy = data.aws_iam_policy_document.ecs_assume.json }
resource "aws_iam_role" "lambda" { name = "${var.name}-lambda-role" assume_role_policy = jsonencode({Version="2012-10-17",Statement=[{Action="sts:AssumeRole",Effect="Allow",Principal={Service="lambda.amazonaws.com"}}]}) }
resource "aws_iam_role_policy" "app" {
  name = "${var.name}-app-policy"
  role = aws_iam_role.app.id
  policy = var.app_policy_json
}
