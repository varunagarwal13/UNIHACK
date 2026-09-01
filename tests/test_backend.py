import os
import sys
import unittest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add project root to path so we can import from database/document_processing/backend
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.database import Base
from database.models import Product, Source, Attribute, Evidence, Conflict
from document_processing.chunker import chunk_text, format_table_as_markdown, process_document_to_chunks

class TestProductTwinDatabase(unittest.TestCase):
    def setUp(self):
        # Create an in-memory SQLite database for testing
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        Session = sessionmaker(bind=self.engine)
        self.db = Session()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)

    def test_database_models_creation(self):
        # 1. Create Product
        product = Product(
            id="ACS580-01-046A-4",
            manufacturer="ABB",
            category="Variable Frequency Drive",
            review_required=False
        )
        self.db.add(product)
        self.db.commit()
        
        # Verify product created
        db_product = self.db.query(Product).filter(Product.id == "ACS580-01-046A-4").first()
        self.assertIsNotNone(db_product)
        self.assertEqual(db_product.manufacturer, "ABB")
        
        # 2. Add source
        source = Source(
            product_id="ACS580-01-046A-4",
            source_type="pdf",
            name="abb_vfd_manual.pdf",
            file_path="/workspaces/product-twin/uploads/abb_vfd_manual.pdf",
            trust_score=1.0,
            status="processed"
        )
        self.db.add(source)
        self.db.commit()
        
        db_src = self.db.query(Source).filter(Source.product_id == "ACS580-01-046A-4").first()
        self.assertIsNotNone(db_src)
        self.assertEqual(db_src.name, "abb_vfd_manual.pdf")
        
        # 3. Add Attribute
        attribute = Attribute(
            product_id="ACS580-01-046A-4",
            name="voltage",
            value="380-480",
            unit="V",
            confidence=0.98,
            status="verified"
        )
        self.db.add(attribute)
        self.db.commit()
        self.db.refresh(attribute)
        
        db_attr = self.db.query(Attribute).filter(Attribute.product_id == "ACS580-01-046A-4").first()
        self.assertIsNotNone(db_attr)
        self.assertEqual(db_attr.value, "380-480")
        
        # 4. Add Evidence linked to Attribute
        evidence = Evidence(
            attribute_id=attribute.id,
            source="abb_vfd_manual.pdf",
            page=12,
            content="Input voltage rating is 380-480 V AC"
        )
        self.db.add(evidence)
        self.db.commit()
        
        db_evidence = self.db.query(Evidence).filter(Evidence.attribute_id == attribute.id).first()
        self.assertIsNotNone(db_evidence)
        self.assertEqual(db_evidence.page, 12)
        
        # 5. Add Conflict
        conflict = Conflict(
            product_id="ACS580-01-046A-4",
            attribute_name="ip_rating",
            source_1="Datasheet 1",
            value_1="IP21",
            source_2="Datasheet 2",
            value_2="IP55",
            description="Mismatch detected",
            status="pending"
        )
        self.db.add(conflict)
        self.db.commit()
        
        db_conflict = self.db.query(Conflict).filter(Conflict.product_id == "ACS580-01-046A-4").first()
        self.assertIsNotNone(db_conflict)
        self.assertEqual(db_conflict.value_1, "IP21")
        self.assertEqual(db_conflict.value_2, "IP55")


class TestDocumentChunker(unittest.TestCase):
    def test_chunk_text(self):
        text = "a" * 1500
        chunks = chunk_text(text, max_chars=1000, overlap=200)
        self.assertEqual(len(chunks), 2)
        self.assertEqual(len(chunks[0]), 1000)
        self.assertEqual(len(chunks[1]), 700) # (1500 - 800)

    def test_format_table_as_markdown(self):
        table = [
            ["Voltage", "Current", "IP Rating"],
            ["380V", "46A", "IP21"],
            ["480V", "46A", "IP21"]
        ]
        md = format_table_as_markdown(table)
        expected_md = (
            "| Voltage | Current | IP Rating |\n"
            "| --- | --- | --- |\n"
            "| 380V | 46A | IP21 |\n"
            "| 480V | 46A | IP21 |"
        )
        self.assertEqual(md, expected_md)

    def test_process_document_to_chunks(self):
        document_data = {
            "pages": [
                {"page_number": 1, "text": "This is page 1 text content."}
            ],
            "tables": [
                {
                    "page_number": 1,
                    "tables": [
                        [["Voltage", "Current"], ["380-480", "46"]]
                    ]
                }
            ],
            "images": [
                {"page_number": 1, "file_path": "/uploads/extracted_images/extracted_img_p1_1.png"}
            ]
        }
        chunks = process_document_to_chunks(document_data, "manual.pdf")
        self.assertEqual(len(chunks), 3) # 1 text chunk + 1 table chunk + 1 image reference chunk
        
        # Verify text chunk
        self.assertEqual(chunks[0]["type"], "text")
        self.assertEqual(chunks[0]["page"], 1)
        self.assertEqual(chunks[0]["content"], "This is page 1 text content.")
        
        # Verify table chunk
        self.assertEqual(chunks[1]["type"], "table")
        self.assertEqual(chunks[1]["page"], 1)
        self.assertIn("| Voltage | Current |", chunks[1]["content"])
        
        # Verify image chunk
        self.assertEqual(chunks[2]["type"], "image")
        self.assertEqual(chunks[2]["page"], 1)
        self.assertIn("extracted_img_p1_1.png", chunks[2]["content"])

if __name__ == "__main__":
    unittest.main()
