import json
from validation.conflict.compare import compare_attribute

def test_weight_conflict_fixture():
    data = json.load(open("tests/fixtures/fabricated_conflicts.json"))
    result = compare_attribute(data["readings"])
    assert result["has_conflict"] is True
    assert len(result["dominant_cluster"]) == 2
    assert result["dominant_cluster"][0]["value"] == 18.2