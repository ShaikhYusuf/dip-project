import json
import random
from typing import Dict, Optional, List
from pydantic import BaseModel, Field, field_validator
from langchain.output_parsers import PydanticOutputParser
from langchain.prompts import PromptTemplate

#------------------- Match the Column Template ------------------#
MATCHING_PROMPT_TEMPLATE = """
You are an expert tutor. From the paragraph below, extract exactly 5 pairs of related terms and their descriptions for a 'Match the Column' exercise.

Instructions:
1. Column A (left_item) should contain a key term or concept.
2. Column B (right_item) should contain its corresponding definition or explanation.
3. Ensure the pairs are distinct and directly supported by the text.

Paragraph:
{paragraph}

{format_instructions}
"""

#------------------- Matching Quiz Data Model ------------------#
class MatchingPair(BaseModel):
    left_item: str = Field(description="The item in Column A (the term).")
    right_item: str = Field(description="The matching item in Column B (the definition/description).")

class MatchingMatchColumns(BaseModel):
    # 'pairs' is used for initial LLM generation
    pairs: List[MatchingPair] = Field(default=[], description="List of matching pairs.")
    
    # 'column_a' and 'column_b' are the source of truth stored in DB
    column_a: List[str] = Field(default=[], description="Ordered list of left items.")
    column_b: List[str] = Field(default=[], description="Ordered list of right items.")
    
    # These are populated only for the UI/App logic
    display_a: List[str] = Field(default=[], description="Shuffled list for UI.")
    display_b: List[str] = Field(default=[], description="Shuffled list for UI.")
    correct_mapping: Dict[str, str] = Field(default={}, description="Mapping for grading.")

    @field_validator('pairs', mode='before')
    @classmethod
    def check_min_pairs(cls, v):
        if v and len(v) < 5:
            raise ValueError("You must provide at least 5 matching pairs.")
        return v
    
class MyLessonMatchColumn():
    table_name = "matching_quizzes_ordered"
    llm = None
    conn = None

    @classmethod
    def initialize(cls, llm, conn):
        cls.llm = llm
        cls.conn = conn

    @classmethod
    def generate_contents(cls, llm, path, input_content_text) -> MatchingMatchColumns:
        parser = PydanticOutputParser(pydantic_object=MatchingMatchColumns)
        prompt = PromptTemplate(
            template=MATCHING_PROMPT_TEMPLATE,
            input_variables=["paragraph"],
            partial_variables={"format_instructions": parser.get_format_instructions()}
        )
        query_chain = prompt | llm | parser
        response = query_chain.invoke({"paragraph": input_content_text})
        
        # Populate ordered columns from pairs
        response.column_a = [p.left_item for p in response.pairs]
        response.column_b = [p.right_item for p in response.pairs]
        
        cls.insert_data_db(
            conn=cls.conn, 
            path=path,
            data=response)
        
        return response

    @classmethod
    def insert_data_db(cls, conn, path: str, data: MatchingMatchColumns):
        create_table_query = f"""
        CREATE TABLE IF NOT EXISTS {cls.table_name} (
            id SERIAL PRIMARY KEY,
            path TEXT UNIQUE,
            column_a JSONB,
            column_b JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
        upsert_query = f"""
        INSERT INTO {cls.table_name} (path, column_a, column_b)
        VALUES (%s, %s, %s)
        ON CONFLICT (path) 
        DO UPDATE SET 
            column_a = EXCLUDED.column_a,
            column_b = EXCLUDED.column_b;
        """
        # Store raw lists. JSONB preserves index order.
        values = (path, json.dumps(data.column_a), json.dumps(data.column_b))

        try:
            with conn.cursor() as cur:
                cur.execute(create_table_query)
                cur.execute(upsert_query, values)
                conn.commit()
        except Exception as e:
            conn.rollback()
            print(f"Error saving quiz: {e}")

    @classmethod
    def read_from_db(cls, conn, path: str) -> Optional[MatchingMatchColumns]:
        query = f"SELECT column_a, column_b FROM {cls.table_name} WHERE path = %s"
        
        try:
            with conn.cursor() as cur:
                cur.execute(query, (path,))
                row = cur.fetchone()
                if not row: return None
                
                # Reconstruct object from JSONB columns
                quiz = MatchingMatchColumns(
                    column_a=row[0],
                    column_b=row[1]
                )
                
                # 1. Create the mapping (Index-based pairing)
                quiz.correct_mapping = dict(zip(quiz.column_a, quiz.column_b))
                
                # 2. Prepare display versions (Shuffled)
                quiz.display_a = list(quiz.column_a)
                quiz.display_b = list(quiz.column_b)
                random.shuffle(quiz.display_a)
                random.shuffle(quiz.display_b)
                
                return quiz
        except Exception as e:
            print(f"Error reading quiz: {e}")
            return None