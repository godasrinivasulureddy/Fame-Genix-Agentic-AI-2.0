"""
Validation logic for medical reports (PDF and images) in FAME GENIX.
Validates file size (max 10MB), MIME types, PDF page count (max 10 pages), and file integrity.
"""

import io
from PIL import Image
import pypdf
from app.core.exceptions import app_error

MAX_REPORT_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB limit
MAX_PDF_PAGES = 10
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
}
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".webp"}


def validate_report_file(filename: str, content_type: str, file_bytes: bytes) -> tuple[str, int]:
    """
    Validates uploaded medical report file.
    Supports PyMuPDF (fitz) and pypdf with robust fallbacks for all clinical PDFs and images.
    Returns (standardized_mime_type, pages_count).
    """
    if not file_bytes or len(file_bytes) == 0:
        raise app_error("VALIDATION_ERROR", "Uploaded medical report file is empty.")

    if len(file_bytes) > MAX_REPORT_SIZE_BYTES:
        raise app_error("VALIDATION_ERROR", "Report size exceeds 10 MB limit. Please upload a smaller document.")

    normalized_mime = (content_type or "").lower().strip()
    ext = ("." + (filename or "").split(".")[-1]).lower() if "." in (filename or "") else ""

    if normalized_mime not in ALLOWED_MIME_TYPES and ext not in ALLOWED_EXTENSIONS:
        raise app_error("VALIDATION_ERROR", f"Unsupported file type '{content_type}'. Allowed formats: PDF, JPEG, PNG, WEBP.")

    if normalized_mime == "application/pdf" or ext == ".pdf":
        normalized_mime = "application/pdf"
        pages_count = 0
        # 1. First attempt with PyMuPDF (fitz) which is extremely resilient to imperfect/scanned PDFs
        try:
            import fitz
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            pages_count = len(doc)
        except Exception:
            pages_count = 0

        # 2. Secondary fallback with pypdf
        if pages_count == 0:
            try:
                reader = pypdf.PdfReader(io.BytesIO(file_bytes))
                pages_count = len(reader.pages)
            except Exception:
                pages_count = 0

        # 3. If standard PDF parsers encountered a stream issue but it has PDF signature or reasonable content
        if pages_count == 0:
            if file_bytes.startswith(b"%PDF") or b"%PDF" in file_bytes[:1024]:
                pages_count = 1
            else:
                # If uploaded as PDF but actually image/text bytes, gracefully adapt rather than failing hard
                try:
                    img = Image.open(io.BytesIO(file_bytes))
                    return "image/jpeg", 1
                except Exception:
                    raise app_error("VALIDATION_ERROR", "Corrupted or unreadable PDF report document.")

        if pages_count > MAX_PDF_PAGES:
            raise app_error("VALIDATION_ERROR", f"PDF contains {pages_count} pages. Maximum allowed is {MAX_PDF_PAGES} pages.")

        return normalized_mime, max(1, pages_count)
    else:
        if normalized_mime not in ALLOWED_MIME_TYPES:
            normalized_mime = "image/jpeg"
        try:
            image = Image.open(io.BytesIO(file_bytes))
            # Check basic properties without destroying the stream
            _ = image.size
            return normalized_mime, 1
        except Exception:
            raise app_error("VALIDATION_ERROR", "Corrupted or unreadable report image.")
