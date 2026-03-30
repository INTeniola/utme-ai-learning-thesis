import os
import json
import time
import argparse
from typing import Optional
from dotenv import load_dotenv
import google.generativeai as genai
from supabase import create_client, Client
from pydantic import BaseModel, Field

# ==============================================================================
# JAMB PDF OCR Pipeline using Gemini 1.5 Pro File API
# Extracts structured multiple-choice questions natively from raw PDFs.
# ==============================================================================

load_dotenv(".env")
load_dotenv(".env.local")

# Supabase Auth
SUPABASE_URL = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing Supabase credentials in .env")

# Gemini Auth
GEMINI_KEY = os.getenv("VITE_GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY")
if not GEMINI_KEY:
    raise ValueError("Missing Gemini API Key in .env")

genai.configure(api_key=GEMINI_KEY)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ==============================================================================
# Helper functions
# ==============================================================================
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

def upload_to_gemini(path: str, mime_type: str = "application/pdf"):
    print(f"⬆️ Uploading '{path}' to Gemini File API...")
    file = genai.upload_file(path, mime_type=mime_type)
    print(f"⏳ Waiting for file processing (ID: {file.name})...")
    
    # Wait for the file to be active (PDFs sometimes take a few seconds to process)
    while True:
        file = genai.get_file(file.name)
        if file.state.name == "ACTIVE":
            print(f"✅ File ready!")
            break
        elif file.state.name == "FAILED":
            raise RuntimeError(f"File processing failed: {file.name}")
        time.sleep(2)
        
    return file

def extract_questions_from_pdf(pdf_path: str, subject_name: str) -> list:
    """Uploads PDF to Gemini 1.5 Pro and extracts JAMB questions as JSON."""
    
    # Choose Pro for complex layout understanding and logic
    model = genai.GenerativeModel(
        model_name="models/gemini-flash-latest",
        generation_config={
            "temperature": 0.1,  # Low temp for deterministic extraction
            "response_mime_type": "application/json"
        }
    )
    
    # Upload the PDF
    gemini_file = None
    try:
        gemini_file = upload_to_gemini(pdf_path)
        
        prompt = f"""
        You are an elite educational AI data extractor.
        Your task is to comprehensively extract JAMB past questions from this '{subject_name}' PDF.
        Identify the exam year for blocks of questions.
        
        Extract EVERY valid multiple-choice question you find with 4 options (A, B, C, D).
        If correct answers or explanations are provided at the end of the document, 
        correlate them to the correct question and include them.
        If no correct answer is provided, do your absolute best as a Subject Matter Expert to determine 
        the correct option letter (A, B, C, or D) and provide a concise explanation.
        
        Output MUST be a single raw JSON array of objects. Do NOT use markdown code blocks like ```json.
        Schema for each object:
        {{
            "subject": "{subject_name}",
            "year": (integer, e.g., 2022),
            "question_text": (string, the full question text),
            "option_a": (string, text for option A without the "A." prefix),
            "option_b": (string, text for option B without the "B." prefix),
            "option_c": (string, text for option C without the "C." prefix),
            "option_d": (string, text for option D without the "D." prefix),
            "correct_option": (string, "A", "B", "C", or "D"),
            "explanation": (string, concise explanation of the answer),
            "topic": (string, attempt to classify the topic. Use "General" if unknown)
        }}
        """
        
        print("🧠 Processing document with Gemini 1.5 Pro (this may take a minute or two depending on size)...")
        # For huge PDFs we might hit token output limits with a single prompt, but 8k/8k tokens can usually return ~50-100 questions.
        response = model.generate_content([gemini_file, prompt])
        
        text = response.text
        try:
            questions = json.loads(text)
            if not isinstance(questions, list):
                print("⚠️ Output parsed as JSON but is not an array. Attempting to fix.")
                if isinstance(questions, dict) and 'questions' in questions:
                    questions = questions['questions']
                else:
                    return []
            print(f"✨ Successfully extracted {len(questions)} questions from the PDF.")
            return questions
        except json.JSONDecodeError as e:
            print("❌ Failed to parse JSON response. The output might be too large or malformed.")
            print("Preview of response:", text[:500])
            return []
            
    finally:
        # Cleanup
        if gemini_file:
            print(f"🧹 Deleting file {gemini_file.name} from Gemini server...")
            genai.delete_file(gemini_file.name)


def main():
    parser = argparse.ArgumentParser(description="OCR JAMB PDFs via Gemini 1.5 Pro")
    parser.add_argument('--pdf', required=True, help="Path to the PDF file")
    parser.add_argument('--subject', required=True, help="Subject name (e.g., Mathematics, Government)")
    parser.add_argument('--save-json', action='store_true', help="Save extracted JSON locally instead of uploading")
    
    args = parser.parse_args()
    
    pdf_path = args.pdf
    if not os.path.exists(pdf_path):
        print(f"Error: File '{pdf_path}' not found.")
        return
        
    questions = extract_questions_from_pdf(pdf_path, args.subject)
    
    if not questions:
        print("No questions were extracted.")
        return
        
    if args.save_json:
        out_name = f"{args.subject.lower()}_ocr_extracted.json"
        with open(out_name, 'w', encoding='utf-8') as f:
            json.dump(questions, f, indent=2)
        print(f"💾 Saved {len(questions)} questions to {out_name}")
    else:
        # Batch insert to supabase direct
        print(f"💾 Inserting {len(questions)} questions to Supabase...")
        batch_size = 50
        inserted_count = 0
        
        for i in range(0, len(questions), batch_size):
            batch = questions[i:i+batch_size]
            # Normalize schema
            clean_batch = []
            for q in batch:
                clean_batch.append({
                    "subject": q.get("subject", args.subject).capitalize(),
                    "year": int(q.get("year", 2024)),
                    "question_text": q.get("question_text", ""),
                    "option_a": q.get("option_a", ""),
                    "option_b": q.get("option_b", ""),
                    "option_c": q.get("option_c", ""),
                    "option_d": q.get("option_d", ""),
                    "correct_option": str(q.get("correct_option", "A")).upper().strip()[:1],
                    "explanation": q.get("explanation"),
                    "topic": q.get("topic", "General"),
                    "difficulty": "medium",
                    "metadata": {
                        "source": os.path.basename(pdf_path),
                        "ocr_pipeline": "Gemini 1.5 Pro"
                    }
                })
                
            try:
                generate_embeddings(clean_batch)
                res = supabase.table("past_questions").insert(clean_batch).execute()
                inserted_count += len(res.data)
                print(f"  Inserted {inserted_count}/{len(questions)}...")
            except Exception as e:
                print(f"❌ Error inserting chunk: {e}")
                
        print(f"✅ Finished! Inserted {inserted_count} questions.")

if __name__ == "__main__":
    main()
