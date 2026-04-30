# StudyForge

StudyForge is an AI-powered educational RAG (Retrieval-Augmented Generation) platform that helps students and teachers collaborate, study smarter, and assess knowledge effectively.

## Features

- **AI Chat** — Ask questions about uploaded course materials, powered by NVIDIA NIM + DeepSeek-R1
- **Smart Exams** — Auto-generate MCQ/True-False/Fill-in-the-blank exams from documents
- **Flashcards** — Spaced-repetition flashcard sets generated from study materials
- **Study Rooms** — Real-time collaborative study sessions with shared AI chat
- **File Management** — Upload PDFs, DOCX, PPTX and have them indexed for RAG
- **Notifications** — In-app, email (SendGrid), and WhatsApp (Twilio) alerts
- **Billing** — Stripe-powered personal and school subscription plans

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend | Python FastAPI, SQLAlchemy 2.0, Alembic |
| Auth | Clerk |
| AI | NVIDIA NIM (DeepSeek-R1), ChromaDB |
| Queue | Celery + Redis |
| Storage | Cloudflare R2 / MinIO (local) |
| Database | PostgreSQL 16 |

## Monorepo Structure

```
studyforge/
  apps/
    web/          # Next.js 14 frontend
    api/          # Python FastAPI backend
  packages/
    shared-types/ # Shared TypeScript types
  docker-compose.yml
```

## Getting Started

### Prerequisites
- Docker & Docker Compose
- Node.js 20+
- Python 3.11+

### Local Development

1. Copy environment variables:
   ```bash
   cp apps/api/.env.example apps/api/.env
   ```

2. Start infrastructure services:
   ```bash
   docker compose up postgres redis minio -d
   ```

3. Run the API:
   ```bash
   cd apps/api
   python -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   uvicorn app.main:app --reload
   ```

4. Run the frontend:
   ```bash
   cd apps/web
   npm install && npm run dev
   ```

### Docker (full stack)

```bash
docker compose up --build
```

API will be available at http://localhost:8000  
Frontend at http://localhost:3000  
MinIO console at http://localhost:9001
