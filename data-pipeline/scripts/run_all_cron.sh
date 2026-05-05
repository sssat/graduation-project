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

# EC2 cost guard.
# AUTO_STOP_EC2_AFTER_BATCH=1 stops this EC2 instance when the batch script exits.
# BATCH_TIMEOUT_SECONDS=21600 fails the batch after 6 hours so the instance does not stay up forever.
# Set AUTO_STOP_EC2_AFTER_BATCH=0 or BATCH_TIMEOUT_SECONDS=0 to disable each behavior.
AUTO_STOP_EC2_AFTER_BATCH="${AUTO_STOP_EC2_AFTER_BATCH:-1}"
BATCH_TIMEOUT_SECONDS="${BATCH_TIMEOUT_SECONDS:-21600}"
EXIT_HANDLER_RAN=0

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
_is_ec2_instance() {
  if command -v curl >/dev/null 2>&1; then
    local token=""
    token="$(
      curl -fsS -m 1 \
        -X PUT "http://169.254.169.254/latest/api/token" \
        -H "X-aws-ec2-metadata-token-ttl-seconds: 60" \
        2>/dev/null || true
    )"

    if [ -n "$token" ]; then
      if curl -fsS -m 1 \
        -H "X-aws-ec2-metadata-token: $token" \
        "http://169.254.169.254/latest/meta-data/instance-id" \
        >/dev/null 2>&1; then
        return 0
      fi
    fi

    if curl -fsS -m 1 \
      "http://169.254.169.254/latest/meta-data/instance-id" \
      >/dev/null 2>&1; then
      return 0
    fi
  fi

  if [ -r /sys/devices/virtual/dmi/id/sys_vendor ] &&
    grep -qi "Amazon EC2" /sys/devices/virtual/dmi/id/sys_vendor; then
    return 0
  fi

  if [ -r /sys/devices/virtual/dmi/id/product_uuid ] &&
    grep -qi "^EC2" /sys/devices/virtual/dmi/id/product_uuid; then
    return 0
  fi

  return 1
}

_stop_ec2_instance() {
  if [ "${AUTO_STOP_EC2_AFTER_BATCH:-1}" != "1" ]; then
    echo "[cron] auto EC2 stop disabled"
    return
  fi

  if ! _is_ec2_instance; then
    echo "[cron] auto EC2 stop skipped (not running on EC2)"
    return
  fi

  echo "[cron] stopping EC2 instance now $(date -Is)"

  if command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1; then
    sudo /sbin/shutdown -h now >/dev/null 2>&1 ||
      sudo shutdown -h now >/dev/null 2>&1 ||
      echo "[cron] WARN failed to run sudo shutdown"
    return
  fi

  /sbin/shutdown -h now >/dev/null 2>&1 ||
    shutdown -h now >/dev/null 2>&1 ||
    echo "[cron] WARN failed to run shutdown"
}

_on_exit() {
  local ec=$?

  if [ "${EXIT_HANDLER_RAN:-0}" = "1" ]; then
    return
  fi
  EXIT_HANDLER_RAN=1

  if [ -n "${DBUS_PID:-}" ]; then
    # 우리가 직접 띄운 dbus만 정리(없으면 noop)
    kill "$DBUS_PID" >/dev/null 2>&1 || true
  fi

  if [ "$ec" -eq 0 ]; then
    echo "[cron] done  $(date -Is) user=$(whoami) pwd=$(pwd)"
  else
    echo "[cron] FAIL  $(date -Is) exit=$ec user=$(whoami) pwd=$(pwd)"
  fi

  _stop_ec2_instance
}

_on_signal() {
  local sig="$1"
  echo "[cron] signal received sig=$sig $(date -Is)"

  case "$sig" in
    INT)
      exit 130
      ;;
    TERM)
      exit 143
      ;;
    *)
      exit 1
      ;;
  esac
}

trap _on_exit EXIT
trap '_on_signal INT' INT
trap '_on_signal TERM' TERM

echo "[cron] start $(date -Is) user=$(whoami) pwd=$(pwd)"
echo "[cron] env HOME=$HOME TZ=$TZ LANG=$LANG"
echo "[cron] env PATH=$PATH"
echo "[cron] env uid=$uid XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR"
echo "[cron] env DBUS_SESSION_BUS_ADDRESS=${DBUS_SESSION_BUS_ADDRESS:-<empty>}"
echo "[cron] env AUTO_STOP_EC2_AFTER_BATCH=$AUTO_STOP_EC2_AFTER_BATCH BATCH_TIMEOUT_SECONDS=$BATCH_TIMEOUT_SECONDS"
if [ -n "${DBUS_PID:-}" ]; then
  echo "[cron] dbus started pid=$DBUS_PID"
fi

cd "$PROJECT_DIR"
echo "[cron] cd $(pwd)"

if [ "${BATCH_TIMEOUT_SECONDS:-0}" -gt 0 ] && command -v timeout >/dev/null 2>&1; then
  timeout "${BATCH_TIMEOUT_SECONDS}s" "$VENV_PY" -m src.jobs.run_all
else
  "$VENV_PY" -m src.jobs.run_all
fi
