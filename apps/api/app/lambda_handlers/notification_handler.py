import json
from app.jobs.notification_jobs import send_email, send_whatsapp


def handler(event, _context):
    body = json.loads(event["Records"][0]["body"])
    task_type = body.get("type")
    if task_type == "email":
        send_email(body["to_email"], body["subject"], body["html_body"], body.get("text_body", ""), body.get("idempotency_key"))
    elif task_type == "whatsapp":
        send_whatsapp(body["to_number"], body["body"])
    elif task_type == "exam_deadline_check":
        from app.tasks.notification_tasks import check_exam_deadlines
        check_exam_deadlines()
    return {"statusCode": 200}
