import os
import json
import time
import argparse
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

def upload_to_gemini(path, mime_type=None):
    print(f"⬆️ Uploading '{path}' to Gemini File API...")
    file = genai.upload_file(path, mime_type=mime_type)
    print(f"✅ Uploaded as: {file.uri}")
    return file

def wait_for_files_active(files):
    print("⏳ Waiting for file processing...")
    for name in (file.name for file in files):
        file = genai.get_file(name)
        while file.state.name == "PROCESSING":
            print(".", end="", flush=True)
            time.sleep(5)
            file = genai.get_file(name)
        if file.state.name != "ACTIVE":
            raise Exception(f"File {file.name} failed to process")
    print("\n✅ Files ready.")

def generate_embeddings(chunks: list):
    print(f"🧠 Vectorizing {len(chunks)} chunks using gemini-embedding-001...")
    batch_size = 100
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i+batch_size]
        texts_to_embed = [
            f"Subject: {c.get('subject', '')}. Topic: {c.get('topic', '')}. Concept: {c.get('content', '')}"
            for c in batch
        ]
        try:
            response = genai.embed_content(
                model="models/gemini-embedding-001",
                content=texts_to_embed,
                task_type="retrieval_document"
            )
            for j, embedding in enumerate(response['embedding']):
                batch[j]["embedding"] = list(embedding)[:1536]
            print(f"  Vectorized {min(i+batch_size, len(chunks))}/{len(chunks)}...")
        except Exception as e:
            print(f"❌ Embedding failed for batch: {e}")

def extract_chunks(pdf_path, subject):
    gemini_file = upload_to_gemini(pdf_path, mime_type="application/pdf")
    wait_for_files_active([gemini_file])

    generation_config = {
        "temperature": 0.1,
        "response_mime_type": "application/json",
    }

    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        generation_config=generation_config,
    )

    prompt = f"""
    You are an expert AI extraction system for the educational platform Quizant.
    Your task is to parse this uploaded '{subject}' document (which could be a syllabus, textbook remix, or novel).

    Extract the core concepts, plot points, facts, and rules into atomic, independent chunks of text.
    Each chunk MUST:
    1. Be highly dense with information.
    2. Range from 2 to 4 sentences.
    3. Cover exactly one specific rule, theory, plot event, or broad concept.

    Return the output STRICTLY as a JSON array of objects with the following keys:
    [
        {{
            "topic": "The exact topic name or chapter title",
            "content": "The dense conceptual paragraph."
        }}
    ]

    Extract as many high-quality chunks as you can find in the entire document. Do not truncate.
    """

    print("🤖 Prompting Gemini for semantic chunks extraction...")
    try:
        response = model.generate_content([gemini_file, prompt])
        genai.delete_file(gemini_file.name)
        
        raw_text = response.text.strip()
        data = json.loads(raw_text)
        print(f"✅ Extracted {len(data)} conceptual chunks.")
        
        for item in data:
            item["subject"] = subject
            item["metadata"] = {"source": os.path.basename(pdf_path)}
            
        return data
    except Exception as e:
        print(f"❌ Extraction failed: {e}")
        try:
            genai.delete_file(gemini_file.name)
        except:
            pass
        return []

def main():
    parser = argparse.ArgumentParser(description="Ingest Jam Syllabus/Novel PDF into Knowledge Base")
    parser.add_argument("--pdf", required=True, help="Path to PDF file")
    parser.add_argument("--subject", required=True, help="Subject name (e.g., 'Chemistry', 'Use of English')")
    args = parser.parse_args()

    pdf_path = args.pdf
    subject = args.subject

    if not os.path.exists(pdf_path):
        print(f"File not found: {pdf_path}")
        return

    print("="*60)
    print(f"📖 Ingesting Knowledge Base: {subject}")
    print(f"📄 File: {pdf_path}")
    print("="*60)

    chunks = extract_chunks(pdf_path, subject)
    if not chunks:
        print("No chunks extracted.")
        return

    generate_embeddings(chunks)

    print(f"💾 Inserting {len(chunks)} chunks to Supabase...")
    batch_size = 50
    inserted = 0
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i+batch_size]
        try:
            res = supabase.table("knowledge_base").insert(batch).execute()
            inserted += len(res.data)
            print(f"  Inserted {inserted}/{len(chunks)}...")
        except Exception as e:
            print(f"❌ Error inserting batch: {e}")

    print(f"🎉 Done! Inserted {inserted} chunks for {subject}.")

if __name__ == "__main__":
    main()
