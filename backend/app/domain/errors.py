"""
Ingestion error types (architecture §21: "fail visibly rather than silently
invent"). These map to 4xx responses in the API layer — see app/api/*.py.
"""


class IngestionError(Exception):
    """Base class for errors surfaced to the caller as a 4xx, not a 500."""


class UnsupportedFileTypeError(IngestionError):
    def __init__(self, filename: str, allowed_extensions: tuple[str, ...]):
        self.filename = filename
        self.allowed_extensions = allowed_extensions
        super().__init__(
            f"'{filename}' has an unsupported file type. Allowed: {', '.join(allowed_extensions)}"
        )


class FileTooLargeError(IngestionError):
    def __init__(self, filename: str, size_bytes: int, max_bytes: int):
        self.filename = filename
        self.size_bytes = size_bytes
        self.max_bytes = max_bytes
        super().__init__(
            f"'{filename}' is {size_bytes} bytes, exceeding the {max_bytes}-byte limit"
        )


class UnreadableFileError(IngestionError):
    def __init__(self, filename: str, reason: str):
        self.filename = filename
        self.reason = reason
        super().__init__(f"'{filename}' could not be read: {reason}")


class PortfolioValidationError(IngestionError):
    """Raised when one or more rows in a portfolio upload fail validation.

    `row_errors` is a list of {"row": int, "field": str | None, "message": str}
    so the caller can show the user exactly what to fix, rather than a single
    opaque failure (§21).
    """

    def __init__(self, row_errors: list[dict]):
        self.row_errors = row_errors
        super().__init__(f"{len(row_errors)} row(s) failed validation")
