Implement a proper PWA offline mode. sw.js exists in public/ but has no caching strategy.

Steps:
1. Replace apps/web/public/sw.js with a full Workbox-based service worker:
   - Cache-first for static assets (JS, CSS, fonts, images)
   - Network-first with cache fallback for /api/v1/me/* and /api/v1/groups/*
   - Stale-while-revalidate for Next.js pages
   - Background sync for failed POST requests (review submissions, reading events) — retry when back online

2. Offline-capable features (work without network):
   - Flashcard review: cache due cards on page load, submit reviews to background sync queue
   - Read uploaded documents: cache file content after first view
   - View past exam results: cache last 10 sessions

3. Offline indicator:
   - Subtle banner at top: "Vous êtes hors ligne — certaines fonctionnalités ne sont pas disponibles"
   - Show which features work offline (flashcards ✓, documents ✓) vs. don't (chat ✗, live quiz ✗)

4. Install prompt:
   - Show "Installer l'application" / "تثبيت التطبيق" banner on mobile after 3rd visit
   - Uses beforeinstallprompt event

5. Push notifications:
   - Request permission on first use
   - Backend sends Web Push via VAPID for: streak reminder (23:50 UTC), exam deadline tomorrow, new assignment
   - Add VAPID keys to .env, push sending to NotificationService

Show complete sw.js, next.config.js PWA setup, offline indicator component, and push notification integration.
