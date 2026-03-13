# Server Installation
## Create environment and activate it
python -m venv .env
source ./.env/Scripts/activate

## upgrade pip and install dependencies
python -m pip install --upgrade pip
pip install -r requirements.txt

## start server
python app.py

# Server Maintenance

### Taking the backup of the server

    #### In the dump format
    pg_dump -U postgres -h localhost -d postgres -n public -F c -f backup.dump

    #### In the text format
    pg_dump -U postgres -h localhost -d postgres \
    -t lesson_contents \
    -t lesson_hierarchy \
    -t lesson_scores \
    -t lesson_sections \
    -t multiple_choice_quizzes \
    -t short_answer_questions \
    -t true_false_questions \
    -f ./database_backup/backup.sql

### Restore Into Another Machine
    #### Create database
        createdb -U postgres newdb

    #### Restore
        ##### In the dump format        
        pg_restore -U postgres -h localhost -d newdb backup.dump

        ##### In the text format
        psql -U postgres -h localhost -d newlesson -W -f ./database_backup/backup.sql

