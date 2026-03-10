import json
import logging
from graph import build_graph

logging.basicConfig(level=logging.INFO)

graph = build_graph()
topic = "Operating Systems"
result = graph.invoke({
    "topic": topic
})
book = result["book"]
with open("os_book.json", "w") as f:
    json.dump(book, f, indent=2)

print("Book generated!")