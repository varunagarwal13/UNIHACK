import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

import tempfile
db_path = os.path.join(tempfile.gettempdir(), "product_twin.db").replace("\\", "/")
DATABASE_URL = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL") or f"sqlite:///{db_path}"

# Fix Heroku/Render/Vercel standard prefix for SQLAlchemy compatibility
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    # SQLite-specific argument to allow cross-thread access in FastAPI
    connect_args["check_same_thread"] = False

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """FastAPI dependency to yield a database session and close it afterwards."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
