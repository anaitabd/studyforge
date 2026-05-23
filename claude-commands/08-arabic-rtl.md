Add full bilingual support (Arabic + French) to the Next.js frontend with proper RTL layout for Arabic.

Steps:
1. Set up next-intl in apps/web:
   - Locales: ar (Arabic, RTL), fr (French, LTR)
   - Default locale: fr
   - Locale detection from browser, with manual override saved to user profile

2. Create translation files at apps/web/messages/ar.json and fr.json:
   - Cover all UI strings: navigation, buttons, headings, error messages, empty states
   - Arabic strings should use Modern Standard Arabic (MSA) for academic context

3. RTL layout handling:
   - Set dir="rtl" on <html> when locale is ar
   - Use Tailwind rtl: and ltr: variants for directional spacing and flex direction
   - Reverse icon positions, breadcrumb arrows, sidebar direction
   - Sidebar on right in Arabic, left in French

4. In account settings /account, add a language switcher (FR / العربية):
   - Updates locale immediately
   - Saves preference to PATCH /api/v1/me/account
   - Persists across sessions

5. Add Accept-Language header reading in FastAPI — return error messages in the user's language

6. Add a language field to the users table (default: 'fr', options: 'ar', 'fr')

Show complete next-intl setup, sample translation files for both languages, RTL layout changes, and the language switcher component.
