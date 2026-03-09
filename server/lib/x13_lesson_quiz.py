import json
import numpy as np
import json
import re

from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
from langchain.output_parsers import PydanticOutputParser
from langchain_core.exceptions import OutputParserException
from langchain.prompts import PromptTemplate

from lib.x0_utility import Utility

#------------------- Quiz Template ------------------#
QUIZ_PROMPT_TEMPLATE = """
You are an expert educator. Based on the paragraph provided below, create a high-quality multiple-choice quiz.

Instructions:
1. Create **exactly 5** challenging but fair questions based ONLY on the paragraph.
2. For each question, provide exactly 4 distinct options.
3. Identify the correct answer for each question.
4. Provide a student-friendly explanation for each answer.

Paragraph:
{paragraph}

{format_instructions}
"""

# ------------------- Quiz Data Model ------------------#
class Quiz(BaseModel):
    question: str = Field(description="The multiple-choice question text.")
    options: List[str] = Field(
        description="A list of exactly 4 options.", 
        min_items=4, 
        max_items=4
    )
    answer: str = Field(description="The correct option string from the options list.")
    answer_embedding: Optional[List[float]] = Field(default=None, description="The embedding vector of the correct answer.")
    explanation: str = Field(description="A brief explanation of why the answer is correct.")

class QuizSet(BaseModel):
    questions: List[Quiz] = Field(description="A list of quiz questions.")
    @field_validator('questions')
    @classmethod
    def check_count(cls, v):
        if len(v) < 5:
            raise ValueError("The set must contain at least 5 questions.")
        return v

class MyLessonQuiz():
    table_name = "multiple_choice_quizzes"
    llm = None
    conn = None

    @staticmethod
    def _sanitize_parsed_quiz(raw_dict: dict) -> dict:
        """Fix common format issues from model output before validation."""
        if not raw_dict or "questions" not in raw_dict:
            return raw_dict

        for q in raw_dict.get("questions", []):
            opts = q.get("options")
            if isinstance(opts, list) and len(opts) > 4:
                # Some models append stray tokens (e.g. 'answer”: ') into the options list.
                q["options"] = opts[:4]

        return raw_dict

    @staticmethod
    def _extract_json_from_error(e: Exception) -> Optional[dict]:
        """Try to salvage JSON-like payload from a parsing exception message."""
        text = str(e)
        m = re.search(r"(\{.*\})", text, re.DOTALL)
        if not m:
            return None
        json_text = m.group(1)
        try:
            return json.loads(json_text)
        except json.JSONDecodeError:
            return None

    @classmethod
    def initialize(cls, llm, conn):
        cls.llm = llm
        cls.conn = conn

    @classmethod
    async def generate_contents(cls, path, input_content_text) -> QuizSet:
        parser = PydanticOutputParser(pydantic_object=QuizSet)
        prompt = PromptTemplate(
            template=QUIZ_PROMPT_TEMPLATE,
            input_variables=["paragraph"],
            partial_variables={"format_instructions": parser.get_format_instructions()}
        )

        # Assuming cls.llm is already initialized as shown in previous turns
        chain = prompt | cls.llm | parser

        max_attempts = 3
        response = None
        for attempt in range(1, max_attempts + 1):
            try:
                response = chain.invoke({"paragraph": input_content_text})
                break
            except OutputParserException as e:
                # If the model produced fewer than the required number of questions,
                # retry with stronger instructions.
                if "must contain at least 5 questions" in str(e) and attempt < max_attempts:
                    reinforced_template = QUIZ_PROMPT_TEMPLATE + "\n\nIMPORTANT: Your response MUST include exactly 5 questions in the 'questions' list."
                    prompt = PromptTemplate(
                        template=reinforced_template,
                        input_variables=["paragraph"],
                        partial_variables={"format_instructions": parser.get_format_instructions()}
                    )
                    chain = prompt | cls.llm | parser
                    continue

                # Attempt to recover from common parsing issues (e.g., extra tokens in options).
                raw_json = cls._extract_json_from_error(e)
                if raw_json:
                    raw_json = cls._sanitize_parsed_quiz(raw_json)
                    try:
                        response = QuizSet(**raw_json)
                        break
                    except Exception:
                        pass

                # If we can't recover, raise to surface the parsing issue.
                raise

        if response is None:
            raise RuntimeError("Failed to generate quiz after multiple attempts.")

        for question in response.questions:
            embeddings = Utility.convert_text_to_embedding(question.answer)
            question.answer_embedding = embeddings.tolist()

        cls.insert_data_db(
            path=path,
            data=response)

        return response

    @classmethod
    async def generate_response(cls, path) -> Optional[QuizSet]:
        quiz_set = cls.read_from_db(path)
        return quiz_set    

    @classmethod
    def insert_data_db(cls, path: str, data: QuizSet):
        create_table_query = f"""
        CREATE TABLE IF NOT EXISTS {cls.table_name} (
            id SERIAL PRIMARY KEY,
            path TEXT UNIQUE,
            questions_json JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """

        upsert_query = f"""
        INSERT INTO {cls.table_name} (path, questions_json)
        VALUES (%s, %s)
        ON CONFLICT (path) 
        DO UPDATE SET 
            questions_json = EXCLUDED.questions_json;
        """

        # model_dump() handles the serialization of the float list automatically
        questions_data = [q.model_dump() for q in data.questions]

        # Using json.dumps ensures the float precision is handled correctly for JSONB
        values = (path, json.dumps(questions_data))

        try:
            with cls.conn.cursor() as cur:
                cur.execute(create_table_query)
                cur.execute(upsert_query, values)
                cls.conn.commit()
                print(f"Successfully saved Quiz: {path}")
        except Exception as e:
            cls.conn.rollback()
            print(f"Error saving Quiz: {e}")

    @classmethod
    def read_from_db(cls, path: str) -> Optional[QuizSet]:
        query = f"SELECT questions_json FROM {cls.table_name} WHERE path = %s"
        
        try:
            with cls.conn.cursor() as cur:
                cur.execute(query, (path,))
                row = cur.fetchone()

                if not row:
                    return None

                questions_json = row[0]

                # Reconstruct the Quiz object from the stored JSON list
                # This will automatically trigger the check_count validator
                return QuizSet(
                    questions=[Quiz(**q) for q in questions_json]
                )
        except Exception as e:
            print(f"Error reading Quiz: {e}")
            return None