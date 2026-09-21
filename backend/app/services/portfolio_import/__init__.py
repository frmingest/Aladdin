"""Portfolio CSV import — parses a per-account Nordnet-style broker export
(tab-delimited, UTF-16LE, Norwegian decimal comma) into a traceable
Document + PortfolioSnapshot + PortfolioPositions. See csv_parser.py for
the file-format handling and ingestion.py for the DB side.
"""
