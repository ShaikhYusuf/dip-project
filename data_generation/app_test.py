from langchain_core.prompts import PromptTemplate

prompt = PromptTemplate.from_template(
    "Explain {topic}"
)

print(prompt.format(topic="Operating Systems"))