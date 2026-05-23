Add a Socratic tutor mode to RAG chat — instead of giving direct answers, the AI guides students to discover answers through questions.

Backend steps:
1. Add chat_mode field to chat_messages (or as a query param): "direct" (default) | "socratic"

2. In app/services/rag_service.py, add a Socratic system prompt variant:
   - Never directly answer the student's question
   - Ask 1–2 guiding questions that point toward the answer
   - Use retrieved context to frame questions, not provide answers
   - If student is stuck after 3 exchanges, offer a hint (not the full answer)
   - Acknowledge correct reasoning and build on it
   - Respond in the same language the student used (Arabic or French)

3. Add POST /api/v1/groups/{id}/chat/mode — saves user's preferred chat mode per group

Frontend steps:
4. Add a toggle in the chat header: "Mode direct / Mode Socratique"
   - Persists per group in localStorage and syncs to backend
   - In Socratic mode, show indicator on chat input placeholder: "Posez votre question — je vais vous guider..."

5. In Socratic mode, after AI responds with a question, show suggested response starter chips:
   "Je pense que...", "Est-ce que c'est...", "Parce que..." to help hesitant students engage

Show complete Socratic prompt engineering, backend changes, and frontend toggle with response chips.
