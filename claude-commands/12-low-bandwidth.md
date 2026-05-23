Add a low-bandwidth mode for students with poor internet (rural Morocco).

Frontend steps:
1. Create a useBandwidth() hook in apps/web/hooks/:
   - Reads navigator.connection.effectiveType
   - Listens for 'change' events
   - Returns: { isLowBandwidth: boolean, connectionType: string }

2. When isLowBandwidth is true:
   - Disable auto-playing animations and transitions
   - Replace image thumbnails with text placeholders
   - Disable video previews
   - Use text-only chat mode (disable file preview in chat)
   - Show banner: "Mode faible connexion activé" / "وضع الاتصال البطيء مفعّل" with option to override

3. Manual toggle in user settings: "Mode connexion lente" — overrides auto-detection

4. In use-streaming-chat.ts, when low-bandwidth: buffer stream and display every 500ms instead of token-by-token — reduces render thrashing on slow devices

5. Add Next.js Image quality: 60 for low-bandwidth mode

Backend steps:
6. Add low_bandwidth_mode boolean field to users table
7. When true, the RAG chat endpoint returns plain text only (no markdown formatting, no citations) — reduces response size ~40%

Show complete bandwidth hook, settings toggle, and backend streaming adjustment.
