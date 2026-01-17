# data-pipeline/src/common/db.py
# DB 접속 설정을 한 군데로 모아두고, 다른 코드들이 DB 연결을 쉽게/일관되게 쓰게 하는 파일

import pymysql
from src.config.settings import settings

def get_conn(*, autocommit: bool = False):
    return pymysql.connect(
        host=settings.db_host,
        port=settings.db_port,
        user=settings.db_user,
        password=settings.db_password,
        database=settings.db_name,
        charset="utf8mb4",
        autocommit=autocommit,
        cursorclass=pymysql.cursors.DictCursor,
    )