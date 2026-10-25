from app.agents.orchestrator import agent_orchestrator
from app.rag.knowledge_base import knowledge_engine


class RAGAssistantEngine:
    """
    Connects Knowledge Base retrieval + Tavily Search + Nebius / NVIDIA models
    into a structured, grounded answer with citations.
    """

    def generate_grounded_response(self, query: str, user_role: str = "PATIENT") -> dict:
        # 1. Retrieve evidence
        tool_res = agent_orchestrator.execute_tool(
            "lookup_clinical_guidelines",
            {"query": query, "top_k": 3},
            user_role=user_role,
            user_id="user_query"
        )
        citations = tool_res.get("citations", [])
        
        evidence_text = "\n\n".join([f"[{c.get('source')}]: {c.get('text', c.get('snippet', ''))}" for c in citations])
        
        prompt = (
            f"You are FAME-GENIX Clinical Assistant. Answer the patient query using the following evidence.\n"
            f"Cite the source names. Do not invent medical claims. Keep advice practical and explain in simple language.\n\n"
            f"CLINICAL EVIDENCE:\n{evidence_text if evidence_text else 'No specific clinical reference found.'}\n\n"
            f"PATIENT QUERY: {query}\n\n"
            f"ANSWER:"
        )

        from app.ai.service import ai_service
        raw_answer = ai_service._generate_with_failover(prompt)

        # Fallback if no LLM configured or offline
        if not raw_answer:
            if citations:
                raw_answer = (
                    f"Based on clinical reference {citations[0].get('source')}: "
                    f"{citations[0].get('text', citations[0].get('snippet', ''))[:200]}... "
                    f"Please consult an authorized physician for personal medical evaluation."
                )
            else:
                raw_answer = (
                    "Routine self-monitoring is recommended. Ensure adequate hydration, rest, and "
                    "contact a healthcare professional if symptoms escalate."
                )

        return {
            "query": query,
            "answer": raw_answer,
            "citations": citations,
            "citations_count": len(citations),
            "safety_disclaimer": "FAME-GENIX AI decision support is not a replacement for clinical diagnosis."
        }


rag_assistant = RAGAssistantEngine()
