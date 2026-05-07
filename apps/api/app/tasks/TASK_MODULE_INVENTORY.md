# Task module inventory and trigger mapping

## File processing
- Module: `app.tasks.file_tasks.process_file_task`
- Shared business logic: `app.jobs.file_jobs.process_file`
- Durable trigger: **SQS file queue** (`settings.TASK_SQS_FILE_QUEUE_URL`) consumed by `app.lambda_handlers.file_handler.handler`
- Local/dev trigger: Celery queue `files` when `TASK_EXECUTION_MODE` is `celery` or `hybrid`

## Slide generation
- Module: `app.tasks.slide_tasks.generate_slides_task`
- Shared business logic: `app.jobs.slide_jobs.generate_slides`
- Durable trigger: **SQS slide queue** (`settings.TASK_SQS_SLIDE_QUEUE_URL`) consumed by `app.lambda_handlers.slide_handler.handler`
- Local/dev trigger: Celery queue `slides` when `TASK_EXECUTION_MODE` is `celery` or `hybrid`

## Notifications
- Modules: `app.tasks.notification_tasks.send_email_task`, `send_whatsapp_task`, `check_exam_deadlines`
- Shared business logic: `app.jobs.notification_jobs.*`
- Durable trigger: **SQS notification queue** (`settings.TASK_SQS_NOTIFICATION_QUEUE_URL`) consumed by `app.lambda_handlers.notification_handler.handler`
- Periodic trigger: **EventBridge schedule** (hourly) for exam deadline checks (`settings.TASK_EVENTBRIDGE_EXAM_DEADLINE_RULE`)
- Local/dev trigger: Celery queue `notifications` + beat schedule when `TASK_EXECUTION_MODE` is `celery` or `hybrid`
