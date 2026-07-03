# SUBIR-DASHBOARD.ps1 — sobe a PÁGINA ÚNICA de monitoramento e abre SÓ ela.
#
# Você abre http://localhost:8782 e vê TUDO num lugar só:
#   • Estúdio (agentes / runs / decisões / kanban)   — LIDO DE ARQUIVO (studio_mirror; o :8781 morreu)
#   • NOC / Sistema (saúde GYR, gate, sessões, git, .skp) — LIDO DE ARQUIVO (o :8765 nunca é tocado)
#   • Ollama (modelos locais)                          — quando estiver no ar
#
# As OUTRAS portas NÃO são telas — são backends headless (você nunca abre):
#   :8765  oráculo /ask /ask-vision — sobe sozinho só quando o pipeline AUTÔNOMO roda
#   :11434 Ollama — sob demanda
#
# Retirados (absorvidos nesta página, não subir mais): dashboard.html do :8765, tools/vitrine,
# a UI do studio_dashboard E o próprio provedor :8781 (o BFF lê os arquivos do motor direto).
$ErrorActionPreference = "Stop"
$SK  = "E:\Claude\apps\sketchup-mcp"
$BFF = "E:\Claude\apps\sketchup-mcp-bff"
$PY  = "$SK\.venv\Scripts\python.exe"

if (-not (Test-Path "$BFF\frontend\dist\index.html")) {
  Write-Host "→ build do frontend (primeira vez)…"
  & npm --prefix "$BFF\frontend" run build
}

Write-Host "→ cockpit ÚNICO (BFF :8782 — serve o app + /api lendo o motor por ARQUIVO)…"
$env:BFF_PORT = "8782"
# Hidden (não Minimized): console clicável entra em modo-seleção (QuickEdit) e congela
# TODO print() do server → :8782 aceita TCP mas nunca responde (aconteceu 2026-07-03).
Start-Process -WindowStyle Hidden -WorkingDirectory $BFF $PY -ArgumentList "server.py"
Start-Sleep -Seconds 3

Start-Process "http://localhost:8782"
Write-Host ""
Write-Host "==================================================================="
Write-Host " PÁGINA ÚNICA:  http://localhost:8782   (abra SÓ isso)"
Write-Host "   dados do estúdio: lidos por ARQUIVO de $SK (sem :8781)"
Write-Host "   :8765  oráculo (sobe sozinho no pipeline autônomo — não é tela)"
Write-Host "   :11434 Ollama (sob demanda)"
Write-Host "==================================================================="
