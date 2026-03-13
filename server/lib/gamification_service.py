"""
Gamification service — XP, streaks, badges, and confidence scoring.
"""

import logging
from datetime import datetime, date
from typing import Optional, List

logger = logging.getLogger(__name__)

_conn = None

# ── Badge Definitions ──
BADGE_DEFINITIONS = [
    {"id": "first_lesson", "name": "First Steps", "icon": "school", "description": "Complete your first lesson section", "threshold": 1, "type": "sections_completed"},
    {"id": "five_sections", "name": "Getting Started", "icon": "trending_up", "description": "Complete 5 lesson sections", "threshold": 5, "type": "sections_completed"},
    {"id": "ten_sections", "name": "Scholar", "icon": "auto_stories", "description": "Complete 10 lesson sections", "threshold": 10, "type": "sections_completed"},
    {"id": "twenty_sections", "name": "Knowledge Seeker", "icon": "psychology", "description": "Complete 20 lesson sections", "threshold": 20, "type": "sections_completed"},
    {"id": "perfect_quiz", "name": "Quiz Master", "icon": "emoji_events", "description": "Score 5/5 on a quiz", "threshold": 5, "type": "perfect_quiz"},
    {"id": "streak_3", "name": "On Fire", "icon": "local_fire_department", "description": "Maintain a 3-day streak", "threshold": 3, "type": "streak"},
    {"id": "streak_7", "name": "Unstoppable", "icon": "bolt", "description": "Maintain a 7-day streak", "threshold": 7, "type": "streak"},
    {"id": "streak_14", "name": "Legendary", "icon": "star", "description": "Maintain a 14-day streak", "threshold": 14, "type": "streak"},
    {"id": "xp_100", "name": "Centurion", "icon": "military_tech", "description": "Earn 100 XP", "threshold": 100, "type": "xp"},
    {"id": "xp_500", "name": "Elite Learner", "icon": "workspace_premium", "description": "Earn 500 XP", "threshold": 500, "type": "xp"},
    {"id": "xp_1000", "name": "Grandmaster", "icon": "diamond", "description": "Earn 1000 XP", "threshold": 1000, "type": "xp"},
]

# ── XP Rewards ──
XP_QUIZ_CORRECT = 10
XP_QUIZ_PERFECT = 25    # bonus for 5/5
XP_LESSON_COMPLETE = 15
XP_STREAK_BONUS = 5     # per day of streak


def initialize(conn):
    """Store DB connection and create gamification tables."""
    global _conn
    _conn = conn
    _create_tables()


def _create_tables():
    queries = [
        """
        CREATE TABLE IF NOT EXISTS user_gamification (
            user_id INTEGER DEFAULT 1,
            xp INTEGER DEFAULT 0,
            level INTEGER DEFAULT 1,
            current_streak INTEGER DEFAULT 0,
            longest_streak INTEGER DEFAULT 0,
            last_activity_date DATE DEFAULT CURRENT_DATE,
            total_sections_completed INTEGER DEFAULT 0,
            total_quizzes_taken INTEGER DEFAULT 0,
            total_perfect_quizzes INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id)
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS user_badges (
            user_id INTEGER DEFAULT 1,
            badge_id TEXT NOT NULL,
            earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, badge_id)
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS user_activity_log (
            id SERIAL PRIMARY KEY,
            user_id INTEGER DEFAULT 1,
            activity_type TEXT NOT NULL,
            details TEXT,
            xp_earned INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """,
    ]
    try:
        with _conn.cursor() as cur:
            for q in queries:
                cur.execute(q)
            _conn.commit()
            logger.info("Gamification tables ready")
    except Exception as e:
        _conn.rollback()
        logger.exception("Error creating gamification tables: %s", e)


def _ensure_user_row(user_id: int = 1):
    """Ensure a gamification row exists for the user."""
    try:
        with _conn.cursor() as cur:
            cur.execute("INSERT INTO user_gamification (user_id) VALUES (%s) ON CONFLICT (user_id) DO NOTHING", (user_id,))
            _conn.commit()
    except Exception as e:
        _conn.rollback()


# ═══════════════ Core Functions ═══════════════

def get_stats(user_id: int = 1) -> dict:
    """Get full gamification stats for a user."""
    _ensure_user_row(user_id)
    try:
        with _conn.cursor() as cur:
            cur.execute(
                "SELECT xp, level, current_streak, longest_streak, last_activity_date, "
                "total_sections_completed, total_quizzes_taken, total_perfect_quizzes "
                "FROM user_gamification WHERE user_id = %s",
                (user_id,)
            )
            row = cur.fetchone()
            if not row:
                return {"xp": 0, "level": 1, "current_streak": 0, "longest_streak": 0,
                        "total_sections_completed": 0, "total_quizzes_taken": 0, "total_perfect_quizzes": 0}

            xp = row[0]
            return {
                "xp": xp,
                "level": row[1],
                "xp_for_next_level": _xp_for_level(row[1] + 1),
                "xp_progress_in_level": xp - _xp_for_level(row[1]),
                "current_streak": row[2],
                "longest_streak": row[3],
                "last_activity_date": str(row[4]) if row[4] else None,
                "total_sections_completed": row[5],
                "total_quizzes_taken": row[6],
                "total_perfect_quizzes": row[7],
            }
    except Exception as e:
        logger.exception("Error getting gamification stats: %s", e)
        return {"xp": 0, "level": 1, "current_streak": 0}


def get_badges(user_id: int = 1) -> List[dict]:
    """Get all badge definitions with earned status."""
    earned_ids = set()
    try:
        with _conn.cursor() as cur:
            cur.execute("SELECT badge_id, earned_at FROM user_badges WHERE user_id = %s", (user_id,))
            for row in cur.fetchall():
                earned_ids.add(row[0])
    except Exception as e:
        logger.exception("Error fetching badges: %s", e)

    return [{
        **badge,
        "earned": badge["id"] in earned_ids,
    } for badge in BADGE_DEFINITIONS]


def record_section_complete(user_id: int = 1) -> dict:
    """Record a section completion: add XP, update streak, check badges."""
    _ensure_user_row(user_id)
    xp_earned = XP_LESSON_COMPLETE
    new_badges = []

    try:
        with _conn.cursor() as cur:
            # Update streak
            cur.execute("SELECT current_streak, longest_streak, last_activity_date FROM user_gamification WHERE user_id = %s", (user_id,))
            row = cur.fetchone()
            current_streak, longest_streak, last_date = row[0], row[1], row[2]

            today = date.today()
            if last_date:
                delta = (today - last_date).days
                if delta == 1:
                    current_streak += 1
                    xp_earned += XP_STREAK_BONUS
                elif delta > 1:
                    current_streak = 1
                # delta == 0: same day, keep streak
            else:
                current_streak = 1

            longest_streak = max(longest_streak, current_streak)
            level = _calculate_level_after_xp(cur, user_id, xp_earned)

            cur.execute(
                "UPDATE user_gamification SET xp = xp + %s, level = %s, current_streak = %s, "
                "longest_streak = %s, last_activity_date = %s, total_sections_completed = total_sections_completed + 1 "
                "WHERE user_id = %s",
                (xp_earned, level, current_streak, longest_streak, today, user_id)
            )

            # Activity log
            cur.execute(
                "INSERT INTO user_activity_log (user_id, activity_type, xp_earned) VALUES (%s, 'section_complete', %s)",
                (user_id, xp_earned)
            )

            _conn.commit()

            # Check badges
            new_badges = _check_and_award_badges(user_id)

        return {"xp_earned": xp_earned, "new_badges": new_badges}

    except Exception as e:
        _conn.rollback()
        logger.exception("Error recording section: %s", e)
        return {"xp_earned": 0, "new_badges": []}


def record_quiz_score(quiz_score: int, max_score: int = 5, user_id: int = 1) -> dict:
    """Record a quiz result: add XP for correct answers, bonus for perfect."""
    _ensure_user_row(user_id)
    xp_earned = quiz_score * XP_QUIZ_CORRECT
    is_perfect = quiz_score >= max_score

    if is_perfect:
        xp_earned += XP_QUIZ_PERFECT

    try:
        with _conn.cursor() as cur:
            level = _calculate_level_after_xp(cur, user_id, xp_earned)

            perfect_inc = 1 if is_perfect else 0
            cur.execute(
                "UPDATE user_gamification SET xp = xp + %s, level = %s, "
                "total_quizzes_taken = total_quizzes_taken + 1, "
                "total_perfect_quizzes = total_perfect_quizzes + %s, "
                "last_activity_date = %s WHERE user_id = %s",
                (xp_earned, level, perfect_inc, date.today(), user_id)
            )

            cur.execute(
                "INSERT INTO user_activity_log (user_id, activity_type, details, xp_earned) "
                "VALUES (%s, 'quiz_complete', %s, %s)",
                (user_id, f"Score: {quiz_score}/{max_score}", xp_earned)
            )

            _conn.commit()
            new_badges = _check_and_award_badges(user_id)

        return {"xp_earned": xp_earned, "is_perfect": is_perfect, "new_badges": new_badges}

    except Exception as e:
        _conn.rollback()
        logger.exception("Error recording quiz: %s", e)
        return {"xp_earned": 0, "new_badges": []}


def get_activity_log(user_id: int = 1, limit: int = 20) -> List[dict]:
    """Get recent activity log entries."""
    try:
        with _conn.cursor() as cur:
            cur.execute(
                "SELECT activity_type, details, xp_earned, created_at "
                "FROM user_activity_log WHERE user_id = %s ORDER BY created_at DESC LIMIT %s",
                (user_id, limit)
            )
            return [{"type": r[0], "details": r[1], "xp": r[2], "time": str(r[3])} for r in cur.fetchall()]
    except Exception as e:
        logger.exception("Error fetching activity: %s", e)
        return []


def get_confidence_scores(user_id: int = 1) -> List[dict]:
    """Calculate per-topic confidence scores based on quiz performance."""
    try:
        from lib.lesson_store import MyLessonStore
        hierarchy = MyLessonStore.read_hierarchy_with_scores()
        topics = [h for h in hierarchy if h.parent_path is None]
        lessons = [h for h in hierarchy if h.parent_path is not None]

        results = []
        for topic in topics:
            topic_lessons = [l for l in lessons if l.parent_path == topic.path]
            all_sections = []
            for l in topic_lessons:
                all_sections.extend(l.sections)

            if not all_sections:
                results.append({"topic": topic.title, "path": topic.path, "confidence": 0, "label": "Not Started"})
                continue

            total_possible = len(all_sections) * 15  # 5 quiz + 5 tf + 5 sq
            actual = sum(s.quiz_score + s.truefalse_score + s.shortquestion_score for s in all_sections)
            confidence = round((actual / total_possible) * 100) if total_possible > 0 else 0

            label = "Mastered" if confidence >= 80 else "Strong" if confidence >= 60 else "Learning" if confidence >= 30 else "Needs Practice" if confidence > 0 else "Not Started"
            results.append({"topic": topic.title, "path": topic.path, "confidence": confidence, "label": label})

        return results
    except Exception as e:
        logger.exception("Error calculating confidence: %s", e)
        return []


# ═══════════════ Helpers ═══════════════

def _xp_for_level(level: int) -> int:
    """XP required to reach a given level. Uses quadratic scaling."""
    return (level - 1) * (level - 1) * 50  # L1=0, L2=50, L3=200, L4=450, L5=800...

def _calculate_level_after_xp(cur, user_id: int, additional_xp: int) -> int:
    """Calculate what level the user will be at after gaining XP."""
    cur.execute("SELECT xp FROM user_gamification WHERE user_id = %s", (user_id,))
    row = cur.fetchone()
    total_xp = (row[0] if row else 0) + additional_xp
    level = 1
    while _xp_for_level(level + 1) <= total_xp:
        level += 1
    return level


def _check_and_award_badges(user_id: int) -> List[dict]:
    """Check if user qualifies for any new badges, award them, return newly earned."""
    stats = get_stats(user_id)
    earned_ids = set()
    try:
        with _conn.cursor() as cur:
            cur.execute("SELECT badge_id FROM user_badges WHERE user_id = %s", (user_id,))
            earned_ids = {r[0] for r in cur.fetchall()}
    except Exception as e:
        return []

    new_badges = []
    for badge in BADGE_DEFINITIONS:
        if badge["id"] in earned_ids:
            continue

        earned = False
        if badge["type"] == "sections_completed" and stats.get("total_sections_completed", 0) >= badge["threshold"]:
            earned = True
        elif badge["type"] == "streak" and stats.get("current_streak", 0) >= badge["threshold"]:
            earned = True
        elif badge["type"] == "xp" and stats.get("xp", 0) >= badge["threshold"]:
            earned = True
        elif badge["type"] == "perfect_quiz" and stats.get("total_perfect_quizzes", 0) >= 1:
            earned = True

        if earned:
            try:
                with _conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO user_badges (user_id, badge_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                        (user_id, badge["id"])
                    )
                    _conn.commit()
                    new_badges.append(badge)
            except Exception as e:
                _conn.rollback()

    return new_badges
