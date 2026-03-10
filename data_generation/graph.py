import json
from typing import TypedDict, List, Dict

from langgraph.graph import StateGraph

from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser

from langchain_ollama import ChatOllama

from schemas import *
from prompts import *
from utils import *

model_name = "ministral-3:3b"
llm = ChatOllama(model=model_name)


class BookState(TypedDict, total=False):

    topic: str
    lessons: List[str]
    structure: List[Dict]
    paragraphs: List[Dict]
    book: List[Dict]


# -------------------
# Planner Node
# -------------------

def planner(state: BookState):

    parser = JsonOutputParser(pydantic_object=PlannerOutput)

    prompt = PromptTemplate(
        template=PLANNER_PROMPT,
        input_variables=["topic"],
        partial_variables={
            "format_instructions": parser.get_format_instructions()
        },
    )

    chain = prompt | llm | parser

    result = chain.invoke({
        "topic": state["topic"]
    })

    state["lessons"] = result["lessons"]

    return state


# -------------------
# Structure Generator
# -------------------

def generate_structure(state: BookState):

    parser = JsonOutputParser(pydantic_object=StructureOutput)

    prompt = PromptTemplate(
        template=STRUCTURE_PROMPT,
        input_variables=["topic", "lessons"],
        partial_variables={
            "format_instructions": parser.get_format_instructions()
        },
    )

    chain = prompt | llm | parser

    result = chain.invoke({
        "topic": state["topic"],
        "lessons": state["lessons"]
    })

    nodes = []

    for n in result["nodes"]:
        nodes.append({
            "id": n["id"],
            "content": n["content"]
        })

    state["structure"] = nodes

    print("STRUCTURE RESULT:", result)
    return state


# -------------------
# Paragraph Generator
# -------------------

def expand_sections(state: BookState):

    parser = JsonOutputParser(pydantic_object=ParagraphOutput)

    prompt = PromptTemplate(
        template=PARAGRAPH_PROMPT,
        input_variables=["section_id", "section_title"],
        partial_variables={
            "format_instructions": parser.get_format_instructions()
        },
    )

    chain = prompt | llm | parser

    sections = extract_sections(state["structure"])

    paragraphs = []

    for sec in sections:

        result = chain.invoke({
            "section_id": sec["id"],
            "section_title": sec["content"]
        })

        for p in result["paragraphs"]:
            paragraphs.append({
                "id": p["id"],
                "content": p["content"]
            })

    state["paragraphs"] = paragraphs

    return state


# -------------------
# Merge Node
# -------------------

def merge(state: BookState):

    state["book"] = merge_book(
        state["structure"],
        state["paragraphs"]
    )

    return state


# -------------------
# Build Graph
# -------------------

def build_graph():

    graph = StateGraph(BookState)

    graph.add_node("planner", planner)
    graph.add_node("structure", generate_structure)
    graph.add_node("expand", expand_sections)
    graph.add_node("merge", merge)

    graph.set_entry_point("planner")

    graph.add_edge("planner", "structure")
    graph.add_edge("structure", "expand")
    graph.add_edge("expand", "merge")

    return graph.compile()