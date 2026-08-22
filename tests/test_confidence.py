from validation.confidence.engine import compute_confidence, route

def test_high_confidence_two_agreeing_sources():
    # Manufacturer + Distributor A agree on 18.2 kg (Section 3 example)
    conf = compute_confidence(avg_trust=93.5, agreement_score=1.0,
                               n_agreeing_sources=2, manufacturer_confirmed=True)
    assert conf >= 90
    assert route(conf, has_unresolved_conflict=False) == "auto_approved"

def test_low_trust_single_source_flags_for_review():
    conf = compute_confidence(avg_trust=45, agreement_score=1.0,
                               n_agreeing_sources=1, manufacturer_confirmed=False)
    assert route(conf, has_unresolved_conflict=False) in ("suggested_review", "human_review")