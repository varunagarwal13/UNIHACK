import os
import sys
import unittest
from fastapi.testclient import TestClient

# Add project root to path so we can import from database/document_processing/backend
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.main import app
from database.database import Base, engine, get_db
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Create test DB engine
TEST_DB_FILE = "./test_api.db"
test_engine = create_engine(f"sqlite:///{TEST_DB_FILE}", connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

# Override get_db dependency
def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

class TestProductTwinAPI(unittest.TestCase):
    def setUp(self):
        # Remove old test DB if it exists
        if os.path.exists(TEST_DB_FILE):
            try:
                os.remove(TEST_DB_FILE)
            except Exception:
                pass
        Base.metadata.create_all(bind=test_engine)
        self.client = TestClient(app)

    def tearDown(self):
        Base.metadata.drop_all(bind=test_engine)
        # Clean up test DB file
        if os.path.exists(TEST_DB_FILE):
            try:
                os.remove(TEST_DB_FILE)
            except Exception:
                pass

    def test_get_nonexistent_product(self):
        response = self.client.get("/product/nonexistent-sku")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"], "Product not found")

    def test_run_analysis_and_retrieve_product(self):
        # 1. Trigger analysis on mock url (which will use web/source scraper chunking)
        analyze_payload = {
            "product_id": "ACS580-01-046A-4",
            "source_name": "ABB Website",
            "url": "https://new.abb.com/drives/low-voltage-ac/general-purpose/acs580"
        }
        
        # Call POST /product/analyze?product_id=...&source_name=...&url=...
        response = self.client.post(
            f"/product/analyze?product_id={analyze_payload['product_id']}&source_name={analyze_payload['source_name']}&url={analyze_payload['url']}"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["product_id"], "ACS580-01-046A-4")
        self.assertFalse(response.json()["review_required"])

        # 2. Retrieve Product Twin matching shared data contract
        response = self.client.get("/product/ACS580-01-046A-4")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Verify JSON contract shape
        self.assertEqual(data["product_id"], "ACS580-01-046A-4")
        self.assertEqual(data["manufacturer"], "ABB")
        self.assertEqual(data["category"], "Variable Frequency Drive")
        self.assertIn("voltage", data["attributes"])
        self.assertEqual(data["attributes"]["voltage"]["value"], "380-480")
        self.assertEqual(data["attributes"]["voltage"]["unit"], "V")
        expected_status = "flagged" if os.getenv("REAL_PIPELINE") == "true" else "verified"
        self.assertEqual(data["attributes"]["voltage"]["status"], expected_status)
        self.assertEqual(len(data["attributes"]["voltage"]["evidence"]), 1)
        self.assertEqual(data["attributes"]["voltage"]["evidence"][0]["source"], "https://new.abb.com/drives/low-voltage-ac/general-purpose/acs580")

    def test_human_review_and_override(self):
        # Trigger analysis to create the product
        self.client.post("/product/analyze?product_id=ACS580-01-046A-4&source_name=ABB Website&url=https://new.abb.com/drives/low-voltage-ac/general-purpose/acs580")
        
        # 1. Post review override
        review_payload = {
            "attribute_name": "voltage",
            "approved_value": "400",
            "approved_unit": "V",
            "status": "verified"
        }
        response = self.client.post("/review/ACS580-01-046A-4", json=review_payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["message"], "Attribute updated and conflicts resolved successfully")

        # 2. Get product and check value is updated
        response = self.client.get("/product/ACS580-01-046A-4")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["attributes"]["voltage"]["value"], "400")
        self.assertEqual(data["attributes"]["voltage"]["evidence"][-1]["source"], "Human Reviewer Override")

    def test_export_endpoints(self):
        # Trigger analysis
        self.client.post("/product/analyze?product_id=ACS580-01-046A-4&source_name=ABB Website&url=https://new.abb.com/drives/low-voltage-ac/general-purpose/acs580")
        
        # 1. Export JSON
        response = self.client.get("/product/ACS580-01-046A-4/export?format=json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["product_id"], "ACS580-01-046A-4")
        self.assertIn("Content-Disposition", response.headers)
        
        # 2. Export CSV
        response = self.client.get("/product/ACS580-01-046A-4/export?format=csv")
        self.assertEqual(response.status_code, 200)
        self.assertIn("voltage", response.text)
        self.assertIn("Content-Disposition", response.headers)

if __name__ == "__main__":
    unittest.main()
