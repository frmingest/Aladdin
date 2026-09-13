from app.domain.errors import UnsupportedFileTypeError
from app.services.documents.extraction.base import ExtractedFact, ExtractedPage, ExtractionResult
from app.services.documents.extraction.pdf import extract_pdf
from app.services.documents.extraction.pptx import extract_pptx
from app.services.documents.extraction.xlsx import extract_xlsx

__all__ = ["ExtractedFact", "ExtractedPage", "ExtractionResult", "extract"]


def extract(extension: str, content: bytes) -> ExtractionResult:
    if extension == ".pdf":
        return extract_pdf(content)
    if extension == ".pptx":
        return extract_pptx(content)
    if extension == ".xlsx":
        return extract_xlsx(content)
    raise UnsupportedFileTypeError(f"*{extension}", (".pdf", ".pptx", ".xlsx"))
