"""In-process API check via FastAPI TestClient (no port needed).

Run from backend/ with PYTHONPATH=backend:  python scripts/server_check.py
Exercises real routing + response_model serialization against the live data path.
"""
from fastapi.testclient import TestClient

from app.main import app


def main() -> None:
    client = TestClient(app)

    h = client.get("/healthz")
    print("GET /healthz ->", h.status_code, h.json())
    assert h.status_code == 200 and h.json().get("status") == "ok"

    r = client.get("/api/markets", params={"query": "World Cup", "limit": 3})
    data = r.json()
    print("GET /api/markets ->", r.status_code, "count:", len(data))
    assert r.status_code == 200
    for m in data:
        fv = m["fair_value"]
        label = m["market"]["group_title"] or m["market"]["question"][:30]
        print(f"  {label:24} P={fv['implied_prob']:.3f} "
              f"[{fv['fair_low']:.3f},{fv['fair_high']:.3f}] {fv['decision_quality']}")
    print("OK")


if __name__ == "__main__":
    main()
