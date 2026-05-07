# StudyForge

AI-powered educational RAG platform — upload course materials, chat with them, auto-generate exams and flashcards, track student performance.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 App Router, TypeScript, Tailwind CSS, Clerk, TanStack Query |
| Backend | Python FastAPI, SQLAlchemy 2.0 async, Alembic |
| AI | NVIDIA NIM (DeepSeek-R1 LLM + nv-embedqa-e5-v5 embeddings), ChromaDB |
| Auth | Clerk (JWT, webhooks) |
| Queue | Celery + Redis |
| Storage | Amazon S3 (primary), MinIO/R2 compatible |
| Database | PostgreSQL 16 |
| Notifications | SendGrid (email) + Twilio (WhatsApp) |

## Monorepo layout

```
studyforge/
  apps/
    api/          # FastAPI backend
    web/          # Next.js 14 frontend
  packages/
    shared-types/ # Shared TypeScript interfaces (future)
  docker-compose.yml
```

---

## Local setup (recommended path)

### Prerequisites

- Docker Desktop (for Postgres + Redis + MinIO)
- Python 3.11+
- Node.js 20+
- A [Clerk](https://clerk.com) account (free tier is fine)
- An [NVIDIA NIM](https://build.nvidia.com) API key

### 1 — Clone and copy env files

```bash
git clone <repo-url> studyforge && cd studyforge
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local   # if it exists, otherwise see section below
```

### 2 — Fill in `apps/api/.env`

```env
# Database / Redis / Storage (defaults match docker-compose)
DATABASE_URL=postgresql+asyncpg://studyforge:studyforge@localhost:5432/studyforge
REDIS_URL=redis://localhost:6379/0
S3_BUCKET=studyforge
S3_REGION=us-east-1
# Optional for local emulators (MinIO/LocalStack). Omit in AWS.
S3_ENDPOINT_URL=http://localhost:9000
# Optional for local emulators using static keys (legacy compatibility path)
R2_ACCESS_KEY=minioadmin
R2_SECRET_KEY=minioadmin
# Optional: auto-create bucket only in local dev
S3_AUTO_CREATE_BUCKET=true
# Optional: "AES256" (SSE-S3) or "aws:kms" (SSE-KMS)
S3_SERVER_SIDE_ENCRYPTION=
S3_KMS_KEY_ID=

# AI provider selection
AI_PROVIDER=nvidia  # nvidia or bedrock

# NVIDIA NIM — get your key at https://build.nvidia.com
NVIDIA_API_KEY=nvapi-xxxxxxxxxxxxxxxxxxxx
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_CHAT_MODEL=deepseek-ai/deepseek-r1
NVIDIA_EMBED_MODEL=nvidia/nv-embedqa-e5-v5

# AWS Bedrock (optional alternative to NVIDIA)
# Use IAM role (ECS/EKS/EC2/Lambda) or AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY
AWS_REGION=us-east-1
BEDROCK_CHAT_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
BEDROCK_EMBED_MODEL_ID=amazon.titan-embed-text-v2:0

# Clerk — Clerk dashboard → API Keys
CLERK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxx
CLERK_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# ChromaDB (local file path inside the container / virtualenv)
CHROMA_PATH=./chroma_db

# Optional — leave blank to skip email/WhatsApp notifications
SENDGRID_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# Optional — leave blank to skip Stripe billing
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

#### Bedrock authentication notes

- **Preferred**: attach an IAM role to your runtime (EC2/ECS/EKS/Lambda) with `bedrock:InvokeModel` permissions for the configured model IDs.
- **Local/dev alternative**: export `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and optional `AWS_SESSION_TOKEN`.
- Ensure `AWS_REGION` matches the region where your Bedrock models are enabled.

### 3 — Fill in `apps/web/.env.local`

```env
# Clerk — Clerk dashboard → API Keys (publishable key)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxx
CLERK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxx

# Clerk redirect URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Backend URL
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 4 — Start infrastructure

```bash
docker compose up postgres redis minio -d
```

Wait ~10 seconds for Postgres to become healthy.

### 5 — Create the MinIO bucket

Open [http://localhost:9001](http://localhost:9001), log in with `minioadmin / minioadmin`, and create a bucket named **`studyforge`** with public-read access policy.

Alternatively via CLI:

```bash
docker run --rm --network host minio/mc \
  alias set local http://localhost:9000 minioadmin minioadmin && \
  mc mb local/studyforge && \
  mc anonymous set download local/studyforge
```

### 6 — Run database migrations

```bash
cd apps/api
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
```

If no migration files exist yet, generate them first:

```bash
alembic revision --autogenerate -m "initial"
alembic upgrade head
```

### 7 — Start the API

```bash
# From apps/api with virtualenv active
uvicorn app.main:app --reload --port 8000
```

Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)

### 8 — Start Celery worker (file processing + notifications)

In a separate terminal:

```bash
cd apps/api && source .venv/bin/activate
celery -A app.tasks.celery_app worker --loglevel=info -Q files,notifications,slides
```

### 9 — Configure Clerk webhook

In the Clerk dashboard:
1. Go to **Webhooks → Add endpoint**
2. URL: `http://localhost:8000/api/v1/auth/webhook`  
   (Use [ngrok](https://ngrok.com) or [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) to expose localhost)
3. Subscribe to: `user.created`, `user.updated`
4. Copy the **Signing Secret** → paste as `CLERK_WEBHOOK_SECRET` in `apps/api/.env`

### 10 — Start the frontend

```bash
cd apps/web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Full Docker stack (no local Python/Node needed)

```bash
docker compose up --build
```

All 6 services start: `postgres`, `redis`, `minio`, `api`, `celery_worker`, `celery_beat`.

After the stack is up, run migrations once:

```bash
docker compose exec api alembic upgrade head
```

---

## Storage migration: R2/MinIO -> S3 envs

StudyForge now uses `S3_*` variables as the primary configuration path. Legacy `R2_*` variables remain supported only as a temporary compatibility fallback for local setups.

### New canonical variables

- `S3_BUCKET` (required)
- `S3_REGION` (required in AWS; default is `us-east-1` in local dev)
- `S3_ENDPOINT_URL` (optional; for MinIO/LocalStack/local emulation only)
- `S3_KMS_KEY_ID` (optional; used with SSE-KMS)
- `S3_SERVER_SIDE_ENCRYPTION` (optional: `AES256` or `aws:kms`)
- `S3_AUTO_CREATE_BUCKET` (optional; set `true` only for local development)

### Backward compatibility (temporary)

- `R2_BUCKET` and `R2_ENDPOINT` are still read if `S3_BUCKET`/`S3_ENDPOINT_URL` are not set.
- `R2_ACCESS_KEY`/`R2_SECRET_KEY` are only used in the temporary compatibility path (local emulators).

### AWS deployment guidance

For ECS/EKS/Lambda/EC2 deployments, **do not set static access keys in env**. Use IAM roles so the AWS SDK credential provider chain resolves credentials automatically. In AWS, typically you should set only:

```env
S3_BUCKET=your-bucket
S3_REGION=us-east-1
S3_SERVER_SIDE_ENCRYPTION=aws:kms
S3_KMS_KEY_ID=arn:aws:kms:...
```

Keep `S3_ENDPOINT_URL` unset in AWS unless you intentionally target a non-AWS S3-compatible endpoint.

---

## Testing the golden path

Follow these steps in order to exercise every major feature:

### 1 — Sign up

- Open [http://localhost:3000](http://localhost:3000)
- Click **Sign up** → create an account
- You will be redirected to `/dashboard`

### 2 — Create a group

- Click **New group**, enter a name (e.g. "Advanced Mathematics"), click **Create**
- The group card appears in the dashboard

### 3 — Upload a file

- Click the group card → you land on the group file manager page
- Drag and drop a PDF (or DOCX/PPTX/TXT) into the upload zone
- The file appears with status **Uploading → Processing → Ready**
- `Processing` means the Celery worker is extracting text, chunking, and embedding into ChromaDB — this takes ~10–60 seconds depending on file size
- If status stays at **Processing** for more than 2 minutes, check the Celery worker logs

### 4 — RAG chat

- Click **Chat with files**
- Ask a question related to the document content
- You should see the response stream token-by-token, followed by collapsible **citation cards** (file name, page, excerpt) and **follow-up suggestion chips**
- Click a suggestion chip to send that question automatically

### 5 — Generate an exam

- From the group page click **Exams → Generate**
- Set: title = "Quiz 1", questions = 10, difficulty = Mixed, type = Multiple choice (single)
- Click **Generate** — wait ~15 seconds for the AI to produce questions
- The new exam appears in the list with status **draft**

### 6 — Take the exam

- Click the exam → session starts automatically
- Answer questions using the option buttons; use the **flag** icon to mark for review
- The number navigator at the top shows green (answered) / amber (flagged) / grey (unanswered)
- Answers auto-save every 30 seconds
- Click **Submit** → confirm → you are redirected to the results page

### 7 — Review results

- See your score (e.g. **70%**), time spent, and a per-question breakdown
- For each wrong answer: correct answer highlighted in green, AI explanation, expandable **source passage**

### 8 — Generate flashcards

- From the group page click **Flashcards → Generate set**
- Enter a title and click **Generate** — wait ~10 seconds
- The set appears with a **due count** badge
- Click the set → click a card to flip it (3D animation) → rate yourself: **Again / Hard / Good / Easy**
- SM-2 scheduling updates the next review date

### 9 — Teacher analytics (owner/teacher only)

- From the group page click **Analytics**
- See KPIs: student count, file count, total chats, exam count
- Exam performance table: per-exam submission count and average score
- Student overview table: sortable by name, exams taken, average score, chat messages

### 10 — Study rooms

- From the group page click **Rooms → New room**
- The invite code is copied to your clipboard automatically
- Share the code with another group member — they click **Join** and paste the code
- Room appears in the list with member count

---

## API reference

Swagger UI is available at [http://localhost:8000/docs](http://localhost:8000/docs) when the API is running.

Key endpoints:

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/auth/webhook` | Clerk user sync (called by Clerk, not frontend) |
| `GET/POST` | `/api/v1/groups` | List / create groups |
| `GET/POST` | `/api/v1/groups/{id}/files` | List files / upload (triggers Celery ingestion) |
| `GET` | `/api/v1/groups/{id}/files/{fid}/status` | Poll ingestion status |
| `POST` | `/api/v1/groups/{id}/chat` | SSE streaming RAG chat |
| `GET` | `/api/v1/groups/{id}/chat/history` | Paginated message history |
| `POST` | `/api/v1/groups/{id}/exams/generate` | AI exam generation |
| `POST` | `/api/v1/groups/{id}/exams/{eid}/sessions` | Start exam session |
| `POST` | `/api/v1/groups/{id}/exams/{eid}/sessions/{sid}/submit` | Grade and return corrections |
| `POST` | `/api/v1/groups/{id}/flashcards/generate` | AI flashcard generation |
| `GET` | `/api/v1/groups/{id}/flashcards/{setId}/due` | Due cards for today |
| `POST` | `/api/v1/groups/{id}/flashcards/{setId}/cards/{cid}/review` | SM-2 review |
| `GET` | `/api/v1/teacher/groups/{id}/analytics` | Class performance data |
| `POST` | `/api/v1/rooms` | Create study room |
| `POST` | `/api/v1/rooms/join/{code}` | Join by invite code |

---

## Rate limits (by plan)

| Feature | Free | Personal | School |
|---|---|---|---|
| Chat messages / day | 20 | 500 | Unlimited |
| QCM generation / month | 5 | Unlimited | Unlimited |
| Flashcard generation | ✗ | ✓ | ✓ |
| Groups | 1 | Unlimited | Unlimited |

---

## Troubleshooting

**File stuck at "Processing"**  
→ Check Celery worker is running. Check `NVIDIA_API_KEY` is set. Check MinIO bucket exists and is accessible.

**Chat returns "No relevant context found"**  
→ The file may still be processing, or the ChromaDB collection is empty. Confirm the file status is "ready".

**`alembic upgrade head` fails with "target database is not up to date"**  
→ Run `alembic stamp head` first, then retry.

**Clerk webhook returns 400**  
→ Verify `CLERK_WEBHOOK_SECRET` matches the signing secret shown in the Clerk dashboard webhook settings.

**Frontend shows blank page after sign-in**  
→ Confirm `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` starts with `pk_test_` (not the secret key).
