# data-pipeline/src/common/logger.py
# 프로그램 로그를 콘솔 + 파일에 자동으로 남기게 세팅해주는 공통 설정 파일

import logging
from logging.handlers import TimedRotatingFileHandler
from pathlib import Path

from src.config.settings import settings, PROJECT_ROOT


def setup_logging(app_name: str = "pipeline") -> logging.Logger:
    level_name = settings.log_level.upper()
    level = getattr(logging, level_name, logging.INFO)

    # 공통 텍스트 로그는 프로젝트 루트 기준 logs/에 저장
    log_path = Path(PROJECT_ROOT) / "logs"
    log_path.mkdir(parents=True, exist_ok=True)

    logger = logging.getLogger(app_name)
    logger.setLevel(level)
    logger.propagate = False

    fmt = logging.Formatter(
        fmt="%(asctime)s %(levelname)s %(name)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # 중복 핸들러 방지 + (레벨 변경 시 반영)
    if logger.handlers:
        for h in logger.handlers:
            h.setLevel(level)
            h.setFormatter(fmt)
        return logger

    # 콘솔
    sh = logging.StreamHandler()
    sh.setLevel(level)
    sh.setFormatter(fmt)
    logger.addHandler(sh)

    # 로그 파일은 최근 10개씩만 보관
    fh = TimedRotatingFileHandler(
        filename=str(log_path / f"{app_name}.log"),
        when="midnight",
        interval=1,
        backupCount=10,
        encoding="utf-8",
        utc=False,
    )
    fh.setLevel(level)
    fh.setFormatter(fmt)
    logger.addHandler(fh)

    logger.info("Logger initialized (level=%s, dir=%s)", level_name, log_path.resolve())
    logger.info("DB=%s@%s:%s/%s", settings.db_user, settings.db_host, settings.db_port, settings.db_name)
    return logger