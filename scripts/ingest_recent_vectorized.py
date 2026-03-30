# ============================================================================
# INGEST RECENT JAMB QUESTIONS (2017+) & VECTORIZE
#
# Follows the user's strategy:
# 1. Fetch recent UTME questions
# 2. Normalize schema
# 3. Vectorize using OpenAI text-embedding-3-small
# 4. Batch upsert to Supabase
# ============================================================================
import os
import time
import json
import logging
import asyncio
import aiohttp
from typing import List, Dict, Any, Set
from dotenv import load_dotenv
from supabase import create_client, Client
from openai import AsyncOpenAI

# ── Configuration ─────────────────────────────────────────────────────────────
load_dotenv(".env")
load_dotenv(".env.local")

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
OPENAI_API_KEY = os.getenv("VITE_OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY")
ALOC_KEY = "ALOC-d60419c06bd7620a0e16"

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing Supabase credentials in .env")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
openai = AsyncOpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# Target subjects
SUBJECTS = ['english', 'mathematics', 'physics', 'chemistry', 'biology', 'government', 'crs', 'literature']

# We want 200 recent questions per subject
TARGET_PER_SUBJECT = 200
BATCH_SIZE = 50

# ── Helper: Fetch Recent Questions ──────────────────────────────────────────
async def fetch_aloc_questions(session: aiohttp.ClientSession, subject: str, target: int) -> List[Dict[str, Any]]:
    """
    Fetches questions from Aloc API, filtering strictly for 2017 and newer.
    The Aloc API returns random questions, so we over-fetch until we have enough recent ones.
    """
    url = f"https://questions.aloc.com.ng/api/v2/q?subject={subject}&type=utme"
    headers = {"AccessToken": ALOC_KEY}
    
    collected = []
    seen_ids: Set[int] = set()
    attempts = 0
    max_attempts = target * 10  # Because we are throwing away < 2017 questions

    logger.info(f"📥 Fetching recent {subject.capitalize()} questions (2017+)...")

    while len(collected) < target and attempts < max_attempts:
        tasks = [session.get(url, headers=headers) for _ in range(20)]
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        attempts += 20

        for r in responses:
            if isinstance(r, Exception):
                continue
            try:
                if r.status == 429:
                    await asyncio.sleep(2)
                    continue
                if r.status != 200:
                    continue
                
                data = await r.json()
                if data.get("status") == 200 and data.get("data"):
                    q = data["data"]
                    qid = q["id"]
                    year_str = q.get("examyear", "")
                    
                    try:
                        year = int(year_str)
                    except ValueError:
                        continue # Skip if year is malformed/missing

                    # FILTER: Strict 2017 and above
                    if year >= 2017 and qid not in seen_ids:
                        # Validate options exist
                        opts = q.get("option", {})
                        if not all(k in opts and opts[k] for k in ["a", "b", "c", "d"]):
                            continue
                        
                        ans = str(q.get("answer", "")).upper()
                        if ans not in ["A", "B", "C", "D"]:
                            continue

                        seen_ids.add(qid)
                        collected.append({
                            "subject": subject.capitalize(),
                            "year": year,
                            "question_text": q.get("question", ""),
                            "option_a": opts["a"],
                            "option_b": opts["b"],
                            "option_c": opts["c"],
                            "option_d": opts["d"],
                            "correct_option": ans,
                            "explanation": q.get("solution") or None,
                            "difficulty": "medium",
                            "topic": q.get("section") or "General",
                            "metadata": {
                                "aloc_id": qid,
                                "source": "aloc.com.ng (Recent Filter)"
                            }
                        })
                        print(f"\r✅ Found {len(collected)}/{target} recent {subject} questions...", end="")
            except Exception:
                pass

        # Give API a tiny breather
        await asyncio.sleep(0.5)

    print() # newline
    return collected

# ── Helper: Vectorize Questions ─────────────────────────────────────────────
async def generate_embeddings(questions: List[Dict[str, Any]]):
    """
    Generates OpenAI embeddings for the given questions if API key is present.
    Creates a composite text snippet for the embedding.
    """
    if not openai:
        logger.warning("No OPENAI_API_KEY found. Skipping vectorization.")
        return

    logger.info(f"🧠 Vectorizing {len(questions)} questions using text-embedding-3-small...")
    
    # Process in batches to avoid OpenAI rate limits
    chunk_size = 100
    for i in range(0, len(questions), chunk_size):
        chunk = questions[i:i+chunk_size]
        
        # Build text payload
        texts_to_embed = []
        for q in chunk:
            payload = (
                f"Subject: {q['subject']}. Topic: {q['topic']}. Year: {q['year']}. "
                f"Question: {q['question_text']} Options: A) {q['option_a']} B) {q['option_b']} C) {q['option_c']} D) {q['option_d']} "
                f"Answer: {q['correct_option']} Explanation: {q['explanation'] or 'None'}"
            )
            texts_to_embed.append(payload)

        try:
            response = await openai.embeddings.create(
                input=texts_to_embed,
                model="text-embedding-3-small"
            )
            
            for j, data in enumerate(response.data):
                chunk[j]["embedding"] = data.embedding
                
            print(f"\r✅ Vectorized {min(i+chunk_size, len(questions))}/{len(questions)}...", end="")
        except Exception as e:
            logger.error(f"\n❌ Embedding failed for chunk: {e}")
            break
            
    print() # newline

# ── Main Pipeline ───────────────────────────────────────────────────────────
async def main():
    logger.info("🚀 Starting Advanced JAMB Ingestion (2017+ Strict Filter)")
    async with aiohttp.ClientSession() as session:
        for subject in SUBJECTS:
            # 1. Fetch exactly what we need (strictly recent)
            questions = await fetch_aloc_questions(session, subject, TARGET_PER_SUBJECT)
            
            if not questions:
                logger.warning(f"⚠️ Could not find recent questions for {subject}")
                continue

            # 2. Vectorize (if OpenAI key exists)
            await generate_embeddings(questions)

            # 3. Batch Insert to Supabase (we trust Postgres handles vector if column exists)
            # Remove embedding key if it's not present (e.g. error or no API key) to avoid DB schema errors
            # Actually, using Supabase python client, if we pass keys that don't match columns it might fail,
            # so we only pass embedding if we generated it.
            
            logger.info(f"💾 Inserting {len(questions)} {subject} questions to Supabase...")
            
            # Upsert in chunks
            inserted = 0
            for i in range(0, len(questions), BATCH_SIZE):
                batch = questions[i:i+BATCH_SIZE]
                try:
                    res = supabase.table("past_questions").insert(batch).execute()
                    inserted += len(res.data)
                except Exception as e:
                    # If it fails due to missing 'embedding' column in DB, we catch it
                    if "column \"embedding\" of relation \"past_questions\" does not exist" in str(e):
                        logger.error("\n❌ DB Error: 'embedding' column does not exist!")
                        logger.error("Run the SQL migration to create the vector column first.")
                        return
                    else:
                        logger.error(f"\n❌ Insert Error: {e}")
            
            logger.info(f"✅ Successfully saved {inserted} {subject} questions!\n")

if __name__ == "__main__":
    # Fix for Windows asyncio loop if needed, but fine for Mac/Linux
    asyncio.run(main())
