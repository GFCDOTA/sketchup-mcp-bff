"""server.py — BFF do INTERIOR STUDIO AI Cockpit (:8782).

Serve o frontend React (build em `frontend/dist`) + os endpoints do cockpit (cockpit_api).
NÃO há mais proxy: o :8781 deixou de ser dependência — todo o dado do estúdio (o antigo
/api/state, /api/kgraph, /api/consult/*, /img/* e /inbox-img/*) é respondido pelo PRÓPRIO
BFF lendo os ARQUIVOS do motor (studio_mirror, padrão bridge_mirror). Um app só, uma porta.

    browser → :8782 (este BFF: frontend/dist + /api/* do cockpit)
                 └── motor lido por ARQUIVO (fa.ENGINE_ROOT — studio_mirror/bridge_mirror/noc_mirror)

Uso:
    cd frontend && npm run build           # gera frontend/dist (uma vez)
    python server.py                       # serve :8782 lendo o motor por arquivo
    BFF_PORT=8782 BFF_ENGINE_ROOT=E:\\Claude\\apps\\sketchup-mcp python server.py
    BFF_MOCK=1 python server.py            # /api/state vem de mocks/ (snapshot capturado)

Nota HEAD: do_HEAD roteia pelo dispatch como GET (o _send suprime o body) — HEAD /api/*
responde 200 com headers reais, como no proxy antigo. stdlib only — o BFF não tem
dependências (o build do React é separado, em frontend/).
"""
from __future__ import annotations

import json
import os
import signal
import time
import cockpit_api  # endpoints "AI Cockpit" (status/models/agents/runs/...) montados aqui
import file_activity as fa  # Live System Map — eventos de serve/erro
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
WEB = Path(os.environ.get("BFF_WEB", ROOT / "frontend" / "dist"))  # build do React
PORT = int(os.environ.get("BFF_PORT", "8782"))

# Prefixos de API: rota não tratada pelo dispatch → 404 JSON (JAMAIS o index do SPA —
# /api desconhecido devolvendo HTML seria bug silencioso).
_API_PREFIXES = ("/api/", "/img/", "/inbox-img/")
# Páginas-vitrine do dashboard legado — RETIRADAS (absorvidas na página única :8782).
VITRINE_GONE = {
    "/explica", "/grafo", "/fluxo", "/como-funciona",
    "/single-agent", "/multi-agent", "/vitrine",
}
# "/agents" NÃO entra: é rota VIVA do SPA (App.tsx redireciona pra /operacao?tab=agentes) —
# deep-link/F5 precisa cair no index do React, não em 410.

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon",
    ".woff2": "font/woff2", ".map": "application/json",
}


_emit_at: dict[str, float] = {}


def _gate(key: str, interval: float) -> bool:
    """Throttle de instrumentação (assets/imagens recarregam em rajada)."""
    now = time.time()
    if now - _emit_at.get(key, 0.0) >= interval:
        _emit_at[key] = now
        return True
    return False


class H(BaseHTTPRequestHandler):
    server_version = "InteriorStudioBFF/1.0"

    # ── helpers ──────────────────────────────────────────────────────────────
    def _send(self, code: int, body: bytes, ctype: str, extra: dict | None = None):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _json(self, code: int, obj) -> None:
        self._send(code, json.dumps(obj, ensure_ascii=False).encode("utf-8"),
                   "application/json; charset=utf-8")

    def log_message(self, fmt, *args):  # quieter, single-line
        print(f"[bff] {self.command} {self.path} -> {args[1] if len(args) > 1 else ''}")

    # ── static (frontend) ────────────────────────────────────────────────────
    def _serve_static(self, path: str) -> None:
        rel = "index.html" if path in ("/", "") else path.lstrip("/")
        fp = (WEB / rel).resolve()
        if WEB.resolve() not in fp.parents and fp != WEB.resolve():
            self._send(403, b"forbidden", "text/plain"); return
        if not fp.is_file():
            # SPA usa hash-routing; qualquer rota desconhecida cai no index.
            fp = WEB / "index.html"
            if not fp.is_file():
                fa.emit("sketchup-mcp-bff/frontend/dist/", "error", "bff", status="error",
                        label="frontend/dist não buildado")
                self._send(404, b"web/ not built", "text/plain"); return
        ctype = CONTENT_TYPES.get(fp.suffix.lower(), "application/octet-stream")
        cache = "no-cache" if fp.suffix in (".html",) else "public, max-age=60"
        try:
            served = f"sketchup-mcp-bff/frontend/dist/{fp.relative_to(WEB).as_posix()}"
        except ValueError:
            served = "sketchup-mcp-bff/frontend/dist/index.html"
        if _gate(f"serve:{served}", 8.0):
            fa.emit(served, "serve", "bff", label=f"serve {fp.name} (frontend React)")
        self._send(200, fp.read_bytes(), ctype, {"Cache-Control": cache})

    # ── verbs ────────────────────────────────────────────────────────────────
    def _not_handled(self, path: str) -> bool:
        """Trata os caminhos NÃO-frontend depois do dispatch: vitrine retirada → 410;
        /api|/img desconhecido → 404 JSON. Devolve True se respondeu."""
        if path in VITRINE_GONE:
            self._send(410, "absorvido na pagina unica :8782".encode(), "text/plain; charset=utf-8")
            return True
        if path.startswith(_API_PREFIXES):
            self._json(404, {"error": "unknown_endpoint", "path": path})
            return True
        return False

    def do_GET(self):
        if cockpit_api.dispatch(self):   # rotas nativas do cockpit
            return
        path = urlparse(self.path).path
        if not self._not_handled(path):
            self._serve_static(path)

    def do_HEAD(self):
        # HEAD roteia pelas MESMAS views do GET (dispatch normaliza; _send suprime o body) —
        # paridade com o proxy antigo, onde HEAD /api/* respondia 200 com headers reais.
        if cockpit_api.dispatch(self):
            return
        path = urlparse(self.path).path
        if not self._not_handled(path):
            self._serve_static(path)

    def do_POST(self):
        if cockpit_api.dispatch(self):   # rotas nativas do cockpit
            return
        path = urlparse(self.path).path
        if not self._not_handled(path):
            self._send(404, b"not found", "text/plain")


def main() -> int:
    if not (WEB / "index.html").is_file():
        print(f"[bff] AVISO: {WEB/'index.html'} não existe — rode `npm run build` em frontend/ primeiro.")
    host = os.environ.get("BFF_HOST", "127.0.0.1")   # localhost por padrão (não expõe na LAN)
    srv = ThreadingHTTPServer((host, PORT), H)
    print(f"INTERIOR STUDIO BFF  ->  http://{host}:{PORT}/")
    print(f"  motor lido por ARQUIVO (studio_mirror) -> {fa.ENGINE_ROOT}"
          + ("   [MOCK ON]" if cockpit_api._MOCK else ""))
    print(f"  servindo estatico de    -> {WEB}")

    # `docker stop` / `compose down` enviam SIGTERM. Como PID 1 num container o Python
    # não tem o default terminate-on-SIGTERM, então tratamos: SIGTERM vira o MESMO
    # caminho de shutdown limpo do Ctrl-C (SIGINT) — sem esperar os 10s de grace.
    def _term(*_):
        raise KeyboardInterrupt
    signal.signal(signal.SIGTERM, _term)

    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("[bff] shutdown")
        srv.shutdown()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
