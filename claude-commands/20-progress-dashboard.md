Build a rich personal progress dashboard for students. The /me/kpis backend endpoint exists but there is no rich frontend visualization.

Build a comprehensive dashboard at /analytics:

1. Summary strip — 4 metric cards (use recharts or just styled divs):
   - Total XP earned | Current level | Learning streak | Exams taken this month

2. Mastery by subject radar chart (recharts RadarChart):
   - One axis per subject across all groups
   - Data from GET /me/weak-areas + exam session scores
   - Color: mastered (green fill), learning (amber), not started (gray)

3. Study time chart (recharts AreaChart):
   - Daily study minutes over last 30 days
   - Annotated with exam dates as vertical dashed lines

4. Flashcard retention heatmap (GitHub-style contributions grid):
   - Last 52 weeks, color intensity = cards reviewed per day
   - Hover shows: date + cards reviewed count

5. Exam performance trend (recharts LineChart):
   - Score per exam over time, grouped by subject
   - Trendline showing improvement or decline

6. Weak areas panel:
   - Top 5 weak topics as horizontal progress bars
   - Each has "Pratiquer maintenant" button → creates targeted flashcard set on the spot

7. Streak calendar:
   - Current month with study days highlighted green
   - Current streak + longest streak ever

Backend additions needed:
8. Add GET /me/analytics/study-time — daily minutes for last 30 days from user_events (use TimescaleDB time_bucket)
9. Add GET /me/analytics/flashcard-activity — daily review counts for last 52 weeks from user_events

Show complete dashboard page, all chart components, and the two new backend analytics endpoints.
