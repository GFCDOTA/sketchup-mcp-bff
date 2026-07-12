"""hoje_mirror.py — a tela HOJE: central de trabalho orientada a exceções.

Agrega o que os outros mirrors JÁ leem de arquivo (zero fonte nova, zero import do
motor) e responde as 3 perguntas da régua dos 5 segundos (design do GPT, 2026-07-12):
  1. o sistema está funcionando?   → `autonomy` (RODANDO/QUIETO/PARADO + bloqueios)
  2. o que ele está fazendo?       → `missions` (unidade = MISSÃO por tema, não evento)
  3. o que precisa de MIM?         → `inbox` (só o que exige decisão humana)

Todo item carrega a etiqueta de QUEM AGE AGORA: SISTEMA_AGINDO | ESPERA_VOCE |
BLOQUEADO — a confusão nº 1 do Felipe ("não sei o que é autônomo e o que espera
por mim") vira um campo explícito. Jargão do motor NÃO sai daqui: os textos são
resultado humano ("o crítico visual já deu nota em 8"), nunca feeder/COMMITTED.

Degradação honesta: fonte ausente → bloco vazio + estado PARADO, nunca mock.
"""
from __future__ import annotations

import time

import carteiro_run_mirror as carteiro
import curation_mirror as curation
import noc_mirror

# statuses de falha do ledger (bloqueio real até um run posterior do MESMO task_id
# terminar bem — o load_ledger já é last-wins por task_id, então basta olhar o último)
FAIL_STATUSES = {"VERIFY_FAILED", "WT_ADD_FAILED", "PUSH_FAILED"}

RODANDO_S = 20 * 60      # última atividade < 20min → sistema RODANDO (tick ~15min)
QUIETO_S = 2 * 3600      # < 2h → QUIETO; além disso → PARADO
BLOQUEIO_JANELA_S = 24 * 3600

ET_SISTEMA = "SISTEMA_AGINDO"
ET_VOCE = "ESPERA_VOCE"
ET_BLOQUEADO = "BLOQUEADO"


def _num(v) -> float | None:
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def _last_activity_ts(cur: dict, runs: dict, ledger: dict) -> float | None:
    """Timestamp mais recente entre: laço de curadoria, juiz automático e atuador."""
    cands: list[float] = []
    t = _num((cur.get("autonomy") or {}).get("last_t"))
    if t:
        cands.append(t)
    for r in (runs.get("runs") or [])[:1]:
        t = _num(r.get("t"))
        if t:
            cands.append(t)
    for tsk in (ledger.get("tasks") or [])[:5]:
        t = _num(tsk.get("ts"))
        if t:
            cands.append(t)
    return max(cands) if cands else None


def _autonomy_block(cur: dict, runs: dict, ledger: dict, lock: dict, now: float) -> dict:
    last = _last_activity_ts(cur, runs, ledger)
    age = (now - last) if last else None
    if lock.get("alive") or (age is not None and age < RODANDO_S):
        estado = "RODANDO"
    elif age is not None and age < QUIETO_S:
        estado = "QUIETO"
    else:
        estado = "PARADO"

    # bloqueios: último status do task_id é falha E recente (janela 24h)
    bloqueios = []
    for tsk in ledger.get("tasks") or []:
        ts = _num(tsk.get("ts"))
        if tsk.get("status") in FAIL_STATUSES and ts and (now - ts) <= BLOQUEIO_JANELA_S \
                and not tsk.get("dryRun"):
            bloqueios.append({
                "task_id": tsk.get("taskId"),
                "titulo": tsk.get("title") or tsk.get("taskId"),
                "status": tsk.get("status"),
                "quando": ts,
            })
    return {
        "estado": estado,
        "ultima_atividade": last,
        "proximo_ciclo_s": max(0, int(15 * 60 - age)) if (age is not None and estado == "RODANDO") else None,
        "atuador_vivo": bool(lock.get("alive")),
        "bloqueios": bloqueios[:8],
        "n_bloqueios": len(bloqueios),
    }


def _missions_block(cur: dict, queue_pending: int) -> list[dict]:
    """Missão = (plant, tema): o agrupamento que faz sentido humano. Concluída
    (nada esperando ninguém) não aparece — 'Hoje' mostra trabalho em andamento."""
    groups: dict[str, dict] = {}
    plant = cur.get("plant") or "planta_74"
    for v in cur.get("variants") or []:
        if v.get("synthetic"):
            continue
        theme = v.get("theme") or (v.get("params") or {}).get("style") or "sem tema"
        g = groups.setdefault(theme, {
            "plant": plant, "tema": theme, "n_variantes": 0, "melhor_nota": None,
            "n_esperando_voce": 0, "n_em_revisao": 0, "notas": []})
        g["n_variantes"] += 1
        nota = _num(v.get("gpt_nota"))
        if nota is not None:
            g["notas"].append(nota)
            if g["melhor_nota"] is None or nota > g["melhor_nota"]:
                g["melhor_nota"] = nota
        if v.get("verdict") == "PENDING_VISION":
            g["n_em_revisao"] += 1
        elif not v.get("human_verdict"):
            g["n_esperando_voce"] += 1

    missions = []
    for g in groups.values():
        del g["notas"]
        if g["n_esperando_voce"] > 0:
            g["etiqueta"] = ET_VOCE
            g["proxima_acao"] = (f"você dá o veredito em {g['n_esperando_voce']} "
                                 f"variante(s) (IMPROVED/SAME/WORSE)")
        elif g["n_em_revisao"] > 0:
            g["etiqueta"] = ET_SISTEMA
            g["proxima_acao"] = f"o crítico visual vai julgar {g['n_em_revisao']} variante(s)"
        else:
            continue  # missão sem pendência de ninguém → não é "em andamento"
        g["titulo"] = f"{plant} · {g['tema']}"
        missions.append(g)

    # trabalho na fila do atuador sem missão de tema = missão genérica do sistema
    if queue_pending > 0:
        missions.append({
            "plant": plant, "tema": None,
            "titulo": "Fila do atuador",
            "etiqueta": ET_SISTEMA,
            "n_variantes": None, "melhor_nota": None,
            "n_esperando_voce": 0, "n_em_revisao": queue_pending,
            "proxima_acao": f"o sistema executa {queue_pending} tarefa(s) da fila no próximo ciclo",
        })
    # ESPERA_VOCE primeiro (é o que importa), depois sistema
    missions.sort(key=lambda m: (m["etiqueta"] != ET_VOCE, -(m.get("n_esperando_voce") or 0)))
    return missions


def _inbox_block(cur: dict, decisions: list[dict] | None) -> list[dict]:
    """Só o que exige decisão HUMANA. Gosto agrupado por missão (navegação em lote,
    decisão sempre individual — regra dura)."""
    inbox: list[dict] = []
    plant = cur.get("plant") or "planta_74"
    per_theme: dict[str, int] = {}
    for v in cur.get("variants") or []:
        if v.get("synthetic") or v.get("verdict") == "PENDING_VISION" or v.get("human_verdict"):
            continue
        theme = v.get("theme") or "sem tema"
        per_theme[theme] = per_theme.get(theme, 0) + 1
    for theme, n in sorted(per_theme.items(), key=lambda kv: -kv[1]):
        inbox.append({
            "tipo": "gosto",
            "titulo": f"Dar seu veredito em {n} variante(s) — {theme}",
            "detalhe": "IMPROVED / SAME / WORSE — só você decide gosto",
            "n": n, "plant": plant, "tema": theme,
            "rota": "/curation",
        })
    for d in decisions or []:
        if d.get("status") != "pending":
            continue
        inbox.append({
            "tipo": "decisao",
            "titulo": d.get("title") or "Decisão pendente",
            "detalhe": d.get("question") or "",
            "n": 1, "rota": "/decisions", "id": d.get("id"),
        })
    return inbox


def hoje_view(decisions: list[dict] | None = None, plant: str = "planta_74",
              now: float | None = None) -> dict:
    """GET /api/hoje — o payload da home. `decisions` vem do caller (cockpit_api
    já as deriva do state; este módulo não re-deriva pra não duplicar a lógica)."""
    now = now if now is not None else time.time()
    cur = curation.curation_view(plant)
    ledger = noc_mirror.load_ledger(80)
    lock = noc_mirror.lock_state()
    runs = carteiro.runs_view(5)
    status = noc_mirror.status_view()
    # pendente na fila = linhas da fila − tasks com status terminal não é derivável
    # aqui sem o motor; aproximação honesta: fila conta linhas, o ledger conta tasks.
    queue_pending = max(0, int(status.get("queueCount") or 0) - int(status.get("taskCount") or 0))

    autonomy = _autonomy_block(cur, runs, ledger, lock, now)
    missions = _missions_block(cur, queue_pending)
    inbox = _inbox_block(cur, decisions)
    autonomy["n_esperando_voce"] = sum(int(i.get("n") or 0) for i in inbox)
    if autonomy["n_bloqueios"] > 0:
        # bloqueio rebaixa o estado do banner (exceção é o que importa)
        autonomy["estado_banner"] = "BLOQUEIOS"
    elif autonomy["estado"] == "RODANDO":
        autonomy["estado_banner"] = "NORMAL"
    else:
        autonomy["estado_banner"] = autonomy["estado"]

    return {
        "live": bool(cur.get("live") or (ledger.get("tasks") is not None)),
        "plant": plant,
        "autonomy": autonomy,
        "missions": missions,
        "inbox": inbox,
        "generated_at": now,
    }
