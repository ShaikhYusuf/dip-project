import os
from os import path
import tempfile

from sentence_transformers import SentenceTransformer, util


class Utility:
    embed_model = SentenceTransformer('all-MiniLM-L6-v2') 
                
    @classmethod
    def convert_text_to_embedding(cls, text, convert_to_tensor: bool = False):
        """Return an embedding for the given text.

        By default this returns a plain Python list of floats (safe for JSON).
        Set ``convert_to_tensor=True`` when you need a torch tensor for similarity.
        """
        embedding = cls.embed_model.encode(text, convert_to_tensor=convert_to_tensor)
        return embedding

    @classmethod
    def compare_text_to_embeddings(cls, embedding, text):
        import torch
        text_embedding = cls.embed_model.encode(text, convert_to_tensor=True)
        # Convert embedding to tensor with same dtype as text_embedding
        if not isinstance(embedding, torch.Tensor):
            embedding = torch.tensor(embedding, dtype=text_embedding.dtype)
        else:
            embedding = embedding.to(dtype=text_embedding.dtype)
        cosine_score = util.cos_sim(embedding, text_embedding).item()
        print(f"Match Score: {cosine_score:.2f}")

        # Determine Result (Threshold 0.75-0.8 is usually safe)
        return cosine_score > 0.8