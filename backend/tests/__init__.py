import os

# §26 Phase 4: app.main starts a background APScheduler on import (via its
# lifespan) unless ENABLE_SCHEDULER=false. The authoritative place this is
# set is backend/conftest.py (loaded before any conftest.py or package
# __init__.py nested under it — see that file's docstring for why this
# line alone isn't reliably early enough). Kept here too, harmlessly, as a
# second line of defense for any tool that imports this package directly
# without going through pytest's conftest loading.
os.environ.setdefault("ENABLE_SCHEDULER", "false")
