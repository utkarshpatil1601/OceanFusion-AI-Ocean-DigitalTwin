import json
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen


def get_json(url, params=None, timeout=30):
    if params:
        url = f"{url}?{urlencode(params)}"
    request = Request(url, headers={"User-Agent": "OceanFusion/0.1 research MVP"})
    with urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def obis_occurrences(limit=100):
    return get_json(
        "https://api.obis.org/v3/occurrence",
        {
            "geometry": "POLYGON((50 5,78 5,78 24.5,68 26,60 25,50 20,50 5))",
            "size": min(max(limit, 1), 1000),
        },
    )


def worms_name(name):
    return get_json(
        f"https://www.marinespecies.org/rest/AphiaRecordsByName/{quote(name)}",
        {"marine_only": "true"},
    )


def ncbi_search(term, retmax=20):
    result = get_json(
        "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi",
        {"db": "nuccore", "term": term, "retmode": "json", "retmax": retmax},
    )
    return result["esearchresult"]


def ncbi_fetch_fasta(ids):
    return get_text(
        "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi",
        {"db": "nuccore", "id": ",".join(ids), "rettype": "fasta", "retmode": "text"},
    )


def get_text(url, params=None, timeout=60):
    if params:
        url = f"{url}?{urlencode(params)}"
    request = Request(url, headers={"User-Agent": "OceanFusion/0.1 research MVP"})
    with urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8")
