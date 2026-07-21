#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  start.sh — launch the CFP Commons backend and frontend in one command.
#
#  Usage:
#    chmod +x start.sh      (only needed once)
#    ./start.sh             (normal start)
#    ./start.sh --seed      (start + force-seed the DB with test data first)
#    ./start.sh --reset     (wipe DB, re-seed, then start)
#
#  Note: database.py now auto-seeds itself on first startup if the cfps
#  table is empty, so --seed/--reset are mostly for forcing a clean reset
#  during local testing rather than a required day-to-day step.
# ─────────────────────────────────────────────────────────────────────────────

set -e

BACKEND_DIR="$(cd "$(dirname "$0")/cfp-backend" && pwd)"
FRONTEND_DIR="$(cd "$(dirname "$0")/cfp-frontend" && pwd)"
CONDA_ENV="cfpcommons"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[cfp]${NC} $1"; }
success() { echo -e "${GREEN}[cfp]${NC} $1"; }
warn()    { echo -e "${YELLOW}[cfp]${NC} $1"; }

echo ""
echo -e "${BLUE}┌─────────────────────────────────────┐${NC}"
echo -e "${BLUE}│       CFP Commons — Dev Server       │${NC}"
echo -e "${BLUE}└─────────────────────────────────────┘${NC}"
echo ""

if ! conda env list 2>/dev/null | grep -q "^${CONDA_ENV}"; then
  warn "Conda environment '${CONDA_ENV}' not found. Creating it…"
  conda create -n "$CONDA_ENV" python=3.12 -y
fi

CONDA_BASE=$(conda info --base)
source "${CONDA_BASE}/etc/profile.d/conda.sh"
conda activate "$CONDA_ENV"
success "Conda env '${CONDA_ENV}' activated."

if ! python -c "import fastapi" 2>/dev/null; then
  info "Installing Python dependencies…"
  pip install -r "${BACKEND_DIR}/requirements.txt" -q
  success "Python deps installed."
fi

if [ ! -f "${BACKEND_DIR}/.env" ]; then
  cp "${BACKEND_DIR}/.env.example" "${BACKEND_DIR}/.env"
  warn ".env not found — copied from .env.example."
  warn "Edit cfp-backend/.env to set a real ADMIN_KEY before sharing the site."
fi

if [[ "$1" == "--reset" ]]; then
  warn "--reset: deleting existing database…"
  rm -f "${BACKEND_DIR}/cfp_commons.db"
  success "Database wiped."
  SEED=true
fi

if [[ "$1" == "--seed" ]] || [[ "$SEED" == "true" ]]; then
  info "Force re-seeding database with test data…"
  (cd "$BACKEND_DIR" && python seed.py --force)
  success "Seed complete."
fi

if [ ! -d "${FRONTEND_DIR}/node_modules" ]; then
  info "Installing Node dependencies (first run only)…"
  (cd "$FRONTEND_DIR" && npm install --silent)
  success "Node deps installed."
fi

info "Starting FastAPI backend on http://localhost:8000 …"
(cd "$BACKEND_DIR" && uvicorn main:app --reload --port 8000) &
BACKEND_PID=$!

sleep 1

info "Starting Vite frontend on http://localhost:5173 …"
(cd "$FRONTEND_DIR" && npm run dev) &
FRONTEND_PID=$!

sleep 1
echo ""
echo -e "${GREEN}┌───────────────────────────────────────────────────┐${NC}"
echo -e "${GREEN}│  ✓ Both servers are running                        │${NC}"
echo -e "${GREEN}│                                                     │${NC}"
echo -e "${GREEN}│  Site (user view):  http://localhost:5173           │${NC}"
echo -e "${GREEN}│  Admin panel:       open admin.html in browser      │${NC}"
echo -e "${GREEN}│  API docs:          http://localhost:8000/docs      │${NC}"
echo -e "${GREEN}│  RSS feed:          http://localhost:8000/rss/all   │${NC}"
echo -e "${GREEN}│                                                     │${NC}"
echo -e "${GREEN}│  Press Ctrl+C to stop both servers                  │${NC}"
echo -e "${GREEN}└───────────────────────────────────────────────────┘${NC}"
echo ""

trap "echo ''; info 'Shutting down…'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGINT SIGTERM
wait
