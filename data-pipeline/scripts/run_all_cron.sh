# /opt/graduation-project/data-pipeline/scripts/run_all_cron.sh
#!/usr/bin/env bash
set -euo pipefail

# 크론/노헙(로그인 세션 없음)에서도 Selenium/Chrome이 안정적으로 뜨도록 환경 고정
export HOME=/home/ubuntu
export TZ=Asia/Seoul
export LANG=C.UTF-8
export LC_ALL=C.UTF-8
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin

PROJECT_DIR="/opt/graduation-project/data-pipeline"
VENV_PY="$PROJECT_DIR/.venv/bin/python"

LOG_DIR="$PROJECT_DIR/logs"
mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/run_all_cron_$(date +%F_%H%M%S).log"
LOCK_FILE="$LOG_DIR/run_all.lock"

# 락 파일 FD 9로 열기
exec 9>"$LOCK_FILE"
if ! /usr/bin/flock -n 9; then
  echo "[cron] skip (already running) $(date -Is) user=$(whoami) pwd=$(pwd)" >> "$LOG_FILE"
  exit 0
fi

# 로그 리다이렉트 (락을 잡은 경우에만)
exec >> "$LOG_FILE" 2>&1

# ---- 런타임/DBus(세션) 보강: cron(로그인 세션 없음)에서도 크롬이 죽지 않게 ----
uid="$(id -u)"

# 1) 가능한 경우 /run/user/<uid> 사용(가장 호환성 좋음)
# 2) 없으면 /tmp에 런타임 디렉토리 생성(폴백)
if [ -d "/run/user/$uid" ] && [ -w "/run/user/$uid" ]; then
  export XDG_RUNTIME_DIR="/run/user/$uid"
else
  export XDG_RUNTIME_DIR="/tmp/xdg-runtime-ubuntu-$uid"
  mkdir -p "$XDG_RUNTIME_DIR"
  chmod 700 "$XDG_RUNTIME_DIR"
fi

# snap chromium 계열에서 DBus가 없으면 바로 죽는 케이스가 있어,
# bus 소켓이 없으면 임시로 session bus를 직접 띄운다.
DBUS_PID=""
if [ ! -S "$XDG_RUNTIME_DIR/bus" ]; then
  if command -v dbus-daemon >/dev/null 2>&1; then
    # dbus-daemon이 주소/ pid를 stdout으로 내보내므로 이를 파싱
    # 예: unix:path=/tmp/xdg-runtime-ubuntu-1000/bus
    dbus_out="$(
      dbus-daemon --session --fork \
        --address="unix:path=$XDG_RUNTIME_DIR/bus" \
        --print-address=1 --print-pid=1
    )"
    # 첫 줄: address, 두 번째 줄: pid
    DBUS_ADDR="$(printf "%s" "$dbus_out" | sed -n '1p' || true)"
    DBUS_PID="$(printf "%s" "$dbus_out" | sed -n '2p' || true)"

    if [ -n "${DBUS_ADDR:-}" ]; then
      export DBUS_SESSION_BUS_ADDRESS="$DBUS_ADDR"
    else
      export DBUS_SESSION_BUS_ADDRESS="unix:path=$XDG_RUNTIME_DIR/bus"
    fi
  else
    # dbus-daemon이 없으면 주소만 맞춰두고 진행(필요 시 여기서 실패할 수 있음)
    export DBUS_SESSION_BUS_ADDRESS="unix:path=$XDG_RUNTIME_DIR/bus"
  fi
else
  export DBUS_SESSION_BUS_ADDRESS="unix:path=$XDG_RUNTIME_DIR/bus"
fi

# 종료 시점에 성공/실패를 "정확한 exit code"로 기록 + 필요하면 dbus 정리
_on_exit() {
  local ec=$?

  if [ -n "${DBUS_PID:-}" ]; then
    # 우리가 직접 띄운 dbus만 정리(없으면 noop)
    kill "$DBUS_PID" >/dev/null 2>&1 || true
  fi

  if [ "$ec" -eq 0 ]; then
    echo "[cron] done  $(date -Is) user=$(whoami) pwd=$(pwd)"
  else
    echo "[cron] FAIL  $(date -Is) exit=$ec user=$(whoami) pwd=$(pwd)"
  fi
}
trap _on_exit EXIT

echo "[cron] start $(date -Is) user=$(whoami) pwd=$(pwd)"
echo "[cron] env HOME=$HOME TZ=$TZ LANG=$LANG"
echo "[cron] env PATH=$PATH"
echo "[cron] env uid=$uid XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR"
echo "[cron] env DBUS_SESSION_BUS_ADDRESS=${DBUS_SESSION_BUS_ADDRESS:-<empty>}"
if [ -n "${DBUS_PID:-}" ]; then
  echo "[cron] dbus started pid=$DBUS_PID"
fi

cd "$PROJECT_DIR"
echo "[cron] cd $(pwd)"

"$VENV_PY" -m src.jobs.run_all
