import json

from lib.x11_lesson_content import MyLessonContent
from lib.x12_lesson_match_column import MyLessonMatchColumn
from lib.x13_lesson_quiz import MyLessonQuiz
from lib.x14_lesson_short_question import MyLessonShortQuestion
from lib.x15_lesson_truefalse import MyLessonTrueFalse

class LLM_Wrappper:
    
    @classmethod
    def initialize(cls, llm, conn):
        cls.llm = llm
        cls.conn = conn
        
    @classmethod
    async def generate_contents(cls, 
                            path: str, 
                            input_content_text: str
                            ) -> str:
        content = MyLessonContent()
        content.initialize(cls.llm, cls.conn)
        content_response = await content.generate_contents(
            path, 
            input_content_text)
        
        response = await content.generate_response(path)
        print("Lesson Content Response:", response)
        
        content_quiz = MyLessonQuiz()
        content_quiz.initialize(cls.llm, cls.conn)
        content_quiz_response = await content_quiz.generate_contents(
            path, 
            input_content_text)
        response = await content_quiz.generate_response(path)
        print("Lesson Quiz Response:", response)
        
        content_shortquestion = MyLessonShortQuestion()
        content_shortquestion.initialize(cls.llm, cls.conn)
        content_shortquestion_response = await content_shortquestion.generate_contents(
            path, 
            input_content_text)
        response = await content_shortquestion.generate_response(path)
        print("Lesson Short Question Response:", response)
        
        content_true_false = MyLessonTrueFalse()
        content_true_false.initialize(cls.llm, cls.conn)
        content_shortquestion_response = await content_true_false.generate_contents(
            path, 
            input_content_text)
        response = await content_true_false.generate_response(path)
        print("Lesson True/False Response:", response)
        
    async def play_content (cls,
                            path: str):
        pass