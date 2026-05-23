Add LaTeX/KaTeX equation support throughout the platform — critical for Moroccan SM and SE Bac students.

Frontend steps:
1. Install react-katex and katex in apps/web

2. Create a MathRenderer component:
   - Detects $...$ (inline) and $$...$$ (block) LaTeX in any text string
   - Renders with KaTeX, falls back to plain text on parse error
   - Apply to: chat messages, exam questions, flashcard front/back, learning path content

3. Create a MathInput component:
   - Text area with real-time KaTeX preview below
   - Toolbar with common symbols: fractions, integrals, summations, Greek letters, limits
   - Used in: exam question editor, chat input (toggle math mode), flashcard creation

4. In chat input, add a "∑" button to toggle math mode — wraps input in $$ and shows preview

Backend steps:
5. Update system prompts in app/services/ai_service.py:
   - Always render math using LaTeX notation ($...$ and $$...$$)
   - For photo-solve and step-by-step: return each step as separate numbered LaTeX block
   - Response format: {"steps": [{"step_number": 1, "explanation": "...", "latex": "$$...$$"}], "final_answer": "$$...$$"}

6. Update POST /files/solve/photo response schema to return structured step-by-step format

7. Create a StepByStepSolution frontend component:
   - Each step in a card with explanation and rendered LaTeX
   - Reveal one step at a time (student attempts each step first)
   - "Show all steps" button

Show complete KaTeX setup, MathRenderer, MathInput, step reveal component, and backend prompt changes.
