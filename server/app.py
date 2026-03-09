import atexit
import json
import asyncio
import sys
import sys
from langchain_ollama import OllamaLLM
from flask import Flask, jsonify, request
from flask_cors import CORS
import numpy as np

from lib.x0_data_ingestor import DataIngestor
from lib.x0_utility import Utility
from lib.x10_lesson_store import MyLessonStore
from lib.x11_lesson_content import MyLessonContent
from lib.x13_lesson_quiz import MyLessonQuiz
from lib.x14_lesson_short_question import MyLessonShortQuestion
from lib.x15_lesson_truefalse import MyLessonTrueFalse

app = Flask(__name__)
CORS(app) # Enables CORS for all routes

# Global variable to hold the ingestor for cleanup
_ingestor = None

def cleanup():
    """Closes the database connection on exit."""
    global _ingestor
    if _ingestor:
        print("\nClosing database connection...")
        _ingestor.close()
        print("Cleanup complete.")

def signal_handler(sig, frame):
    """Handles manual termination (Ctrl+C)."""
    sys.exit(0)

# Register exit handlers
atexit.register(cleanup)


def initialize_app():
    """Initializes global dependencies and lesson classes."""
    db_params = {
        "dbname": "postgres",
        "user": "postgres",
        "password": "postgres",
        "host": "localhost"
    }
    
    # Setup Data and LLM
    global _ingestor
    _ingestor = DataIngestor(db_params)
    conn = _ingestor.get_connection()
    model_name = "ministral-3:3b"
    llm = None # OllamaLLM(model=model_name, format="json", temperature=0)

    # Initialize all lesson classes
    classes_to_init = [
        MyLessonStore,
        MyLessonContent, 
        MyLessonQuiz, 
        MyLessonShortQuestion, 
        MyLessonTrueFalse
    ]
    
    for cls in classes_to_init:
        cls.initialize(llm, conn)
    
    return conn # Keep a reference if needed for cleanup

@app.route('/lesson', methods=['GET'])
async def get_lesson_content():
    path = request.args.get('path')
    lesson_content = await MyLessonContent.generate_response(path)
    if lesson_content:
        return jsonify(lesson_content.model_dump()), 200
    return jsonify({"error": "Content not found"}), 404

@app.route('/quizzes', methods=['GET'])
async def get_lesson_quiz():
    path = request.args.get('path')
    lesson_quiz_set = await MyLessonQuiz.generate_response(path)
    if lesson_quiz_set:
        return jsonify(lesson_quiz_set.model_dump()), 200
    return jsonify({"error": "Content not found"}), 404

@app.route('/truefalses', methods=['GET'])
async def get_lesson_true_false():
    path = request.args.get('path')
    lesson_true_false_set = await MyLessonTrueFalse.generate_response(path)
    if lesson_true_false_set:
        return jsonify(lesson_true_false_set.model_dump()), 200
    return jsonify({"error": "Content not found"}), 404

@app.route('/shortquestions', methods=['GET'])
async def get_lesson_short_questions():
    path = request.args.get('path')
    lesson_short_questions_set = await MyLessonShortQuestion.generate_response(path)
    if lesson_short_questions_set:
        return jsonify(lesson_short_questions_set.model_dump()), 200
    return jsonify({"error": "Content not found"}), 404

@app.route("/compare_text_to_embedding", methods=["POST"])
def compare_text_to_embedding():
    data = request.get_json()
    text = data.get("text")
    embedding_list = data.get("embedding")
    if text is None or embedding_list is None:
        return jsonify({"error": "text and embedding are required"}), 400
    embedding = np.array(embedding_list)
    result = Utility.compare_text_to_embeddings(embedding, text)
    return jsonify({
        "match": bool(result)
    })

@app.route('/lesson_hierarchy', methods=['GET'])
def get_lesson_hierarchy():
    try:
        hierarchy = MyLessonStore.read_hierarchy_with_scores()
        return jsonify([
            h.model_dump() for h in hierarchy
        ]), 200

    except Exception as e:
        return jsonify({
            "error": str(e)
        }), 500

@app.route('/update_scores', methods=['POST'])
def update_scores():
    try:
        data = request.get_json()
        path = data.get('path')
        
        if not path:
            return jsonify({"error": "path is required"}), 400
        
        results = {}
        score_fields = ['quiz_score', 'truefalse_score', 'short_question_score']
        if not any(field in data for field in score_fields):
            return jsonify({"error": "No scores to update"}), 400
        
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
            return jsonify({"error": "No scores to update"}), 400
        
        return jsonify({"message": "Scores updated successfully", "updated": results}), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    initialize_app()
    # asyncio.run(get_and_store_information(LLM_Wrappper, db_params))
    print ("Starting Flask server...at port 5000")
    app.run(debug=True, port=5000)
    
