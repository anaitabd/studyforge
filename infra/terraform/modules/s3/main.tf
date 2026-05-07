resource "aws_s3_bucket" "assets" { bucket = "${var.name}-${var.assets_suffix}" }
resource "aws_s3_bucket" "uploads" { bucket = "${var.name}-${var.uploads_suffix}" }
