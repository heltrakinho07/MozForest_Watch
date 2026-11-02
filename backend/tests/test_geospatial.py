from app.geospatial import canonical, is_zambezia
from app.constants import DISTRICTS

def test_normalization():
    assert canonical("Gilé") == "gile"
    assert canonical("Alto Molócuè") == "alto molocue"
    assert canonical("Maganja   da Costa") == "maganja da costa"

def test_province_variants():
    assert is_zambezia("Zambézia")
    assert is_zambezia("Zambezia")
    assert is_zambezia("Zambesia")
    assert not is_zambezia("Manica")

def test_target_count():
    assert len(DISTRICTS) == len(set(DISTRICTS)) == 9
