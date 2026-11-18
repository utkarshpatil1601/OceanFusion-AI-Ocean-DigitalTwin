from unittest.mock import patch
from urllib.error import URLError
from app.live_sources import ncbi_search


def test_ncbi_search_returns_result_shape():
    try:
        result = ncbi_search("Rastrelliger kanagurta[Organism] AND COI[Gene]", 1)
        assert "count" in result
        assert "idlist" in result
    except URLError:
        mock_response = {"esearchresult": {"count": "1", "idlist": ["123456"]}}
        with patch("app.live_sources.get_json", return_value=mock_response):
            result = ncbi_search("Rastrelliger kanagurta[Organism] AND COI[Gene]", 1)
            assert "count" in result
            assert "idlist" in result

