Add a built-in Pomodoro focus timer that integrates with XP and study tracking.

Frontend steps:
1. Create PomodoroTimer component in components/study/:
   - States: idle → focus (25min) → short break (5min) → long break (15min after 4 pomodoros)
   - Circular progress indicator showing time remaining
   - Sound notification on state transition using Web Audio API (gentle bell)
   - Auto-starts next phase with 3-second countdown
   - Persistent floating widget at bottom-right of group pages, minimizable to a countdown badge

2. Session tracking:
   - On each completed focus block: POST /analytics/reading-event with event_type: "pomodoro_complete", metadata: { group_id, duration: 1500 }
   - After 4 pomodoros (one full cycle), show congratulations state with XP earned

3. Settings (gear icon inside timer):
   - Focus duration: 15 / 25 / 45 / 60 min
   - Break duration: 5 / 10 / 15 min
   - Saved to localStorage per user

4. Study mode: when Pomodoro is running, dim the sidebar and show a soft focus border on the content area

Show complete PomodoroTimer component with all states, animations, Web Audio sound, and XP tracking call.
