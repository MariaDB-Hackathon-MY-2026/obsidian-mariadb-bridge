from sentence_transformers import SentenceTransformer
import re

# Use a lightweight model for fast embeddings
MODEL_NAME = 'all-MiniLM-L6-v2'
model = None

def get_model():
    global model
    if model is None:
        model = SentenceTransformer(MODEL_NAME)
    return model

def vectorize(text):
    """Convert text into a 384-dimensional vector."""
    m = get_model()
    # SentenceTransformers returns a numpy array
    embedding = m.encode(text)
    return embedding.tolist()

def get_chunks(text, chunk_size=1000, overlap=100):
    """Split text into smaller overlapping chunks for indexing."""
    # Clean up multiple spaces and newlines
    text = re.sub(r'\s+', ' ', text).strip()
    
    if not text:
        return []
        
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += (chunk_size - overlap)
    return chunks
