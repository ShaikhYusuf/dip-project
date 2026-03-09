import atexit
import json
import asyncio
import sys

from langchain_ollama import OllamaLLM


from lib.x0_data_ingestor import DataIngestor
from lib.x0_utility import Utility
from lib.x10_lesson_store import MyLessonStore
from lib.x11_lesson_content import MyLessonContent
from lib.x12_lesson_match_column import MyLessonMatchColumn
from lib.x13_lesson_quiz import MyLessonQuiz
from lib.x14_lesson_short_question import MyLessonShortQuestion
from lib.x15_lesson_truefalse import MyLessonTrueFalse

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


def initialize_store_app():
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
    llm = OllamaLLM(model=model_name, format="json", temperature=0)

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

async def get_and_store_information():
    with open("operating_systems_book.json", "r") as f:
        json_data = json.load(f)
        MyLessonStore.insert_data_df(json_data)

    sectionList  = MyLessonStore.read_all_section_db()
    for section in sectionList:
        if section == sectionList[2]:
            await MyLessonStore.generate_contents(section.path, section.content)
            break


if __name__ == "__main__":
    initialize_store_app()
    asyncio.run(get_and_store_information())