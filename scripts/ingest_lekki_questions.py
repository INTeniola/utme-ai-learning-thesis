import os
import json
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

def generate_embeddings(questions: list):
    print(f"🧠 Vectorizing {len(questions)} questions using gemini-embedding-001...")
    chunk_size = 100
    for i in range(0, len(questions), chunk_size):
        chunk = questions[i:i+chunk_size]
        texts_to_embed = []
        for q in chunk:
            payload = (
                f"Subject: {q.get('subject', 'Unknown')}. Topic: {q.get('topic', 'General')}. Year: {q.get('year', 'Unknown')}. "
                f"Question: {q.get('question_text', '')} Options: A) {q.get('option_a', '')} B) {q.get('option_b', '')} C) {q.get('option_c', '')} D) {q.get('option_d', '')} "
                f"Answer: {q.get('correct_option', '')} Explanation: {q.get('explanation', '') or 'None'}"
            )
            texts_to_embed.append(payload)

        try:
            response = genai.embed_content(
                model="models/gemini-embedding-001",
                content=texts_to_embed,
                task_type="retrieval_document"
            )
            for j, embedding in enumerate(response['embedding']):
                chunk[j]["embedding"] = list(embedding)[:1536]
            print(f"  Vectorized {min(i+chunk_size, len(questions))}/{len(questions)}...")
        except Exception as e:
            print(f"❌ Embedding failed for chunk: {e}")
            break

def main():
    json_path = "lekki_headmaster_questions.json"
    if not os.path.exists(json_path):
        print(f"File not found: {json_path}")
        return

    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    if not data:
        print("No questions found in JSON.")
        return

    print(f"Loaded {len(data)} questions from {json_path}")

    # Prepare batch
    clean_batch = []
    for q in data:
        clean_batch.append({
            "subject": "Use of English",
            "year": 2024,
            "question_text": q.get("question_text", ""),
            "option_a": q.get("option_a", ""),
            "option_b": q.get("option_b", ""),
            "option_c": q.get("option_c", ""),
            "option_d": q.get("option_d", ""),
            "correct_option": str(q.get("correct_option", "A")).upper().strip()[:1],
            "explanation": q.get("explanation"),
            "topic": "The Lekki Headmaster",
            "difficulty": "medium",
            "metadata": {
                "source": "lekki_headmaster_questions.json"
            }
        })

    # Vectorize
    generate_embeddings(clean_batch)

    # Insert into Supabase
    print(f"💾 Inserting {len(clean_batch)} questions to Supabase...")
    batch_size = 50
    inserted_count = 0
    for i in range(0, len(clean_batch), batch_size):
        batch = clean_batch[i:i+batch_size]
        try:
            res = supabase.table("past_questions").insert(batch).execute()
            inserted_count += len(res.data)
            print(f"  Inserted {inserted_count}/{len(clean_batch)}...")
        except Exception as e:
            print(f"❌ Error inserting: {e}")

    print(f"✅ Finished! Inserted {inserted_count} Lekki Headmaster questions.")

if __name__ == "__main__":
    main()
