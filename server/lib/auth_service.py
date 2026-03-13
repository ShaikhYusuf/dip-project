"""
Authentication service — handles user registration, login, JWT, and profile management.
"""

import logging
import os
from datetime import datetime, timedelta, timezone
from functools import wraps
from typing import Optional, List

import bcrypt
import jwt
from flask import request, jsonify
import inspect

logger = logging.getLogger(__name__)

SECRET_KEY = os.getenv("SECRET_KEY", "change-this-secret-key")
AUTH_REQUIRED = os.getenv("AUTH_REQUIRED", "false").lower() == "true"
TOKEN_EXPIRY_HOURS = 24


# ------------------------------------------------
# Database helpers
# ------------------------------------------------
_conn = None


def initialize(conn):
    """Store the DB connection and ensure the users table exists."""
    global _conn
    _conn = conn
    _create_users_table()


def _create_users_table():
    query = """
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'student',
        avatar_url TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """
    try:
        with _conn.cursor() as cur:
            cur.execute(query)
            # Add columns if they don't exist (for existing databases)
            for col, typ, default in [
                ("avatar_url", "TEXT", "NULL"),
                ("updated_at", "TIMESTAMP", "CURRENT_TIMESTAMP"),
            ]:
                cur.execute(f"""
                    DO $$ BEGIN
                        ALTER TABLE users ADD COLUMN {col} {typ} DEFAULT {default};
                    EXCEPTION WHEN duplicate_column THEN NULL;
                    END $$;
                """)
            _conn.commit()
            logger.info("Users table ready")
    except Exception as e:
        _conn.rollback()
        logger.exception("Error creating users table: %s", e)


# ------------------------------------------------
# User management
# ------------------------------------------------
def create_user(name: str, email: str, password: str, role: str = "student") -> dict:
    """Register a new user. Returns the user dict (without password)."""
    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    query = """
    INSERT INTO users (name, email, password_hash, role)
    VALUES (%s, %s, %s, %s)
    RETURNING id, name, email, role, created_at;
    """
    try:
        with _conn.cursor() as cur:
            cur.execute(query, (name, email, password_hash, role))
            row = cur.fetchone()
            _conn.commit()
            return {
                "id": row[0],
                "name": row[1],
                "email": row[2],
                "role": row[3],
                "created_at": str(row[4]),
            }
    except Exception as e:
        _conn.rollback()
        if "unique" in str(e).lower() or "duplicate" in str(e).lower():
            raise ValueError("Email already registered")
        raise


def authenticate(email: str, password: str) -> Optional[dict]:
    """Verify credentials and return a user dict, or None on failure."""
    query = "SELECT id, name, email, password_hash, role FROM users WHERE email = %s"
    try:
        with _conn.cursor() as cur:
            cur.execute(query, (email,))
            row = cur.fetchone()
            if not row:
                return None
            stored_hash = row[3]
            if bcrypt.checkpw(password.encode("utf-8"), stored_hash.encode("utf-8")):
                return {"id": row[0], "name": row[1], "email": row[2], "role": row[4]}
            return None
    except Exception as e:
        logger.exception("Authentication error: %s", e)
        return None


def get_user_by_id(user_id: int) -> Optional[dict]:
    """Fetch a user by ID."""
    query = "SELECT id, name, email, role, avatar_url, created_at FROM users WHERE id = %s"
    try:
        with _conn.cursor() as cur:
            cur.execute(query, (user_id,))
            row = cur.fetchone()
            if not row:
                return None
            return {
                "id": row[0], "name": row[1], "email": row[2],
                "role": row[3], "avatar_url": row[4], "created_at": str(row[5]),
            }
    except Exception as e:
        logger.exception("Error fetching user: %s", e)
        return None


def update_user_profile(user_id: int, name: str = None, avatar_url: str = None) -> Optional[dict]:
    """Update a user's profile fields."""
    updates, params = [], []
    if name:
        updates.append("name = %s")
        params.append(name)
    if avatar_url is not None:
        updates.append("avatar_url = %s")
        params.append(avatar_url)

    if not updates:
        return get_user_by_id(user_id)

    updates.append("updated_at = CURRENT_TIMESTAMP")
    params.append(user_id)

    query = f"UPDATE users SET {', '.join(updates)} WHERE id = %s RETURNING id, name, email, role, avatar_url, created_at"
    try:
        with _conn.cursor() as cur:
            cur.execute(query, tuple(params))
            row = cur.fetchone()
            _conn.commit()
            if not row:
                return None
            return {
                "id": row[0], "name": row[1], "email": row[2],
                "role": row[3], "avatar_url": row[4], "created_at": str(row[5]),
            }
    except Exception as e:
        _conn.rollback()
        logger.exception("Error updating profile: %s", e)
        return None


def change_password(user_id: int, old_password: str, new_password: str) -> bool:
    """Change a user's password after verifying the old one."""
    query = "SELECT password_hash FROM users WHERE id = %s"
    try:
        with _conn.cursor() as cur:
            cur.execute(query, (user_id,))
            row = cur.fetchone()
            if not row:
                return False
            if not bcrypt.checkpw(old_password.encode("utf-8"), row[0].encode("utf-8")):
                return False
            new_hash = bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
            cur.execute("UPDATE users SET password_hash = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                        (new_hash, user_id))
            _conn.commit()
            return True
    except Exception as e:
        _conn.rollback()
        logger.exception("Error changing password: %s", e)
        return False


def list_all_users() -> List[dict]:
    """List all users (admin only)."""
    query = "SELECT id, name, email, role, avatar_url, created_at FROM users ORDER BY id"
    try:
        with _conn.cursor() as cur:
            cur.execute(query)
            rows = cur.fetchall()
            return [{
                "id": r[0], "name": r[1], "email": r[2],
                "role": r[3], "avatar_url": r[4], "created_at": str(r[5]),
            } for r in rows]
    except Exception as e:
        logger.exception("Error listing users: %s", e)
        return []


def delete_user(user_id: int) -> bool:
    """Delete a user by ID (admin only)."""
    try:
        with _conn.cursor() as cur:
            cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
            _conn.commit()
            return cur.rowcount > 0
    except Exception as e:
        _conn.rollback()
        logger.exception("Error deleting user: %s", e)
        return False


def update_user_role(user_id: int, role: str) -> Optional[dict]:
    """Update a user's role (admin only)."""
    try:
        with _conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET role = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s "
                "RETURNING id, name, email, role, avatar_url, created_at",
                (role, user_id)
            )
            row = cur.fetchone()
            _conn.commit()
            if not row:
                return None
            return {
                "id": row[0], "name": row[1], "email": row[2],
                "role": row[3], "avatar_url": row[4], "created_at": str(row[5]),
            }
    except Exception as e:
        _conn.rollback()
        logger.exception("Error updating role: %s", e)
        return None


# ------------------------------------------------
# JWT helpers
# ------------------------------------------------
def generate_token(user: dict) -> str:
    """Create a signed JWT for the given user."""
    payload = {
        "user_id": user["id"],
        "email": user["email"],
        "role": user["role"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRY_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def decode_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT. Returns the payload or None."""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        logger.warning("Token expired")
        return None
    except jwt.InvalidTokenError:
        logger.warning("Invalid token")
        return None


# ------------------------------------------------
# Decorators
# ------------------------------------------------
def require_auth(f):
    """Flask route decorator that enforces JWT authentication."""

    if inspect.iscoroutinefunction(f):
        @wraps(f)
        async def decorated_async(*args, **kwargs):
            if not AUTH_REQUIRED:
                return await f(*args, **kwargs)

            auth_header = request.headers.get("Authorization", "")
            if not auth_header.startswith("Bearer "):
                return jsonify({"status": "error", "data": None, "message": "Missing or invalid Authorization header"}), 401

            token = auth_header.split(" ", 1)[1]
            payload = decode_token(token)
            if payload is None:
                return jsonify({"status": "error", "data": None, "message": "Invalid or expired token"}), 401

            request.user = payload
            return await f(*args, **kwargs)
        return decorated_async
    else:
        @wraps(f)
        def decorated_sync(*args, **kwargs):
            if not AUTH_REQUIRED:
                return f(*args, **kwargs)

            auth_header = request.headers.get("Authorization", "")
            if not auth_header.startswith("Bearer "):
                return jsonify({"status": "error", "data": None, "message": "Missing or invalid Authorization header"}), 401

            token = auth_header.split(" ", 1)[1]
            payload = decode_token(token)
            if payload is None:
                return jsonify({"status": "error", "data": None, "message": "Invalid or expired token"}), 401

            request.user = payload
            return f(*args, **kwargs)
        return decorated_sync


def require_admin(f):
    """Flask route decorator that enforces admin role."""

    @wraps(f)
    def decorated(*args, **kwargs):
        if not AUTH_REQUIRED:
            return f(*args, **kwargs)

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"status": "error", "data": None, "message": "Missing or invalid Authorization header"}), 401

        token = auth_header.split(" ", 1)[1]
        payload = decode_token(token)
        if payload is None:
            return jsonify({"status": "error", "data": None, "message": "Invalid or expired token"}), 401

        if payload.get("role") != "admin":
            return jsonify({"status": "error", "data": None, "message": "Admin access required"}), 403

        request.user = payload
        return f(*args, **kwargs)
    return decorated
