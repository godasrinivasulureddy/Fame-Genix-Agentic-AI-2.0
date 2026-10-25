import pytest
from app.reports.ocr_engine import extract_document_text_and_tables
from app.rag.knowledge_base import knowledge_engine
from app.rag.tavily_search import tavily_client
from app.agents.orchestrator import agent_orchestrator
from app.core.exceptions import AppError


def test_ocr_unsupported_or_corrupted_file():
    """T3.12: Test handling of corrupted/unsupported file bytes."""
    corrupted_bytes = b"NOT_A_VALID_PDF_OR_IMAGE_HEADER"
    res = extract_document_text_and_tables(corrupted_bytes, "application/pdf")
    assert res["extraction_status"] == "EMPTY_OR_UNREADABLE"
    assert res["text"] == ""


def test_rag_retrieval_and_empty_query():
    """T3.12: Test empty and keyword retrieval from approved knowledge base."""
    # Empty query
    assert knowledge_engine.retrieve("", top_k=3) == []

    # Valid query matching cardiac guidelines
    res = knowledge_engine.retrieve("chest pain radiating to arm", top_k=2)
    assert len(res) > 0
    assert "AHA" in res[0]["source"]
    assert res[0]["score"] > 0


def test_tavily_fallback_when_disabled():
    """T3.12: Ensure graceful handling when Tavily key is absent/offline."""
    # With dummy or absent key, returns empty list without raising unhandled exception
    res = tavily_client.search_clinical_evidence("rare condition guidelines")
    assert isinstance(res, list)


def test_agent_orchestrator_authorization_restriction():
    """T3.11 & T3.12: Verify role authorization checks on agent tools."""
    # An unauthorized role attempting to trigger ambulance dispatch
    with pytest.raises(AppError) as exc_info:
        agent_orchestrator.execute_tool(
            "escalate_emergency_incident",
            {
                "patient_id": "p123",
                "reason": "Test escalation",
                "trigger_rule": "RF-001",
                "vitals_snapshot": {"hr": 140.0}
            },
            user_role="GUEST_UNAUTHORIZED",
            user_id="u123"
        )
    assert "FORBIDDEN_TOOL_ACTION" in str(exc_info.value)


def test_agent_orchestrator_valid_execution():
    """T3.10: Verify typed tool validation and execution."""
    res = agent_orchestrator.execute_tool(
        "calculate_risk",
        {
            "symptom_count": 3,
            "max_severity": 2,
            "duration_hours": 12.0,
            "red_flag_count": 1
        },
        user_role="PATIENT",
        user_id="p123"
    )
    assert res["status"] == "SUCCESS"
    assert "symptom_ml_risk" in res
    assert 0.0 <= res["symptom_ml_risk"] <= 100.0
