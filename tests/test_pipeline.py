import os
import json
import pytest
from validation.pipeline import validate_product, validate_attribute

# Use the mock LLM path so this test doesn't need real API keys / network access
os.environ["HACKATHON_LLM_PROVIDER"] = "mock"


@pytest.fixture
def fabricated_readings():
    data = json.load(open("tests/fixtures/fabricated_conflicts.json"))
    return {data["attribute"]: data["readings"]}


def test_validate_attribute_weight_conflict(fabricated_readings):
    readings = fabricated_readings["weight"]
    attribute, conflict = validate_attribute("weight", readings)

    assert attribute.value == 18.2
    assert attribute.confidence >= 90
    assert attribute.status == "verified"

    assert conflict is not None
    assert conflict.attribute == "weight"
    assert conflict.resolved_value == 18.2
    assert conflict.reasoning  # non-empty string from the conflict agent


def test_validate_product_end_to_end(fabricated_readings):
    result = validate_product("ACS580-01-046A-4", fabricated_readings)

    assert result["product_id"] == "ACS580-01-046A-4"
    assert "weight" in result["attributes"]
    assert result["attributes"]["weight"]["status"] == "verified"
    assert len(result["conflicts"]) == 1
    assert result["review_required"] is False  # dominant cluster was confident enough


def test_validate_product_low_confidence_triggers_review():
    # Two low-trust sources disagree, no manufacturer confirmation at all
    readings = {
        "ip_rating": [
            {"source": "Unknown Reseller X", "value": "IP21"},
            {"source": "Marketplace Listing Y", "value": "IP55"},
        ]
    }
    result = validate_product("TEST-SKU", readings)
    assert result["review_required"] is True
    assert result["conflicts"][0]["status"] == "human_review"