import atexit
import json
import logging
import os
import sys

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import numpy as np

from lib.data_ingestor import DataIngestor
from lib.utility import Utility
from lib.lesson_store import MyLessonStore
from lib.lesson_content import MyLessonContent
from lib.lesson_quiz import MyLessonQuiz
from lib.lesson_short_question import MyLessonShortQuestion
from lib.lesson_truefalse import MyLessonTrueFalse
from lib import auth_service
from lib import gamification_service

# ------------------------------------------------
# Configuration
# ------------------------------------------------
load_dotenv()

DB_NAME = os.getenv("DB_NAME", "postgres")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
DB_HOST = os.getenv("DB_HOST", "localhost")
MODEL_NAME = os.getenv("MODEL_NAME", "ministral-3:3b")
FLASK_DEBUG = os.getenv("FLASK_DEBUG", "true").lower() == "true"
FLASK_PORT = int(os.getenv("FLASK_PORT", "5000"))

# ------------------------------------------------
# Logging
# ------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

# ------------------------------------------------
# Flask App
# ------------------------------------------------
app = Flask(__name__)
CORS(app)  # Enables CORS for all routes

# Rate limiter — 30 requests/minute globally, tighter on AI endpoints
limiter = Limiter(get_remote_address, app=app, default_limits=["30/minute"])

# Global variable to hold the ingestor for cleanup
_ingestor = None


# ------------------------------------------------
# Helpers
# ------------------------------------------------
def success_response(data, message="Success", status_code=200):
    """Wraps data in a standardised success envelope."""
    return jsonify({"status": "success", "data": data, "message": message}), status_code


def error_response(message, status_code=500):
    """Wraps an error message in a standardised error envelope."""
    return jsonify({"status": "error", "data": None, "message": message}), status_code


# ------------------------------------------------
# Error Handlers
# ------------------------------------------------
@app.errorhandler(404)
def not_found(e):
    return error_response("Resource not found", 404)


@app.errorhandler(500)
def internal_error(e):
    logger.exception("Unhandled server error")
    return error_response("Internal server error", 500)


@app.errorhandler(429)
def rate_limit_exceeded(e):
    return error_response("Too many requests. Please slow down.", 429)


@app.errorhandler(400)
def bad_request(e):
    return error_response("Bad request", 400)


@app.errorhandler(403)
def forbidden(e):
    return error_response("Forbidden — insufficient permissions", 403)


# ------------------------------------------------
# Lifecycle
# ------------------------------------------------
def cleanup():
    """Closes the database connection on exit."""
    global _ingestor
    if _ingestor:
        logger.info("Closing database connection...")
        _ingestor.close()
        logger.info("Cleanup complete.")


def signal_handler(sig, frame):
    """Handles manual termination (Ctrl+C)."""
    sys.exit(0)


# Register exit handlers
atexit.register(cleanup)


def initialize_app():
    """Initialises global dependencies and lesson classes."""
    db_params = {
        "dbname": DB_NAME,
        "user": DB_USER,
        "password": DB_PASSWORD,
        "host": DB_HOST,
    }

    # Setup Data and LLM
    global _ingestor
    _ingestor = DataIngestor(db_params)
    conn = _ingestor.get_connection()
    llm = None  # OllamaLLM(model=MODEL_NAME, format="json", temperature=0)

    # Initialise all lesson classes
    classes_to_init = [
        MyLessonStore,
        MyLessonContent,
        MyLessonQuiz,
        MyLessonShortQuestion,
        MyLessonTrueFalse,
    ]

    for cls in classes_to_init:
        cls.initialize(llm, conn)

    # Initialise auth service (creates users table if needed)
    auth_service.initialize(conn)

    # Initialise gamification service
    gamification_service.initialize(conn)

    logger.info("Application initialised successfully")
    return conn


# ================================================
# Auth Routes
# ================================================
@app.route('/api/auth/register', methods=['POST'])
@limiter.limit("5/minute")
def register():
    try:
        data = request.get_json()
        name = data.get('name')
        email = data.get('email')
        password = data.get('password')

        if not all([name, email, password]):
            return error_response("name, email, and password are required", 400)

        user = auth_service.create_user(name, email, password)
        token = auth_service.generate_token(user)
        return success_response({"user": user, "token": token}, "Registration successful", 201)
    except ValueError as e:
        return error_response(str(e), 409)
    except Exception as e:
        logger.exception("Registration error")
        return error_response(str(e))


@app.route('/api/auth/login', methods=['POST'])
@limiter.limit("10/minute")
def login():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')

        if not all([email, password]):
            return error_response("email and password are required", 400)

        user = auth_service.authenticate(email, password)
        if not user:
            return error_response("Invalid email or password", 401)

        token = auth_service.generate_token(user)
        return success_response({"user": user, "token": token}, "Login successful")
    except Exception as e:
        logger.exception("Login error")
        return error_response(str(e))


# ================================================
# User Profile Routes
# ================================================
@app.route('/api/profile', methods=['GET'])
@auth_service.require_auth
def get_profile():
    """Get the current user's profile."""
    try:
        user_id = getattr(request, 'user', {}).get('user_id')
        if not user_id:
            return error_response("User not identified", 401)
        user = auth_service.get_user_by_id(user_id)
        if not user:
            return error_response("User not found", 404)
        return success_response(user, "Profile fetched")
    except Exception as e:
        logger.exception("Error fetching profile")
        return error_response(str(e))


@app.route('/api/profile', methods=['PUT'])
@auth_service.require_auth
def update_profile():
    """Update the current user's profile (name, avatar)."""
    try:
        user_id = getattr(request, 'user', {}).get('user_id')
        if not user_id:
            return error_response("User not identified", 401)
        data = request.get_json()
        user = auth_service.update_user_profile(
            user_id,
            name=data.get('name'),
            avatar_url=data.get('avatar_url')
        )
        if not user:
            return error_response("User not found", 404)
        return success_response(user, "Profile updated")
    except Exception as e:
        logger.exception("Error updating profile")
        return error_response(str(e))


@app.route('/api/profile/password', methods=['PUT'])
@auth_service.require_auth
def change_password():
    """Change the current user's password."""
    try:
        user_id = getattr(request, 'user', {}).get('user_id')
        if not user_id:
            return error_response("User not identified", 401)
        data = request.get_json()
        old_pwd = data.get('old_password')
        new_pwd = data.get('new_password')
        if not all([old_pwd, new_pwd]):
            return error_response("old_password and new_password are required", 400)
        if len(new_pwd) < 6:
            return error_response("New password must be at least 6 characters", 400)
        ok = auth_service.change_password(user_id, old_pwd, new_pwd)
        if not ok:
            return error_response("Incorrect current password", 401)
        return success_response(None, "Password changed successfully")
    except Exception as e:
        logger.exception("Error changing password")
        return error_response(str(e))


# ================================================
# Admin Routes
# ================================================
@app.route('/api/admin/users', methods=['GET'])
@auth_service.require_admin
def admin_list_users():
    """List all users (admin only)."""
    try:
        users = auth_service.list_all_users()
        return success_response(users, "Users fetched")
    except Exception as e:
        logger.exception("Error listing users")
        return error_response(str(e))


@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
@auth_service.require_admin
def admin_delete_user(user_id):
    """Delete a user (admin only)."""
    try:
        ok = auth_service.delete_user(user_id)
        if not ok:
            return error_response("User not found", 404)
        return success_response(None, "User deleted")
    except Exception as e:
        logger.exception("Error deleting user")
        return error_response(str(e))


@app.route('/api/admin/users/<int:user_id>/role', methods=['PUT'])
@auth_service.require_admin
def admin_update_role(user_id):
    """Update a user's role (admin only)."""
    try:
        data = request.get_json()
        role = data.get('role')
        if role not in ('student', 'admin'):
            return error_response("role must be 'student' or 'admin'", 400)
        user = auth_service.update_user_role(user_id, role)
        if not user:
            return error_response("User not found", 404)
        return success_response(user, "Role updated")
    except Exception as e:
        logger.exception("Error updating role")
        return error_response(str(e))


@app.route('/api/admin/lessons', methods=['GET'])
@auth_service.require_admin
def admin_list_lessons():
    """List all lesson hierarchy items (admin CMS overview)."""
    try:
        hierarchy = MyLessonStore.read_hierarchy_with_scores()
        return success_response(
            [h.model_dump() for h in hierarchy],
            "CMS lessons fetched"
        )
    except Exception as e:
        logger.exception("Error fetching CMS lessons")
        return error_response(str(e))


@app.route('/api/admin/sections/<path:section_path>', methods=['PUT'])
@auth_service.require_admin
def admin_update_section(section_path):
    """Update a section's content (admin CMS edit)."""
    try:
        data = request.get_json()
        content = data.get('content')
        if not content:
            return error_response("content is required", 400)
        ok = MyLessonStore.update_section_content(section_path, content)
        if ok:
            return success_response(None, "Section content updated")
        return error_response("Section not found", 404)
    except Exception as e:
        logger.exception("Error updating section content")
        return error_response(str(e))


@app.route('/api/admin/scores/reset/<path:section_path>', methods=['POST'])
@auth_service.require_admin
def admin_reset_scores(section_path):
    """Reset a section's scores to 0 (admin only)."""
    try:
        MyLessonStore.update_quiz_score(section_path, 0)
        MyLessonStore.update_truefalse_score(section_path, 0)
        MyLessonStore.update_short_question_score(section_path, 0)
        return success_response(None, "Scores reset")
    except Exception as e:
        logger.exception("Error resetting scores")
        return error_response(str(e))


# ================================================
# Analytics Routes
# ================================================
@app.route('/api/analytics/summary', methods=['GET'])
@auth_service.require_auth
def get_analytics_summary():
    """Returns an analytics summary: total/completed sections, score totals, averages."""
    try:
        scores = MyLessonStore.read_all_scores_db()
        total = len(scores)
        completed = sum(1 for s in scores if s.quiz_score > 0 or s.truefalse_score > 0 or s.shortquestion_score > 0)

        total_quiz = sum(s.quiz_score for s in scores)
        total_tf = sum(s.truefalse_score for s in scores)
        total_sq = sum(s.shortquestion_score for s in scores)

        avg_quiz = round(total_quiz / total, 2) if total > 0 else 0
        avg_tf = round(total_tf / total, 2) if total > 0 else 0
        avg_sq = round(total_sq / total, 2) if total > 0 else 0

        return success_response({
            "total_sections": total,
            "completed_sections": completed,
            "progress_percent": round((completed / total) * 100) if total > 0 else 0,
            "scores": {
                "quiz": {"total": total_quiz, "average": avg_quiz},
                "truefalse": {"total": total_tf, "average": avg_tf},
                "shortquestion": {"total": total_sq, "average": avg_sq},
            }
        }, "Analytics fetched")
    except Exception as e:
        logger.exception("Error fetching analytics")
        return error_response(str(e))


# ================================================
# Lesson Routes
# ================================================
@app.route('/api/lessons/content', methods=['GET'])
@auth_service.require_auth
async def get_lesson_content():
    try:
        path = request.args.get('path')
        lesson_content = await MyLessonContent.generate_response(path)
        if lesson_content:
            return success_response(lesson_content.model_dump(), "Lesson content fetched successfully")
        return error_response("Content not found", 404)
    except Exception as e:
        logger.exception("Error fetching lesson content")
        return error_response(str(e))


@app.route('/api/lessons/quizzes', methods=['GET'])
@auth_service.require_auth
async def get_lesson_quiz():
    try:
        path = request.args.get('path')
        lesson_quiz_set = await MyLessonQuiz.generate_response(path)
        if lesson_quiz_set:
            return success_response(lesson_quiz_set.model_dump(), "Quiz fetched successfully")
        return error_response("Content not found", 404)
    except Exception as e:
        logger.exception("Error fetching quiz")
        return error_response(str(e))


@app.route('/api/lessons/truefalse', methods=['GET'])
@auth_service.require_auth
async def get_lesson_true_false():
    try:
        path = request.args.get('path')
        lesson_true_false_set = await MyLessonTrueFalse.generate_response(path)
        if lesson_true_false_set:
            return success_response(lesson_true_false_set.model_dump(), "True/False fetched successfully")
        return error_response("Content not found", 404)
    except Exception as e:
        logger.exception("Error fetching true/false")
        return error_response(str(e))


@app.route('/api/lessons/shortquestions', methods=['GET'])
@auth_service.require_auth
async def get_lesson_short_questions():
    try:
        path = request.args.get('path')
        lesson_short_questions_set = await MyLessonShortQuestion.generate_response(path)
        if lesson_short_questions_set:
            return success_response(lesson_short_questions_set.model_dump(), "Short questions fetched successfully")
        return error_response("Content not found", 404)
    except Exception as e:
        logger.exception("Error fetching short questions")
        return error_response(str(e))


@app.route("/api/lessons/compare", methods=["POST"])
@auth_service.require_auth
def compare_text_to_embedding():
    try:
        data = request.get_json()
        text = data.get("text")
        embedding_list = data.get("embedding")
        if text is None or embedding_list is None:
            return error_response("text and embedding are required", 400)
        embedding = np.array(embedding_list)
        result = Utility.compare_text_to_embeddings(embedding, text)
        return success_response({"match": bool(result)}, "Comparison complete")
    except Exception as e:
        logger.exception("Error comparing text to embedding")
        return error_response(str(e))


@app.route('/api/lessons/hierarchy', methods=['GET'])
@auth_service.require_auth
def get_lesson_hierarchy():
    try:
        hierarchy = MyLessonStore.read_hierarchy_with_scores()
        return success_response(
            [h.model_dump() for h in hierarchy],
            "Lesson hierarchy fetched successfully"
        )
    except Exception as e:
        logger.exception("Error fetching lesson hierarchy")
        return error_response(str(e))


@app.route('/api/lessons/scores', methods=['POST'])
@auth_service.require_auth
def update_scores():
    try:
        data = request.get_json()
        path = data.get('path')

        if not path:
            return error_response("path is required", 400)

        results = {}
        score_fields = ['quiz_score', 'truefalse_score', 'short_question_score']
        if not any(field in data for field in score_fields):
            return error_response("No scores to update", 400)

        if 'quiz_score' in data:
            MyLessonStore.update_quiz_score(path, data['quiz_score'])
            results['quiz_score'] = 'updated'

        if 'truefalse_score' in data:
            MyLessonStore.update_truefalse_score(path, data['truefalse_score'])
            results['truefalse_score'] = 'updated'

        if 'short_question_score' in data:
            MyLessonStore.update_short_question_score(path, data['short_question_score'])
            results['short_question_score'] = 'updated'

        if not results:
            return error_response("No scores to update", 400)

        return success_response({"updated": results}, "Scores updated successfully")

    except Exception as e:
        logger.exception("Error updating scores")
        return error_response(str(e))


if __name__ == "__main__":
    initialize_app()
    logger.info(f"Starting Flask server on port {FLASK_PORT}...")
    app.run(debug=FLASK_DEBUG, port=FLASK_PORT)
