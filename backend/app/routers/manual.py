from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from ..services import manual

router = APIRouter(prefix="/api/manual", tags=["ajuda"])


@router.get("")
def read_manual():
    text = manual.manual_text()
    if not text:
        raise HTTPException(404, "Manual não encontrado")
    return {"markdown": text, "has_pdf": manual.MANUAL_PDF.exists()}


@router.get("/pdf")
def manual_pdf():
    if not manual.MANUAL_PDF.exists():
        raise HTTPException(404, "PDF do manual não encontrado")
    return FileResponse(manual.MANUAL_PDF, filename="Manual do Nexos ERP.pdf", media_type="application/pdf")
