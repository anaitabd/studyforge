output "assets_bucket" { value = aws_s3_bucket.assets.bucket }
output "uploads_bucket" { value = aws_s3_bucket.uploads.bucket }

output "assets_arn" { value = aws_s3_bucket.assets.arn }
output "uploads_arn" { value = aws_s3_bucket.uploads.arn }
