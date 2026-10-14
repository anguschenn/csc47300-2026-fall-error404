import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv("DATABASE_URL")
if db_url and db_url.startswith("postgresql://") and not db_url.startswith("postgresql+"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

if not db_url:
    print("DATABASE_URL not set.")
    exit(1)

engine = create_engine(db_url)

sql_commands = """
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true) 
ON CONFLICT (id) DO UPDATE SET public = true;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'buckets' AND policyname = 'Public Access to Buckets'
    ) THEN
        CREATE POLICY "Public Access to Buckets" ON storage.buckets 
        FOR SELECT USING (public = true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Public Access to Avatars'
    ) THEN
        CREATE POLICY "Public Access to Avatars" ON storage.objects 
        FOR SELECT USING (bucket_id = 'avatars');
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Authenticated users can upload avatars'
    ) THEN
        CREATE POLICY "Authenticated users can upload avatars" ON storage.objects 
        FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Authenticated users can update avatars'
    ) THEN
        CREATE POLICY "Authenticated users can update avatars" ON storage.objects 
        FOR UPDATE TO authenticated USING (bucket_id = 'avatars');
    END IF;
END $$;
"""

with engine.connect() as conn:
    conn.execute(text(sql_commands))
    conn.commit()
    print("Storage bucket 'avatars' and policies verified successfully!")
