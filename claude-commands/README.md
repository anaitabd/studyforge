# StudyForge Claude Code Commands

## Setup
1. Copy CLAUDE.md to your repo root (or merge with existing one)
2. Copy all .md files (except CLAUDE.md and README.md) to .claude/commands/ in your repo
3. Run `claude` in your repo root

## Usage
In a Claude Code session, type `/project:` and tab to see all commands, or type the command name directly:

| Command | Feature |
|---|---|
| /project:01-pagination | Cursor-based pagination on all list endpoints |
| /project:02-file-validation | File type + size validation on upload |
| /project:03-celery-retry | Celery retry policy + dead-letter queue |
| /project:04-group-update | PATCH /groups/{id} endpoint |
| /project:05-question-crud | Edit/delete/add exam questions after generation |
| /project:06-chromadb-cleanup | Clean up embeddings on file/group delete |
| /project:07-audit-log-api | Admin audit log retrieval endpoint |
| /project:08-arabic-rtl | Arabic + French bilingual UI with RTL |
| /project:09-bac-prep | Baccalauréat preparation mode |
| /project:10-curriculum | Moroccan curriculum alignment by branch/level |
| /project:11-local-payment | CMI (Moroccan local payment) integration |
| /project:12-low-bandwidth | Low-bandwidth mode for rural Morocco |
| /project:13-textbook-library | Pre-loaded MEN official textbooks |
| /project:14-socratic-tutor | Socratic tutor chat mode |
| /project:15-adaptive-difficulty | Adaptive exam/flashcard difficulty |
| /project:16-pdf-annotations | PDF highlight and notes |
| /project:17-math-editor | KaTeX equation editor + step-by-step solver |
| /project:18-study-planner | AI-generated weekly study schedule |
| /project:19-pomodoro | Pomodoro focus timer with XP |
| /project:20-progress-dashboard | Rich student analytics dashboard |
| /project:21-offline-pwa | Full PWA offline mode |
| /project:22-study-rooms-websocket | Real-time collaborative study rooms |
| /project:23-peer-forum | Peer Q&A forum per group |
| /project:24-concept-map | React Flow concept map visualization |
| /project:25-question-bank | Teacher question bank |
| /project:26-student-report-pdf | One-click student progress PDF report |
| /project:27-parent-portal | Parent accounts + weekly WhatsApp summary |
| /project:28-orientation-guide | Post-Bac orientation AI counselor |
| /project:29-flower-monitoring | Celery Flower monitoring dashboard |
| /project:30-malware-scanning | ClamAV malware scanning for uploads |
| /project:31-log-aggregation | Structured logging + GCP Cloud Logging |
| /project:32-database-backup | Automated DB + ChromaDB backups |
| /project:33-search-page | Global search UI (Cmd+K + results page) |
| /project:34-whatsapp-notifications | Deep WhatsApp notification integration |

## Recommended order
Start with 01–07 (critical fixes) before adding new features.
Morocco-specific: 08, 09, 11 are the highest priority for market fit.

## Workflow per command
1. Type the command (e.g. /project:01-pagination)
2. Press Shift+Tab to enter Plan Mode
3. Review Claude's plan carefully before approving
4. After completion: run tests, commit, then /clear before the next command
