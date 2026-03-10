PLANNER_PROMPT = """
You are an expert textbook planner.

Create 4–6 lessons for a book on the topic below.

Topic:
{topic}

{format_instructions}
"""


STRUCTURE_PROMPT = """
Generate a hierarchical textbook structure.

Hierarchy rules:

T = Topic
L = Lesson
S = Section

Rules:

1. There must be exactly ONE topic node.
2. Each lesson MUST contain 3 to 5 sections.
3. Sections MUST follow this format:

T01-L01-S01
T01-L01-S02
T01-L01-S03

4. Every lesson must have its own sections.

Example structure pattern:

T01
T01-L01
T01-L01-S01
T01-L01-S02
T01-L01-S03
T01-L02
T01-L02-S01
T01-L02-S02
T01-L02-S03

Topic:
{topic}

Lessons:
{lessons}

{format_instructions}
"""


PARAGRAPH_PROMPT = """
Write detailed paragraphs for a section.

Rules:
- Generate 2–4 subsections
- Each paragraph 4–6 sentences

Section ID:
{section_id}

Section Title:
{section_title}

Subsection IDs must follow:

T01-L01-S01-SS01
T01-L01-S01-SS02

{format_instructions}
"""