Build a post-Bac orientation feature — one of the most anxiety-inducing decisions for Moroccan students and families.

Backend steps:
1. Create tables:
   - higher_ed_programs: id, name_fr, name_ar, institution_type (ENSA/ENCG/FST/CPGE/BTS/Faculté/Private), institution_name, city, eligible_branches (text[]), min_bac_average (float), num_seats, description_fr, description_ar, application_url
   - orientation_sessions: id, user_id, bac_branch, bac_average, session_data (JSONB), recommended_programs (int[]), created_at

2. Add routes in app/api/v1/orientation.py:
   - GET /orientation/programs — list with filters: branch, city, institution_type, min_average. No auth required.
   - POST /orientation/chat — AI orientation counselor (SSE stream):
     * Takes: bac_branch, bac_average, interests, preferred_city
     * Prompt: acts as a knowledgeable Moroccan orientation counselor (mourchid), knows the system inside out, recommends concrete programs with realistic expectations, warns about competitive programs honestly
     * Responds in same language as student (FR or AR)
   - POST /orientation/save — save a session for future reference

Frontend steps:
3. Add /orientation page (accessible without login for better conversion):
   - Step 1: "Ma filière Bac" — branch selector (SM, SE, SEco, SH, SAgro, Lettres...)
   - Step 2: "Ma mention" — average range (Passable 10–11, Assez bien 12–13, Bien 14–15, Très bien 16+)
   - Step 3: "Mes préférences" — city preference, field of interest (tech, business, science, arts, health)
   - Step 4: AI orientation chat — streaming conversation with counselor
   - Right panel: program cards updating in real-time as AI mentions programs, with institution details and application links
   - Save results button (prompts account creation if not logged in)

Show complete orientation service prompt, backend routes, and the multi-step orientation frontend.
