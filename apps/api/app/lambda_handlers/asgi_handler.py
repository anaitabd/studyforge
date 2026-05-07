"""Lambda ASGI entrypoint.

Use handler path: app.lambda_handlers.asgi_handler.handler
"""

from mangum import Mangum

from app.main import app

# Instantiate at import time to reduce per-invocation overhead.
handler = Mangum(app, lifespan="off")
