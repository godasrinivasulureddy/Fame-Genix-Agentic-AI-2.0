"""
FAME-GENIX Clinical Health Summary & Documentation PDF Generator
Leverages ReportLab to synthesize dynamic, patient-friendly and clinician-grade
PDF documents with date filtering, risk scoring, longitudinal vitals, and doctor notes.
"""

import io
from typing import List, Dict, Any, Optional
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

from app.db.models import (
    Patient, DeviceReading, RiskAssessment, DoctorReview, DoctorConsultationRequest
)


def generate_patient_clinical_pdf(
    patient: Patient,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    readings: Optional[List[DeviceReading]] = None,
    assessments: Optional[List[RiskAssessment]] = None,
    consultations: Optional[List[DoctorConsultationRequest]] = None,
    doctor_reviews: Optional[List[DoctorReview]] = None,
    include_sections: Optional[List[str]] = None,
) -> bytes:
    """
    Generates a high-quality clinical health documentation PDF with date filtering
    and custom section selection.
    """
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
    
    # Custom Brand Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0f172a'),
        alignment=0,
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#475569'),
    )
    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#0369a1'),
        spaceBefore=10,
        spaceAfter=6,
    )
    body_text = ParagraphStyle(
        'BodyTextCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#1e293b'),
    )
    badge_style = ParagraphStyle(
        'BadgeText',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#ffffff'),
        alignment=1,
    )

    story = []

    # 1. Header Banner
    header_table_data = [
        [
            Paragraph("<b>FAME-GENIX 2.0</b> | Intelligent Health & Emergency Response System", title_style),
            Paragraph(f"<b>Generated:</b> {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}<br/><b>Format:</b> Comprehensive Health Summary", subtitle_style)
        ]
    ]
    header_table = Table(header_table_data, colWidths=[4.2 * inch, 2.8 * inch])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#0284c7'), spaceBefore=2, spaceAfter=8))

    # 2. Patient Demographics & Profile Grid
    story.append(Paragraph("PATIENT CLINICAL DOSSIER", section_heading))
    
    date_filter_str = "All Historical Data"
    if start_date and end_date:
        date_filter_str = f"{start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}"
    elif start_date:
        date_filter_str = f"From {start_date.strftime('%Y-%m-%d')} onwards"
    elif end_date:
        date_filter_str = f"Up to {end_date.strftime('%Y-%m-%d')}"

    patient_grid = [
        [
            Paragraph(f"<b>Patient Name:</b> {patient.full_name}", body_text),
            Paragraph(f"<b>UHID / Patient ID:</b> {patient.public_id or patient.id[:8]}", body_text),
            Paragraph(f"<b>Blood Group:</b> {patient.blood_group or 'Not Documented'}", body_text)
        ],
        [
            Paragraph(f"<b>Age / Sex:</b> {patient.age or 'N/A'} yrs / {patient.sex or 'N/A'}", body_text),
            Paragraph(f"<b>Primary SOS:</b> {patient.emergency_contact_name or 'N/A'} ({patient.emergency_contact_phone or 'N/A'})", body_text),
            Paragraph(f"<b>Secondary SOS:</b> {patient.secondary_contact_name or 'N/A'} ({patient.secondary_contact_phone or 'N/A'})", body_text)
        ],
        [
            Paragraph(f"<b>Chronic Illnesses:</b> {patient.known_conditions or 'None documented'}", body_text),
            Paragraph(f"<b>Verified Allergies:</b> {patient.allergies or 'None documented'}", body_text),
            Paragraph(f"<b>Date Filter Range:</b> {date_filter_str}", body_text)
        ]
    ]
    p_table = Table(patient_grid, colWidths=[2.4 * inch, 2.4 * inch, 2.2 * inch])
    p_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(p_table)
    story.append(Spacer(1, 10))

    # 3. Recent Risk Assessments & AI Clinical Syntheses
    if not include_sections or "assessments" in include_sections:
        story.append(Paragraph("RISK ASSESSMENTS & PREDICTIVE CLINICAL TRIAGE", section_heading))
        if assessments:
            assessment_rows = [["Timestamp", "Care Level", "Risk Score", "Confidence", "Clinical Guidance & Factors"]]
            for a in assessments[:5]:
                care_color = "#16a34a" if a.care_level == "STABLE" else ("#ea580c" if a.care_level == "PRIORITY_REVIEW" else "#dc2626")
                care_p = Paragraph(f"<font color='{care_color}'><b>{a.care_level}</b></font>", body_text)
                guidance_p = Paragraph(f"{(a.suggested_action or 'Routine monitoring')[:120]}...", body_text)
                assessment_rows.append([
                    a.created_at.strftime("%Y-%m-%d %H:%M") if a.created_at else "N/A",
                    care_p,
                    f"{a.risk_score:.1f}%",
                    f"{a.confidence_score:.1f}%",
                    guidance_p
                ])
            a_table = Table(assessment_rows, colWidths=[1.2 * inch, 1.2 * inch, 0.8 * inch, 0.8 * inch, 3.0 * inch])
            a_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0284c7')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ]))
            story.append(a_table)
        else:
            story.append(Paragraph("<i>No risk assessments recorded for the selected date window.</i>", body_text))
        story.append(Spacer(1, 10))

    # 4. Device Physiological Telemetry History
    if not include_sections or "vitals" in include_sections:
        story.append(Paragraph("CONTINUOUS PHYSIOLOGICAL TELEMETRY LOG", section_heading))
        if readings:
            reading_rows = [["Recorded At", "Metric", "Value", "Unit", "Signal Quality", "Data Provenance"]]
            for r in readings[:10]:
                reading_rows.append([
                    r.recorded_at.strftime("%Y-%m-%d %H:%M:%S") if r.recorded_at else "N/A",
                    r.metric.upper(),
                    f"{r.value:.1f}",
                    r.unit,
                    r.quality or "GOOD",
                    r.source_type or "SIMULATED TELEMETRY"
                ])
            r_table = Table(reading_rows, colWidths=[1.5 * inch, 1.1 * inch, 0.8 * inch, 0.8 * inch, 1.2 * inch, 1.6 * inch])
            r_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#334155')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ]))
            story.append(r_table)
        else:
            story.append(Paragraph("<i>No continuous telemetry readings found in selected date interval.</i>", body_text))
        story.append(Spacer(1, 10))

    # 5. Doctor Consultations & Verified Clinical Notes
    if not include_sections or "consultations" in include_sections:
        story.append(Paragraph("PHYSICIAN CONSULTATIONS & SPECIALIST RECOMMENDATIONS", section_heading))
        if consultations:
            c_rows = [["Token #", "Specialty", "Status", "Requested At", "Doctor Clinical Summary"]]
            for c in consultations[:5]:
                summary_text = (c.health_summary or "Pending review")[:100]
                c_rows.append([
                    c.token_number,
                    c.specialty,
                    c.status,
                    c.requested_at.strftime("%Y-%m-%d %H:%M") if c.requested_at else "N/A",
                    Paragraph(summary_text, body_text)
                ])
            c_table = Table(c_rows, colWidths=[1.0 * inch, 1.3 * inch, 1.0 * inch, 1.2 * inch, 2.5 * inch])
            c_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f766e')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ]))
            story.append(c_table)
        else:
            story.append(Paragraph("<i>No specialist consultation cases registered for this interval.</i>", body_text))
        story.append(Spacer(1, 14))

    # 6. Legal / Clinical Compliance Disclaimer Footer
    disclaimer_text = (
        "<b>CLINICAL DISCLAIMER & NOTICE:</b> This health documentation was dynamically generated by the "
        "FAME-GENIX 2.0 Intelligent Healthcare Ecosystem. Physiological device telemetry and emergency state machine "
        "transitions operate under clinical decision-support and simulated validation protocols. "
        "This document is intended for authorized healthcare providers, patients, and emergency response teams."
    )
    story.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor('#94a3b8'), spaceBefore=6, spaceAfter=6))
    story.append(Paragraph(disclaimer_text, ParagraphStyle('Disclaimer', parent=styles['Normal'], fontName='Helvetica-Oblique', fontSize=7, leading=9, textColor=colors.HexColor('#64748b'))))

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()
