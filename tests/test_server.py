"""
Tests for server.py
Run: pytest tests/ -v
"""

import json
import os
import tempfile
import pytest

# Patch the responses file path before importing app
TEMP_DIR = tempfile.mkdtemp()
TEMP_RESPONSES = os.path.join(TEMP_DIR, "responses.json")

import importlib
import sys

# Override the responses file location for tests
os.environ["RESPONSES_FILE_OVERRIDE"] = TEMP_RESPONSES

# We need to import server after patching; use importlib
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import server as srv

srv.RESPONSES_FILE = TEMP_RESPONSES  # patch module-level variable


@pytest.fixture
def client():
    srv.app.config["TESTING"] = True
    with srv.app.test_client() as c:
        yield c
    # Clean up responses file between tests
    if os.path.exists(TEMP_RESPONSES):
        os.remove(TEMP_RESPONSES)


def test_index_served(client):
    res = client.get("/")
    assert res.status_code == 200


def test_submit_saves_response(client):
    payload = {"__name__": "Test User", "[Budget] Max budget": "₱50,000–₱70,000"}
    res = client.post(
        "/submit",
        data=json.dumps(payload),
        content_type="application/json",
    )
    assert res.status_code == 200
    body = res.get_json()
    assert body["status"] == "ok"
    assert body["total"] == 1

    with open(TEMP_RESPONSES, "r", encoding="utf-8") as f:
        saved = json.load(f)
    assert len(saved) == 1
    assert saved[0]["__name__"] == "Test User"
    assert "_submitted_at" in saved[0]


def test_submit_appends_multiple(client):
    for i in range(3):
        client.post(
            "/submit",
            data=json.dumps({"__name__": f"User {i}"}),
            content_type="application/json",
        )

    with open(TEMP_RESPONSES, "r", encoding="utf-8") as f:
        saved = json.load(f)
    assert len(saved) == 3


def test_submit_rejects_invalid_json(client):
    res = client.post(
        "/submit",
        data="not json",
        content_type="application/json",
    )
    assert res.status_code == 400


def test_view_responses_empty(client):
    res = client.get("/responses")
    assert res.status_code == 200
    assert res.get_json() == []


def test_view_responses_after_submit(client):
    client.post(
        "/submit",
        data=json.dumps({"__name__": "Aileen"}),
        content_type="application/json",
    )
    res = client.get("/responses")
    data = res.get_json()
    assert len(data) == 1
    assert data[0]["__name__"] == "Aileen"
