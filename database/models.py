import datetime
from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from database.database import Base

class Product(Base):
    __tablename__ = "products"

    id = Column(String, primary_key=True, index=True)  # This is the SKU (e.g. ACS580-01-046A-4)
    manufacturer = Column(String, nullable=True)
    category = Column(String, nullable=True)
    review_required = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    sources = relationship("Source", back_populates="product", cascade="all, delete-orphan")
    attributes = relationship("Attribute", back_populates="product", cascade="all, delete-orphan")
    conflicts = relationship("Conflict", back_populates="product", cascade="all, delete-orphan")


class Source(Base):
    __tablename__ = "sources"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    source_type = Column(String, nullable=False)  # pdf, web, image
    name = Column(String, nullable=False)         # e.g., "ABB Datasheet" or URL
    url = Column(String, nullable=True)           # URL if web source
    file_path = Column(String, nullable=True)     # File path if pdf/local source
    trust_score = Column(Float, default=1.0)      # Person 2 trust score
    status = Column(String, default="uploaded")   # uploaded, processing, processed, failed
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    product = relationship("Product", back_populates="sources")


class Attribute(Base):
    __tablename__ = "attributes"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    name = Column(String, index=True, nullable=False)  # e.g., "voltage", "current", "weight"
    value = Column(String, nullable=False)             # e.g., "380-480"
    unit = Column(String, nullable=True)               # e.g., "V"
    confidence = Column(Float, default=1.0)
    status = Column(String, default="extracted")       # extracted, verified, flagged
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    product = relationship("Product", back_populates="attributes")
    evidence = relationship("Evidence", back_populates="attribute", cascade="all, delete-orphan")


class Evidence(Base):
    __tablename__ = "evidence"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    attribute_id = Column(Integer, ForeignKey("attributes.id"), nullable=False)
    source = Column(String, nullable=False)            # e.g., "ABB Datasheet" or URL
    page = Column(Integer, nullable=True)              # Page number if PDF
    content = Column(Text, nullable=True)              # The raw matching text chunk / table snippet
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    attribute = relationship("Attribute", back_populates="evidence")


class Conflict(Base):
    __tablename__ = "conflicts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    attribute_name = Column(String, nullable=False)    # e.g. "IP Rating"
    source_1 = Column(String, nullable=False)
    value_1 = Column(String, nullable=False)
    source_2 = Column(String, nullable=False)
    value_2 = Column(String, nullable=False)
    description = Column(Text, nullable=True)          # E.g. "Manufacturer lists IP21, Distributor lists IP55"
    status = Column(String, default="pending")         # pending, resolved
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    product = relationship("Product", back_populates="conflicts")
