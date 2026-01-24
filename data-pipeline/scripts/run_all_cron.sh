#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/opt/graduation-project/data-pipeline"
VENV_PY="$PROJECT_DIR/.venv/bin/python"

LOG_DIR="$PROJECT_DIR/logs"
mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/run_all_cron_$(date +%F_%H%M%S).log"
LOCK_FILE="$LOG_DIR/run_all.lock"

# 에러 나면 로그에 남기기
trap 'echo "[cron] FAIL $(date -Is) exit=$? user=$(whoami) pwd=$(pwd)"' ERR

# 락 파일 FD 9로 열기
exec 9>"$LOCK_FILE"
if ! /usr/bin/flock -n 9; then
  echo "[cron] skip (already running) $(date -Is) user=$(whoami) pwd=$(pwd)" >> "$LOG_FILE"
  exit 0
fi

# 로그 리다이렉트 (락을 잡은 경우에만)
exec >> "$LOG_FILE" 2>&1

echo "[cron] start $(date -Is) user=$(whoami) pwd=$(pwd)"
cd "$PROJECT_DIR"
echo "[cron] cd $(pwd)"

"$VENV_PY" -m src.jobs.run_all

echo "[cron] done  $(date -Is)"
