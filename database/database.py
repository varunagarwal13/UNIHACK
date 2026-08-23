import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# PostgreSQL connection string default, fallback to local SQLite for development
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:////tmp/product_twin.db")

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
