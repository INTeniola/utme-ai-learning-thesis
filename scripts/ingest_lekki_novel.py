import os
import json
import time
import argparse
from typing import List, Dict
import google.generativeai as genai
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(".env")
load_dotenv(".env.local")

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing Supabase credentials in .env")

GEMINI_KEY = os.getenv("VITE_GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY")
if not GEMINI_KEY:
    raise ValueError("Missing Gemini API Key in .env")

genai.configure(api_key=GEMINI_KEY)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def upload_novel_page_by_page(pdf_path: str, subject: str):
    print(f"⬆️ Uploading '{pdf_path}' to Gemini File API...")
    try:
        gemini_file = genai.upload_file(pdf_path, mime_type="application/pdf")
        while gemini_file.state.name == "PROCESSING":
            print(".", end="", flush=True)
            time.sleep(2)
            gemini_file = genai.get_file(gemini_file.name)
        
        if gemini_file.state.name != "ACTIVE":
             raise RuntimeError(f"File failed to process: {gemini_file.name}")
             
        print(f"\n✅ Uploaded. Processing story architecture...")
        
        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            generation_config={"temperature": 0.2, "response_mime_type": "application/json"}
        )
        
        # We ask Gemini to extract the overarching narrative in massive detail
        prompt = f"""
        You are an expert literary analyzer for an educational platform. 
        Read this entire novel and extract the plot points, character biographies, themes, 
        and key events into isolated "Knowledge Chunks".
        
        Each chunk must be a dense paragraph (3-4 sentences) explaining ONE specific aspect of the book. 
        Extract at least 50-100 high-quality chunks covering the beginning, middle, and end.
        
        Output STRICTLY as a JSON array of objects:
        [
            {{
                "topic": "Character: Mr. Headmaster (or specific chapter/theme)",
                "content": "Detailed explanation of this character, event, or theme."
            }}
        ]
        """
        
        response = model.generate_content([gemini_file, prompt])
        genai.delete_file(gemini_file.name)
        
        raw_text = response.text.strip()
        data = json.loads(raw_text)
        print(f"✅ Extracted {len(data)} plot chunks.")
        
        chunks = []
        for item in data:
            chunks.append({
                "subject": subject,
                "topic": f"The Lekki Headmaster - {item.get('topic', 'General Story')}",
                "content": item.get('content', ''),
                "source_type": "Novel",
                "metadata": {"source": "THE-LEKKI-HEADMASTER.pdf"}
            })
        
        return chunks
        
    except Exception as e:
        print(f"❌ Extraction failed: {e}")
        return []

def embed_and_upload(chunks: List[Dict]):
    if not chunks:
        return
        
    print(f"🧠 Vectorizing {len(chunks)} chunks...")
    texts_to_embed = [f"Novel: The Lekki Headmaster. Topic: {c['topic']}. Context: {c['content']}" for c in chunks]
    
    try:
        response = genai.embed_content(
            model="models/gemini-embedding-001",
            content=texts_to_embed,
            task_type="retrieval_document"
        )
        
        for j, embedding in enumerate(response['embedding']):
            chunks[j]["embedding"] = list(embedding)[:1536]
            
        print("💾 Inserting into Supabase Knowledge Base...")
        res = supabase.table("knowledge_base").insert(chunks).execute()
        print(f"🎉 Success! Inserted {len(res.data)} story chunks into the database.")
    except Exception as e:
        print(f"❌ Insertion failed: {e}")


if __name__ == "__main__":
    chunks = upload_novel_page_by_page("THE-LEKKI-HEADMASTER.pdf", "Literature in English")
    embed_and_upload(chunks)
