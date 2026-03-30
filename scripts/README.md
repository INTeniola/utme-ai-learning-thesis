# Scripts Directory

This directory contains automation scripts and data pipelines for the Quizant platform. It has been organized into three functional categories:

## 1. `/ingestion`
Contains scripts for extracting, processing, and vectorizing educational content into the Supabase database.
- Scraping scripts (`scrape_myschool.js`, `test_scrape.py`)
- OCR processing (`ocr_jamb_questions.py`)
- Question insertion (`ingest_questions.ts`, `ingest_recent_vectorized.py`)
- Knowledge base population (`ingest_knowledge_base.py`)
- AI Classification (`classify_topics.ts`)

## 2. `/maintenance`
Contains scripts for auditing, identifying, and repairing data anomalies in the production database.
- Cleanup (`cleanup.ts`, `clean_database_questions.ts`)
- Validation (`verify_ingestion.ts`, `check_questions.ts`, `check_years.ts`)
- Audits (`audit-db.mjs`)

## 3. `/setup`
Contains one-off scripts for bootstrapping fresh environments.
- Database Initialization (`bootstrap_new_supabase.sql`)
- Account recovery (`unlock_accounts.sql`)
- TypeScript tooling (`add-jsdocs.ts`)

> **⚠️ WARNING:** Scripts in `/maintenance` and `/setup` can be highly destructive if pointed at a production database. Always verify your `.env` configuration before running them.
