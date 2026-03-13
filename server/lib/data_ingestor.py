import psycopg2
import json
from sentence_transformers import SentenceTransformer

class DataIngestor:
    def __init__(self, db_config):
        # Initialize DB connection
        self.conn = psycopg2.connect(**db_config)

        # Initialize Embedding Model (matches pgvector dimensions)
        # self.model = SentenceTransformer('all-MiniLM-L6-v2') 

    # def generate_embedding(self, text: str):
    #     """Creates a vector representation of the text."""
    #     return self.model.encode(text).tolist()

    def get_connection(self):
        return self.conn
    
    def close(self):
        self.conn.close()
