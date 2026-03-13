import requests

path="L1.S1.P1"

def compare_text_to_embedding(text, embedding):
    url = 'http://127.0.0.1:5000/api/lessons/compare'
    payload = {'text': text, 'embedding': embedding}
    response = requests.post(url, json=payload)
    return response

def fetch_lesson_content(sub_url, path= None):
    if path is None:
        url = f'http://127.0.0.1:5000/api/lessons/{sub_url}'
    else:
        url = f'http://127.0.0.1:5000/api/lessons/{sub_url}?path={path}'
    response = requests.get(url)
    if response.status_code == 200:
        lesson_content = response.json()
        print("Lesson Content:", lesson_content)
    else:
        print("Error fetching lesson content:", response.json())
    return response

if __name__ == "__main__":
    #fetch_lesson_content("content", path)
    # response = fetch_lesson_content("quizzes", path)
    # if response:
    #     quiz_set = response.json()
    #     question_list = quiz_set['data']['questions']
    #     for quiz in question_list:
    #         answer = quiz['answer']
    #         answer_embedding = quiz['answer_embedding']
    #         response = compare_text_to_embedding(answer, answer_embedding)
    #         print (response.json())
    #fetch_lesson_content("truefalse", path)
    #fetch_lesson_content("shortquestions", path)
    fetch_lesson_content("hierarchy")

