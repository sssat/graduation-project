# data-pipeline/src/analyzer/cooc_network/storage/cooc_writer.py
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Dict, Iterable, List, Optional, Sequence, Tuple
from zoneinfo import ZoneInfo

from src.common.db import get_conn
from src.config.settings import settings
from src.analyzer.cooc_network.core.cooc_network import CoocEdge, CoocNode


@dataclass(frozen=True)
class CoocHeaderKey:
    """
    스키마(A안) 기준 공동언급 그래프 헤더 키
    - TEXT_SOURCE는 스키마에 없으므로 저장 차원에서 제외한다.
    """
    trend_run_seq: int
    keyword_seq: int
    media_code: int
    period_filter: str  # TODAY | D7 | D14 | D30


def _now_local_naive() -> datetime:
    """
    MySQL DATETIME은 tz 정보를 저장하지 않는다.
    드라이버 호환/안전성을 위해 로컬 타임존으로 맞춘 뒤 tzinfo를 제거한 naive datetime을 반환한다.
    """
    tz = ZoneInfo(settings.tz)
    return datetime.now(tz=tz).replace(tzinfo=None)


def _normalize_periods(periods: Sequence[str]) -> List[str]:
    out: List[str] = []
    for p in periods or []:
        s = str(p).strip().upper()
        if not s:
            continue
        if s not in {"TODAY", "D7", "D14", "D30"}:
            raise ValueError(f"지원하지 않는 period_filter: {p}")
        out.append(s)
    return out


def delete_cooc_for_run_periods(
    *,
    trend_run_seq: int,
    periods: Sequence[str],
    media_codes: Optional[Sequence[int]] = None,
    keyword_seqs: Optional[Sequence[int]] = None,
) -> int:
    """
    refresh용: 해당 run+period(+media_codes/+keyword_seqs)의 공동언급 결과를 전부 삭제한다.
    - 스키마(A안): T_ANALYZE_CO_MENTION_GRAPH/NODE/EDGE 사용
    - FK cascade를 가정하지 않고 edge -> node -> graph 순으로 삭제한다.
    - 반환: 삭제된 GRAPH 개수
    """
    periods_n = _normalize_periods(periods)
    if not periods_n:
        return 0

    mcs: Optional[List[int]] = None
    if media_codes is not None:
        mcs = [int(x) for x in media_codes]
        if not mcs:
            return 0

    kss: Optional[List[int]] = None
    if keyword_seqs is not None:
        kss = [int(x) for x in keyword_seqs]
        if not kss:
            return 0

    conn = get_conn(autocommit=True)
    try:
        with conn.cursor() as cur:
            pf_ph = ",".join(["%s"] * len(periods_n))
            params: List[object] = [int(trend_run_seq), *periods_n]

            where_extra = ""
            if mcs is not None:
                mc_ph = ",".join(["%s"] * len(mcs))
                where_extra += f" AND MEDIA_CODE IN ({mc_ph})"
                params.extend(mcs)

            if kss is not None:
                ks_ph = ",".join(["%s"] * len(kss))
                where_extra += f" AND KEYWORD_SEQ IN ({ks_ph})"
                params.extend(kss)

            cur.execute(
                f"""
                SELECT GRAPH_SEQ AS graph_seq
                FROM T_ANALYZE_CO_MENTION_GRAPH
                WHERE TREND_RUN_SEQ = %s
                  AND PERIOD_FILTER IN ({pf_ph})
                  {where_extra}
                """,
                tuple(params),
            )
            rows = cur.fetchall() or []
            graph_seqs = [int(r["graph_seq"]) for r in rows]
            if not graph_seqs:
                return 0

            gs_ph = ",".join(["%s"] * len(graph_seqs))

            # edge -> node -> graph
            cur.execute(f"DELETE FROM T_ANALYZE_CO_MENTION_EDGE WHERE GRAPH_SEQ IN ({gs_ph})", tuple(graph_seqs))
            cur.execute(f"DELETE FROM T_ANALYZE_CO_MENTION_NODE WHERE GRAPH_SEQ IN ({gs_ph})", tuple(graph_seqs))
            cur.execute(f"DELETE FROM T_ANALYZE_CO_MENTION_GRAPH WHERE GRAPH_SEQ IN ({gs_ph})", tuple(graph_seqs))

            return int(len(graph_seqs))
    finally:
        conn.close()


def upsert_cooc_header_and_get_seq(
    *,
    key: CoocHeaderKey,
    node_count: int,
    edge_count: int,
) -> int:
    """
    GRAPH 헤더 upsert 후 GRAPH_SEQ를 조회한다.
    - CREATED_AT은 '최초 생성 시각'이므로, 중복 갱신 시 절대 업데이트하지 않는다.
    - INSERT 시 CREATED_AT은 DB DEFAULT(CURRENT_TIMESTAMP)에 맡긴다.
    """
    pf = str(key.period_filter).strip().upper()
    if pf not in {"TODAY", "D7", "D14", "D30"}:
        raise ValueError(f"지원하지 않는 period_filter: {key.period_filter}")

    sql = """
        INSERT INTO T_ANALYZE_CO_MENTION_GRAPH (
            TREND_RUN_SEQ,
            KEYWORD_SEQ,
            MEDIA_CODE,
            PERIOD_FILTER,
            NODE_COUNT,
            EDGE_COUNT
        )
        VALUES (%s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            NODE_COUNT = VALUES(NODE_COUNT),
            EDGE_COUNT = VALUES(EDGE_COUNT)
    """

    conn = get_conn(autocommit=True)
    try:
        with conn.cursor() as cur:
            cur.execute(
                sql,
                (
                    int(key.trend_run_seq),
                    int(key.keyword_seq),
                    int(key.media_code),
                    pf,
                    int(node_count),
                    int(edge_count),
                ),
            )

            cur.execute(
                """
                SELECT GRAPH_SEQ AS graph_seq
                FROM T_ANALYZE_CO_MENTION_GRAPH
                WHERE TREND_RUN_SEQ = %s
                  AND KEYWORD_SEQ = %s
                  AND MEDIA_CODE = %s
                  AND PERIOD_FILTER = %s
                """,
                (int(key.trend_run_seq), int(key.keyword_seq), int(key.media_code), pf),
            )
            row = cur.fetchone()
            if not row:
                raise RuntimeError("GRAPH header upsert 후 GRAPH_SEQ 조회에 실패했습니다.")
            return int(row["graph_seq"])
    finally:
        conn.close()


def replace_cooc_nodes_edges(
    *,
    graph_seq: int,
    nodes: Iterable[CoocNode],
    edges: Iterable[CoocEdge],
) -> None:
    """
    특정 GRAPH_SEQ의 node/edge를 전부 교체한다.
    - 입력 nodes: CoocNode(token, doc_freq, total_freq, rank)  (코어 결과)
    - 입력 edges: CoocEdge(src, dst, weight, rank)             (코어 결과)

    스키마(A안) 매핑:
    - NODE.ENTITY_NAME  <- node.token
    - NODE.NODE_WEIGHT  <- node.total_freq (기본)
    - EDGE.FROM/TO_NODE_SEQ <- src/dst 토큰을 노드 PK로 매핑
    - EDGE.CO_MENTION_COUNT <- edge.weight
    - EDGE.EDGE_WEIGHT      <- edge.weight

    주의:
    - 스키마는 (GRAPH_SEQ, FROM_NODE_SEQ, TO_NODE_SEQ) 유니크이므로,
      엣지는 무방향으로 보고 (from,to)를 정렬해 중복을 합산한다.
    - ENTITY_NAME 길이(120) 초과/빈 값은 스킵한다.
    """
    nodes_list: List[CoocNode] = list(nodes)
    edges_list: List[CoocEdge] = list(edges)

    conn = get_conn(autocommit=False)
    try:
        with conn.cursor() as cur:
            # 기존 데이터 삭제 (edge -> node)
            cur.execute("DELETE FROM T_ANALYZE_CO_MENTION_EDGE WHERE GRAPH_SEQ = %s", (int(graph_seq),))
            cur.execute("DELETE FROM T_ANALYZE_CO_MENTION_NODE WHERE GRAPH_SEQ = %s", (int(graph_seq),))

            if not nodes_list:
                conn.commit()
                return

            created_at = _now_local_naive()

            # 노드 입력 정리(중복/빈값/길이 제한 방어)
            seen: set[str] = set()
            node_rows: List[Tuple[int, str, str, Decimal, datetime]] = []
            for n in nodes_list:
                token = str(n.token or "").strip()
                if not token:
                    continue
                if len(token) > 120:
                    # 트렁케이트는 충돌 위험이 있으므로 스킵
                    continue
                if token in seen:
                    continue
                seen.add(token)

                weight = int(getattr(n, "total_freq", 0) or 0)
                node_rows.append((int(graph_seq), token, "ETC", Decimal(weight), created_at))

            if not node_rows:
                conn.commit()
                return

            # 노드 삽입 (ENTITY_TYPE은 기본 'ETC' 사용)
            cur.executemany(
                """
                INSERT INTO T_ANALYZE_CO_MENTION_NODE (
                    GRAPH_SEQ,
                    ENTITY_NAME,
                    ENTITY_TYPE,
                    NODE_WEIGHT,
                    CREATED_AT
                )
                VALUES (%s, %s, %s, %s, %s)
                """,
                node_rows,
            )

            # 토큰 -> NODE_SEQ 매핑
            cur.execute(
                """
                SELECT NODE_SEQ AS node_seq, ENTITY_NAME AS entity_name
                FROM T_ANALYZE_CO_MENTION_NODE
                WHERE GRAPH_SEQ = %s
                """,
                (int(graph_seq),),
            )
            rows = cur.fetchall() or []
            token_to_node_seq: Dict[str, int] = {str(r["entity_name"]): int(r["node_seq"]) for r in rows}

            # 엣지 중복 방지(무방향 정규화 + 가중치 합산)
            merged: Dict[Tuple[int, int], int] = {}
            for e in edges_list:
                src = str(e.src or "").strip()
                dst = str(e.dst or "").strip()
                if not src or not dst:
                    continue

                a = token_to_node_seq.get(src)
                b = token_to_node_seq.get(dst)
                if a is None or b is None:
                    # 노드에 없는 토큰이면 스킵(입력 불일치 방어)
                    continue
                if a == b:
                    continue

                w = int(getattr(e, "weight", 0) or 0)
                if w <= 0:
                    continue

                lo, hi = (a, b) if a < b else (b, a)
                merged[(lo, hi)] = merged.get((lo, hi), 0) + w

            if merged:
                cur.executemany(
                    """
                    INSERT INTO T_ANALYZE_CO_MENTION_EDGE (
                        GRAPH_SEQ,
                        FROM_NODE_SEQ,
                        TO_NODE_SEQ,
                        CO_MENTION_COUNT,
                        EDGE_WEIGHT,
                        CREATED_AT
                    )
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    [
                        (
                            int(graph_seq),
                            int(lo),
                            int(hi),
                            int(w),
                            Decimal(w),
                            created_at,
                        )
                        for (lo, hi), w in merged.items()
                    ],
                )

            conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
