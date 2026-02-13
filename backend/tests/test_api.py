from fastapi.testclient import TestClient

from app import main


class _FakeResponse:
    def __init__(self, output_text: str) -> None:
        self.output_text = output_text


class _FakeResponsesApi:
    def __init__(self, output_text: str) -> None:
        self._output_text = output_text

    def create(self, **kwargs):  # noqa: ANN003
        return _FakeResponse(self._output_text)


class _FakeOpenAIClient:
    def __init__(self, output_text: str) -> None:
        self.responses = _FakeResponsesApi(output_text)


def _reset_rate_limiter() -> None:
    main._rate_limit_storage.clear()


def test_health_check() -> None:
    client = TestClient(main.app)
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_validation_error_missing_feeling() -> None:
    client = TestClient(main.app)
    response = client.post("/api/affirmation", json={"name": "Alex"})

    assert response.status_code == 422
    body = response.json()
    assert body["error"] == "ValidationError"


def test_affirmation_success(monkeypatch) -> None:  # noqa: ANN001
    client = TestClient(main.app)
    _reset_rate_limiter()
    monkeypatch.setattr(main, "openai_client", _FakeOpenAIClient("Alex, you are capable and calm."))

    response = client.post(
        "/api/affirmation",
        json={"name": "Alex", "feeling": "nervous before a big presentation"},
    )

    assert response.status_code == 200
    body = response.json()
    assert "affirmation" in body
    assert "Alex" in body["affirmation"]


def test_affirmation_success_in_requested_language(monkeypatch) -> None:  # noqa: ANN001
    client = TestClient(main.app)
    _reset_rate_limiter()
    monkeypatch.setattr(main, "openai_client", _FakeOpenAIClient("Tu es calme et capable aujourd'hui."))

    response = client.post(
        "/api/affirmation",
        json={"name": "Alex", "feeling": "un peu stressé", "language": "fr"},
    )

    assert response.status_code == 200
    assert "affirmation" in response.json()


def test_affirmation_returns_error_when_openai_key_missing(monkeypatch) -> None:  # noqa: ANN001
    client = TestClient(main.app)
    _reset_rate_limiter()
    monkeypatch.setattr(main, "openai_client", None)

    response = client.post("/api/affirmation", json={"name": "Alex", "feeling": "stressed"})

    assert response.status_code == 500
    body = response.json()
    assert body["error"] == "HttpError"


def test_rate_limit_blocks_excess_requests(monkeypatch) -> None:  # noqa: ANN001
    client = TestClient(main.app)
    _reset_rate_limiter()
    monkeypatch.setattr(main, "RATE_LIMIT_MAX_REQUESTS", 2)
    monkeypatch.setattr(main, "RATE_LIMIT_WINDOW_SECONDS", 120)
    monkeypatch.setattr(main, "openai_client", _FakeOpenAIClient("You are steady and enough."))

    first = client.post("/api/affirmation", json={"name": "Sam", "feeling": "tired"})
    second = client.post("/api/affirmation", json={"name": "Sam", "feeling": "tired"})
    third = client.post("/api/affirmation", json={"name": "Sam", "feeling": "tired"})

    assert first.status_code == 200
    assert second.status_code == 200
    assert third.status_code == 429
    body = third.json()
    assert body["error"] == "RateLimitExceeded"


def test_rejects_emoji_feeling_input() -> None:
    client = TestClient(main.app)
    response = client.post("/api/affirmation", json={"name": "Alex", "feeling": "😟"})

    assert response.status_code == 422
    body = response.json()
    assert body["error"] == "ValidationError"


def test_rejects_short_shorthand_feeling_input() -> None:
    client = TestClient(main.app)
    response = client.post("/api/affirmation", json={"name": "Alex", "feeling": "anx"})

    assert response.status_code == 422
    body = response.json()
    assert body["error"] == "ValidationError"
