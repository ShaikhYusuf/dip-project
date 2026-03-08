import requests

path="L1.S1.P1"

def fetch_lesson_content(sub_url, path):
    url = f'http://127.0.0.1:5000/{sub_url}?path={path}'
    response = requests.get(url)
    
    if response.status_code == 200:
        lesson_content = response.json()
        print("Lesson Content:", lesson_content)
    else:
        print("Error fetching lesson content:", response.json())

if __name__ == "__main__":
    fetch_lesson_content("lesson", path)
    fetch_lesson_content("quizzes", path)
    fetch_lesson_content("truefalses", path)
    fetch_lesson_content("shortquestions", path)
