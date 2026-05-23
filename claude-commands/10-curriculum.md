Align the curriculum system to the full Moroccan education structure: Primaire → Collège → Lycée with all official branches and subjects.

Backend steps:
1. Expand app/services/curriculum_service.py with the full Moroccan curriculum tree:
   - Levels: primaire (1-6), college (1AC/2AC/3AC), lycee (TC, 1Bac, 2Bac)
   - Lycée branches (2Bac): Sciences Mathématiques A&B, Sciences Expérimentales, Sciences de la Vie et de la Terre, Sciences Économiques et Gestion, Sciences Humaines, Arts Appliqués, Sciences Agro, Lettres
   - Subjects per branch from the official MEN programme

2. Create a moroccan_curriculum table:
   - level, grade, branch, subject, chapter_number, chapter_title_fr, chapter_title_ar, learning_objectives (JSON array), exam_weight (float)

3. Add GET /curriculum/tree — full curriculum tree, cached in Redis 24h TTL
4. Add GET /curriculum/{level}/{grade}/{branch}/subjects
5. Add POST /curriculum/align — given document chunks, return which curriculum chapters they cover (LLM classification)

Frontend steps:
6. In group creation flow, add optional curriculum alignment:
   - Level → grade → branch selector
   - Tags the group and enables curriculum-aligned exam generation
7. In exam generation, show which curriculum objectives the questions cover
8. Add a curriculum progress view: which chapters studied, which missing

Show complete curriculum data structure (at least one full branch), backend routes, and the curriculum alignment UI.
