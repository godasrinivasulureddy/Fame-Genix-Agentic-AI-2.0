"""
FAME-GENIX Historical Health Assessment Evaluation PDF Generator
Generates an exact, publication-grade replica of the Patient Portal 5-Tier
Assessment Template with full patient demographics / bio-data header.
"""

import io
from typing import Dict, Any, Optional
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

from app.db.models import Patient, RiskAssessment


def generate_assessment_evaluation_pdf(
    patient: Patient,
    assessment: RiskAssessment,
    serialized_assessment: Dict[str, Any],
    insight: Optional[Dict[str, Any]] = None,
) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    # Brand / Theme typography
    primary_color = colors.HexColor('#0f172a')
    accent_orange = colors.HexColor('#d97757')
    border_color = colors.HexColor('#cbd5e1')
    card_bg = colors.HexColor('#f8fafc')
    header_bg = colors.HexColor('#f1f5f9')

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=primary_color,
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#64748b'),
    )
    section_heading = ParagraphStyle(
        'TierHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#0f172a'),
        spaceBefore=8,
        spaceAfter=4,
    )
    body_text = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor('#1e293b'),
    )
    body_bold = ParagraphStyle(
        'BodyDarkBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor('#0f172a'),
    )

    story = []

    # -------------------------------------------------------------
    # HEADER BANNER
    # -------------------------------------------------------------
    eval_time = assessment.created_at.strftime('%Y-%m-%d %H:%M:%S UTC') if assessment.created_at else 'Recent Evaluation'
    banner_data = [
        [
            Paragraph("<b>FAME-GENIX 2.0</b> | Intelligent Health & Emergency Response System", title_style),
            Paragraph(f"<b>Assessment ID:</b> {assessment.id[:12]}…<br/><b>Evaluated:</b> {eval_time}", subtitle_style)
        ]
    ]
    banner_table = Table(banner_data, colWidths=[4.4 * inch, 2.6 * inch])
    banner_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(banner_table)
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=1.5, color=accent_orange, spaceBefore=2, spaceAfter=8))

    # -------------------------------------------------------------
    # PATIENT BIO DATA / DEMOGRAPHICS HEADER
    # -------------------------------------------------------------
    story.append(Paragraph("<b>PATIENT BIO-DATA & CLINICAL DEMOGRAPHICS</b>", section_heading))
    bio_data = [
        [
            Paragraph(f"<b>Patient Name:</b> {patient.full_name}", body_text),
            Paragraph(f"<b>UHID / Patient ID:</b> {patient.public_id or patient.id[:8]}", body_text),
            Paragraph(f"<b>Blood Group:</b> {patient.blood_group or 'Not Documented'}", body_text),
        ],
        [
            Paragraph(f"<b>Age / Sex:</b> {patient.age or 'N/A'} yrs / {patient.sex or 'N/A'}", body_text),
            Paragraph(f"<b>Height / Weight:</b> {getattr(patient, 'height_cm', None) or 'N/A'} cm / {getattr(patient, 'weight_kg', None) or 'N/A'} kg", body_text),
            Paragraph(f"<b>Primary SOS:</b> {patient.emergency_contact_name or 'N/A'} ({patient.emergency_contact_phone or 'N/A'})", body_text),
        ],
        [
            Paragraph(f"<b>Chronic Conditions:</b> {patient.known_conditions or 'None documented'}", body_text),
            Paragraph(f"<b>Known Allergies:</b> {patient.allergies or 'None documented'}", body_text),
            Paragraph(f"<b>Secondary SOS:</b> {patient.secondary_contact_name or 'N/A'} ({patient.secondary_contact_phone or 'N/A'})", body_text),
        ],
    ]
    bio_table = Table(bio_data, colWidths=[2.4 * inch, 2.4 * inch, 2.2 * inch])
    bio_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), card_bg),
        ('BOX', (0, 0), (-1, -1), 0.5, border_color),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(bio_table)
    story.append(Spacer(1, 10))

    # -------------------------------------------------------------
    # TIER 1: Telemetry & Anomaly Detection
    # -------------------------------------------------------------
    story.append(Paragraph("<b>TIER 1 · TELEMETRY & ANOMALY DETECTION</b>", section_heading))
    vitals = serialized_assessment.get("vitals") or {}
    hr = f"{vitals.get('heart_rate', '--')} bpm" if vitals.get('heart_rate') is not None else "Standard Baselines"
    spo2 = f"{vitals.get('spo2', '--')} %" if vitals.get('spo2') is not None else "Standard Baselines"
    rr = f"{vitals.get('respiratory_rate', '--')} rpm" if vitals.get('respiratory_rate') is not None else "Standard Baselines"
    temp = f"{vitals.get('temperature', '--')} °C" if vitals.get('temperature') is not None else "Standard Baselines"

    symptoms = serialized_assessment.get("active_symptoms") or []
    symptom_str = ", ".join([f"{s.get('name', '')} ({s.get('severity', '')})" if s.get('severity') else s.get('name', '') for s in symptoms]) or "Baseline / None"

    tier1_grid = [
        [
            Paragraph("<b>Heart Rate (Pulse):</b> " + hr, body_text),
            Paragraph("<b>Blood Oxygen (SpO2):</b> " + spo2, body_text),
            Paragraph("<b>Respiration Rate:</b> " + rr, body_text),
            Paragraph("<b>Temperature:</b> " + temp, body_text),
        ],
        [
            Paragraph(f"<b>Active Symptoms Reported:</b> {symptom_str}", body_text),
            "", "", ""
        ]
    ]
    t1_table = Table(tier1_grid, colWidths=[1.75 * inch, 1.75 * inch, 1.75 * inch, 1.75 * inch])
    t1_table.setStyle(TableStyle([
        ('SPAN', (0, 1), (3, 1)),
        ('BACKGROUND', (0, 0), (-1, -1), card_bg),
        ('BOX', (0, 0), (-1, -1), 0.5, border_color),
        ('INNERGRID', (0, 0), (-1, 0), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(t1_table)
    story.append(Spacer(1, 10))

    # -------------------------------------------------------------
    # TIER 2: Evidence-Grounded Reasoning Path
    # -------------------------------------------------------------
    story.append(Paragraph("<b>TIER 2 · EVIDENCE-GROUNDED REASONING PATH</b>", section_heading))
    signal = symptoms[0].get("name", "Normal Baseline") if symptoms else "Normal Baseline"
    action = "Immediate EMS Dispatch / Critical Evaluation" if assessment.care_level == "POSSIBLE_EMERGENCY" else "Tele-consultation & Observation"
    tier2_grid = [
        [
            Paragraph(f"<b>Detected Signal:</b> {signal}", body_text),
            Paragraph(f"<b>Clinical Rule:</b> Acuity Risk Engine / Safety Guardrail", body_text),
        ],
        [
            Paragraph("<b>Clinical Standards Citation:</b> American Heart Association (AHA) / ADA Standards of Care", body_text),
            Paragraph(f"<b>Recommended Action:</b> {action}", body_text),
        ]
    ]
    t2_table = Table(tier2_grid, colWidths=[3.5 * inch, 3.5 * inch])
    t2_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), card_bg),
        ('BOX', (0, 0), (-1, -1), 0.5, border_color),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(t2_table)
    story.append(Spacer(1, 10))

    # -------------------------------------------------------------
    # TIER 3: Multi Factor Health Risk Score & Visual Gauges
    # -------------------------------------------------------------
    story.append(Paragraph("<b>TIER 3 · MULTI-FACTOR HEALTH RISK SCORE & GAUGES</b>", section_heading))
    score = round(assessment.risk_score or 0)
    conf = round(assessment.confidence_score or 90)
    care = (assessment.care_level or "STABLE").replace("_", " ")

    status_eval = "Healthy Baseline Maintained (0-33 Safe)"
    if score >= 67:
        status_eval = "Action Recommended Immediately (67-100 High)"
    elif score >= 34:
        status_eval = "Moderate Caution Advised (34-66 Caution)"

    top_factors = serialized_assessment.get("top_factors") or []
    factor_items = [f"• {f.get('factor_name', '')}: {f.get('direction', '').replace('_', ' ')} ({f.get('contribution', '')})" for f in top_factors[:6]]
    factor_str = "<br/>".join(factor_items) if factor_items else "No adverse risk factors detected."

    tier3_grid = [
        [
            Paragraph(f"<b>Risk Score:</b> <font size=14 color='#d97757'><b>{score}%</b></font><br/><b>Care Level:</b> {care}<br/><b>AI Confidence:</b> {conf}%", body_text),
            Paragraph(f"<b>Overall Barometer:</b> <b>{status_eval}</b><br/><br/><b>Key Contributing Health Signals:</b><br/>{factor_str}", body_text),
        ]
    ]
    t3_table = Table(tier3_grid, colWidths=[2.3 * inch, 4.7 * inch])
    t3_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), card_bg),
        ('BOX', (0, 0), (-1, -1), 0.5, border_color),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(t3_table)
    story.append(Spacer(1, 10))

    # -------------------------------------------------------------
    # TIER 4: Doctor Consultation Requirement
    # -------------------------------------------------------------
    story.append(Paragraph("<b>TIER 4 · DOCTOR CONSULTATION REQUIREMENT</b>", section_heading))
    explanation = (insight and insight.get("explanation")) or "Based on clinical risk evaluation, routine vitals monitoring is active."
    spec = (insight and (insight.get("suggested_specialty") or (insight.get("specialist", {}) or {}).get("specialty"))) or "General Physician / Internal Medicine"
    
    tier4_grid = [
        [
            Paragraph(f"<b>Clinical Synthesis & Assessment:</b><br/>{explanation}", body_text),
        ],
        [
            Paragraph(f"<b>Recommended Specialist Consultation:</b> <font color='#d97757'><b>{spec}</b></font>", body_bold),
        ]
    ]
    t4_table = Table(tier4_grid, colWidths=[7.0 * inch])
    t4_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), card_bg),
        ('BOX', (0, 0), (-1, -1), 0.5, border_color),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(t4_table)
    story.append(Spacer(1, 10))

    # -------------------------------------------------------------
    # TIER 5: Food Recommendation & Home Tips to Recover
    # -------------------------------------------------------------
    story.append(Paragraph("<b>TIER 5 · FOOD RECOMMENDATION & HOME TIPS TO RECOVER</b>", section_heading))
    fg = (insight and insight.get("food_guidance")) or {}
    rec_foods = fg.get("recommended") or [
        {"title": "Electrolyte-rich fluids", "reason": "Coconut water and oral rehydration"},
        {"title": "Warm clear broths", "reason": "Ginger infusion and vegetable broth"},
        {"title": "Steamed vegetables & oats", "reason": "Easily digestible restorative nutrients"}
    ]
    limit_foods = fg.get("limit") or [
        {"title": "Excess sodium & salted snacks", "reason": "Can spike blood pressure and fluid retention"},
        {"title": "Heavy fried & spicy meals", "reason": "Strains metabolic recovery"},
        {"title": "Caffeine & energy drinks", "reason": "Can increase heart rate volatility"}
    ]
    self_care = (insight and insight.get("self_care")) or [
        {"title": "Rest in Semi-Upright Posture", "description": "Ensures optimal breathing capacity"},
        {"title": "Continuous Pulse & SpO2 Monitoring", "description": "Keep wearable sensors linked"},
        {"title": "Hydration Balance", "description": "Take small frequent sips of water throughout the day"}
    ]

    rec_food_str = "<br/>".join([f"• <b>{f.get('title') if isinstance(f, dict) else f}:</b> {f.get('reason', '') if isinstance(f, dict) else ''}" for f in rec_foods[:3]])
    limit_food_str = "<br/>".join([f"• <b>{f.get('title') if isinstance(f, dict) else f}:</b> {f.get('reason', '') if isinstance(f, dict) else ''}" for f in limit_foods[:3]])
    self_care_str = "<br/>".join([f"• <b>{c.get('title') if isinstance(c, dict) else c}:</b> {c.get('description', '') if isinstance(c, dict) else ''}" for c in self_care[:3]])

    tier5_grid = [
        [
            Paragraph(f"<b><font color='#16a34a'>Recommended Recovery Foods:</font></b><br/>{rec_food_str}", body_text),
            Paragraph(f"<b><font color='#dc2626'>Foods & Habits to Avoid / Limit:</font></b><br/>{limit_food_str}", body_text),
        ],
        [
            Paragraph(f"<b>Home Self-Care & Restorative Steps:</b><br/>{self_care_str}", body_text),
            ""
        ]
    ]
    t5_table = Table(tier5_grid, colWidths=[3.5 * inch, 3.5 * inch])
    t5_table.setStyle(TableStyle([
        ('SPAN', (0, 1), (1, 1)),
        ('BACKGROUND', (0, 0), (-1, -1), card_bg),
        ('BOX', (0, 0), (-1, -1), 0.5, border_color),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(t5_table)

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()
