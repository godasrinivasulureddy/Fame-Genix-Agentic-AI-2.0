"""
Knowledge Ingestion, Chunking, Indexing & Hybrid Retrieval Engine.
Maintains curated medical guidelines (WHO, AHA, ICMR) with citation anchors.
Tasks: T3.7 & T3.8
"""

import math
import re
from typing import List, Dict, Any


DEFAULT_MEDICAL_KNOWLEDGE = [
    {
        "id": "KB-CARDIAC-001",
        "title": "AHA STEMI & Acute Coronary Syndrome Triage Guidelines",
        "category": "CARDIAC",
        "content": (
            "Patients presenting with central crushing chest pain, radiating to left arm or jaw, accompanied by "
            "diaphoresis or dyspnea must be escalated to immediate emergency care. Target door-to-balloon time "
            "is under 90 minutes. Normal resting heart rate: 60-100 bpm. Severe tachycardia > 120 bpm requires priority ECG."
        ),
        "source": "American Heart Association (AHA) Emergency Protocol 2024",
        "tags": ["chest pain", "cardiac", "stemi", "heart rate", "tachycardia"]
    },
    {
        "id": "KB-RESP-002",
        "title": "WHO Clinical Management of Acute Respiratory Distress & Hypoxemia",
        "category": "RESPIRATORY",
        "content": (
            "Normal pulse oximetry (SpO2) in healthy individuals is 95-100%. SpO2 between 90-94% indicates mild to moderate "
            "hypoxemia requiring supplemental oxygen evaluation. SpO2 below 90% is a clinical red-flag indicating severe "
            "respiratory failure. Normal respiratory rate is 12-20 breaths/min; tachypnea > 25 breaths/min indicates acute distress."
        ),
        "source": "World Health Organization (WHO) Guidelines for Respiratory Care",
        "tags": ["spo2", "oxygen", "respiratory", "breathlessness", "tachypnea"]
    },
    {
        "id": "KB-NEURO-003",
        "title": "NICE Stroke & Acute Neurological Deficit Recognition",
        "category": "NEUROLOGY",
        "content": (
            "Sudden onset facial weakness, arm weakness, slurred speech, or loss of motor function in extremities "
            "constitutes an acute stroke emergency. Prompt thrombolytic evaluation within 4.5 hours is critical. "
            "Sudden loss of consciousness or uncontrolled seizures requires immediate spinal stabilization and emergency dispatch."
        ),
        "source": "NICE Guidelines for Acute Neurological Care",
        "tags": ["stroke", "seizure", "unconscious", "headache", "paralysis"]
    },
    {
        "id": "KB-ANAPH-004",
        "title": "WAO Anaphylaxis Emergency Intervention Guidelines",
        "category": "IMMUNOLOGY",
        "content": (
            "Anaphylaxis is a severe, life-threatening systemic hypersensitivity reaction characterized by rapid onset "
            "airway compromise (stridor, wheeze), hemodynamic collapse (hypotension, dizziness), and mucosal swelling. "
            "Intramuscular epinephrine (1:1000) is the first-line medication; emergency medical services must be dispatched immediately."
        ),
        "source": "World Allergy Organization (WAO) Anaphylaxis Protocol",
        "tags": ["anaphylaxis", "allergy", "choking", "stridor", "swelling"]
    },
    {
        "id": "KB-METAB-005",
        "title": "ADA Diabetic Ketoacidosis & Hyperglycemic Crisis Overview",
        "category": "METABOLISM",
        "content": (
            "Diabetic ketoacidosis (DKA) is marked by hyperglycemia (> 250 mg/dL), metabolic acidosis, and elevated "
            "ketone bodies. Elevated exhaled volatile organic compounds (VOCs / acetone breath) combined with Kussmaul "
            "breathing and dehydration necessitates urgent hospital admission for intravenous fluid and insulin therapy."
        ),
        "source": "American Diabetes Association (ADA) Standards of Care",
        "tags": ["voc", "acetone", "diabetes", "dka", "glucose"]
    }
]


class KnowledgeChunk:
    def __init__(self, chunk_id: str, doc_id: str, text: str, source: str, tags: List[str]):
        self.chunk_id = chunk_id
        self.doc_id = doc_id
        self.text = text
        self.source = source
        self.tags = [t.lower() for t in tags]
        self.words = set(re.findall(r"\w+", text.lower()))


class KnowledgeBaseEngine:
    def __init__(self):
        self.chunks: List[KnowledgeChunk] = []
        self._initialize_default_knowledge()

    def _initialize_default_knowledge(self):
        """Task T3.7: Ingest and chunk default medical knowledge base."""
        for doc in DEFAULT_MEDICAL_KNOWLEDGE:
            self.add_document(doc["id"], doc["content"], doc["source"], doc["tags"])

    def add_document(self, doc_id: str, content: str, source: str, tags: List[str], chunk_size: int = 150):
        """Chunks long content by word boundary while preserving sentence structure."""
        sentences = re.split(r"(?<=[.!?])\s+", content)
        curr_chunk: List[str] = []
        curr_len = 0
        chunk_idx = 1

        for sent in sentences:
            words = sent.split()
            if curr_len + len(words) > chunk_size and curr_chunk:
                chunk_text = " ".join(curr_chunk)
                self.chunks.append(
                    KnowledgeChunk(f"{doc_id}-C{chunk_idx}", doc_id, chunk_text, source, tags)
                )
                chunk_idx += 1
                curr_chunk = []
                curr_len = 0
            curr_chunk.append(sent)
            curr_len += len(words)

        if curr_chunk:
            chunk_text = " ".join(curr_chunk)
            self.chunks.append(
                KnowledgeChunk(f"{doc_id}-C{chunk_idx}", doc_id, chunk_text, source, tags)
            )

    def retrieve(self, query: str, top_k: int = 3, threshold: float = 0.1) -> List[Dict[str, Any]]:
        """
        Task T3.8: Hybrid lexical-semantic relevance scoring.
        Calculates term overlap and tag matching against tokenized query words.
        """
        query_words = set(re.findall(r"\w+", query.lower()))
        if not query_words:
            return []

        scored_chunks = []
        for chk in self.chunks:
            # Term overlap score
            overlap = len(query_words.intersection(chk.words))
            tag_overlap = sum(2.0 for t in chk.tags if t in query.lower())
            
            raw_score = (overlap * 1.5 + tag_overlap) / (math.sqrt(len(chk.words)) + 1.0)
            if raw_score >= threshold:
                scored_chunks.append({
                    "chunk_id": chk.chunk_id,
                    "doc_id": chk.doc_id,
                    "text": chk.text,
                    "source": chk.source,
                    "score": round(raw_score, 3)
                })

        scored_chunks.sort(key=lambda x: x["score"], reverse=True)
        return scored_chunks[:top_k]


knowledge_engine = KnowledgeBaseEngine()
