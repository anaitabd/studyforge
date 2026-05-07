# StudyForge Terraform Infrastructure

This directory provisions baseline AWS infrastructure across three environments: `dev`, `staging`, and `prod`.

## API hosting target

This stack codifies **Option A: ECS Fargate** for hosting the FastAPI container.

## Resources provisioned

- VPC, public/private subnets, route tables, internet gateway, NAT gateway
- Security groups for API and PostgreSQL
- RDS PostgreSQL instance + subnet group
- S3 buckets for assets/uploads
- SQS queues with paired DLQs
- EventBridge schedule rules
- IAM app/lambda roles and app inline policy
- CloudWatch log group and CPU alarm
- Secrets Manager secret and SSM secure parameters
- ECS cluster, task definition, and service for API runtime

## Layout

- `modules/`: reusable Terraform modules
- `environments/dev|staging|prod`: environment entrypoints and vars

## Usage

```bash
cd infra/terraform/environments/dev
terraform init
terraform plan -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars
```

Repeat for `staging` or `prod`.

## Secrets wiring

Runtime secrets are injected into ECS task definitions using `secrets` references. Update `secret_values` and `ssm_parameters` in your environment `.tfvars` (or preferably via secure CI/CD variable injection).

## Outputs

Each environment exports VPC, subnets, DB endpoint, S3 bucket names, queue ARNs, IAM app role ARN, and secret ARN.
