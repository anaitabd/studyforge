Deepen WhatsApp notification integration. Most Moroccan users prefer WhatsApp over email.

Backend steps:
1. In app/services/notification_service.py, add WhatsApp message templates in FR and AR:
   - Streak reminder (23:50 UTC): "🔥 N'oublie pas ta série de {streak_days} jours, {first_name}! Fais au moins une carte mémoire avant minuit."
   - Exam deadline tomorrow: "📝 Rappel: l'examen '{exam_title}' est dû demain. Prépare-toi bien!"
   - New assignment: "📚 Nouveau devoir dans {group_name}: '{title}' — à rendre avant le {due_date}."
   - At-risk alert to teacher: "⚠️ {student_name} n'a pas étudié depuis {days} jours dans {group_name}."
   Arabic versions for all of the above.

2. Add notification preference fields to users table:
   - whatsapp_enabled (bool, default true if phone exists)
   - whatsapp_phone (string)
   - whatsapp_verified (bool)
   - notification_language (fr/ar)

3. Phone number verification flow:
   - GET /me/notifications/verify-phone?phone=+212... → sends OTP via WhatsApp (Twilio)
   - POST /me/notifications/verify-phone — verifies OTP, saves phone and sets whatsapp_verified = true

4. In all notification triggers throughout the codebase:
   - Check whatsapp_enabled before sending WhatsApp
   - Never send both email AND WhatsApp for the same event unless user opted into both
   - Use notification_language to choose the correct template

Frontend steps:
5. In /account settings, add a WhatsApp notification section:
   - Phone input field (pre-filled +212) + "Vérifier" button + OTP input field
   - Per-notification-type toggles: rappels de série, échéances d'examens, nouveaux devoirs, résumé hebdomadaire
   - "Envoyer un message test" button for each notification type

Show complete notification model changes, verification flow, all templates in FR and AR, and the settings UI component.
