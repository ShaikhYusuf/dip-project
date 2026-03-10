from pydantic import BaseModel
from typing import List

class PlannerOutput(BaseModel):
    topic: str
    lessons: List[str]

class StructureNode(BaseModel):
    id: str
    content: str

class StructureOutput(BaseModel):
    nodes: List[StructureNode]

class ParagraphNode(BaseModel):
    id: str
    content: str

class ParagraphOutput(BaseModel):
    paragraphs: List[ParagraphNode]
