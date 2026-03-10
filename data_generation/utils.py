def extract_sections(structure):
    sections = []

    for node in structure:
        if "-S" in node["id"] and "-SS" not in node["id"]:
            sections.append(node)

    return sections


def merge_book(structure, paragraphs):

    book = []

    book.extend(structure)
    book.extend(paragraphs)

    return book