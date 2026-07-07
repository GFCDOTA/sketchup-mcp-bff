# Docker — Interior Studio AI Cockpit

O **bff** roda em container **assim como o `sketchup-mcp`** dockeriza a sua dashboard: um
serviço principal, persistente, que reinicia sozinho. A imagem builda o React e serve tudo
na `:8782` com Python stdlib (sem pip, sem git).

## Subir

```bash
docker compose up -d --build
# abrir http://localhost:8782/
docker compose logs -f bff
docker compose down
```

`up -d --build` builda a imagem e sobe **só o `bff`** (`restart: unless-stopped`,
`init: true` para shutdown limpo no `docker stop`/`down`).

## Topologia

```
browser ──▶ :8782  bff (frontend/dist + /api/* do cockpit)
                 ├── /api/* e /img/*  ──▶ respondidos pelo PRÓPRIO bff lendo /repos/sketchup-mcp (:ro)
                 │                        (studio_mirror — o :8781 NÃO é mais dependência)
                 ├── /api/models /api/models/chat ──▶ host.docker.internal:11434  (Ollama do HOST)
                 └── Live System Map scanner   ──▶ /repos/sketchup-mcp  (motor, mount READ-ONLY)
```

Como o motor (`sketchup-mcp`), o que é externo fica **fora** do container do bff:

- **Ollama** continua no **host** (`:11434`, GPU); o container o alcança por
  `host.docker.internal` (mapeado via `extra_hosts: host-gateway`).
- **O motor (`sketchup-mcp`) não entra na imagem do bff.** É montado **read-only** em
  `/repos/sketchup-mcp` — é de lá que o **studio_mirror** lê `/api/state`, imagens, kgraph
  e consult, e que o **Live System Map** lê a árvore real.
- Com o mount `:ro`, a **única escrita** do cockpit (aprovar/rejeitar proposta em
  `.ai_bridge/proposals/`) degrada com **`503` honesto** — no host ela funciona.

## Modos de rodar

```bash
# 1) Padrão — só o bff; dados ao vivo lidos POR ARQUIVO do mount do motor.
docker compose up -d --build

# 2) Standalone em mock — sem motor montado (snapshot capturado). Builde a imagem antes:
docker build -t interior-studio-bff .
docker run --rm -p 8782:8782 -e BFF_MOCK=1 interior-studio-bff
#    (ou via compose:)  BFF_MOCK=1 docker compose up -d --build
```

> O antigo profile `full` (que containerizava o `studio_dashboard.py` na `:8781`) foi
> **removido**: o cockpit não consome mais o `:8781` — virou letra morta.

## Variáveis (serviço `bff`)

| var | valor no container | papel |
|---|---|---|
| `BFF_HOST` | `0.0.0.0` | bind acessível de fora do container (no host fica em `127.0.0.1`) |
| `BFF_MOCK` | `${BFF_MOCK:-0}` | `1` serve `mocks/state.sample.json` (sem motor montado) |
| `BFF_OLLAMA` | `http://host.docker.internal:11434` | Ollama do host |
| `BFF_ENGINE_ROOT` | `/repos/sketchup-mcp` | motor montado — fonte do studio_mirror + Live System Map |

> O healthcheck bate em `/` (index estático, sem rede) — não em `/api/status` — para não
> reportar `unhealthy` quando o Ollama está lento ou subindo. Honra `BFF_PORT`.

## Troubleshooting

- **`:8782` já em uso** — pare outra dashboard/stack. `docker ps`; no host
  `netstat -ano | findstr 8782`.
- **Cockpit abre mas painéis do Estúdio vazios** — o mount do motor não está lá (ou
  `BFF_ENGINE_ROOT` errado). Confirme `../sketchup-mcp` ao lado do bff, ou rode com
  `-e BFF_MOCK=1`. O bff degrada com elegância — telas mostram estado vazio, sem crash.
- **Modelos/chat dão `503 ollama_unreachable`** — suba `ollama serve` no host. Em **Linux
  puro** (sem Docker Desktop) o `host.docker.internal` pode não resolver. Duas opções
  autocontidas: **(a)** `-e BFF_OLLAMA=http://172.17.0.1:11434`; ou **(b)** `--network host`
  **e** `-e BFF_OLLAMA=http://127.0.0.1:11434` (sob host networking o `host.docker.internal`
  não é mapeado).
- **Live System Map sem o motor (`enginePresent: false`)** — confirme que `../sketchup-mcp`
  existe ao lado do bff (o mount resolve relativo ao `docker-compose.yml`). É honesto: sem
  o mount, o mapa mostra só o repo do bff.
- **Mudou o frontend** — `dist` é buildado **na imagem**; refaça com `--build`. Para iterar
  UI com HMR use `npm run dev` (`:5173`), fora do Docker.
- **Rebuild limpo** — `docker compose build --no-cache bff`.

## O que NÃO é containerizado (de propósito)

- **Ollama** — fica no host (GPU); o bff o alcança via `host.docker.internal`.
- **A geração de `.skp`/render do motor** — segue fora deste container.
- **O dashboard legado do motor (`:8781`)** — não é mais consumido pelo cockpit; se alguém
  o quiser pra outros usos, roda no host, fora desta stack.
