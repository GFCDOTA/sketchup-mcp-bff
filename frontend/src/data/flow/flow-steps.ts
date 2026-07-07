import type { FlowStep } from "./types";

export const flowSteps: FlowStep[] = [
  {
    "id": "entrada",
    "title": "ENTRADA — PDF da planta, consensus, regras/constraints e referências",
    "timelineLabel": "Fatia 1 / 3 · Entrada",
    "status": "mock",
    "objetivo": "Reunir as entradas reais do motor: o PDF da planta (planta_74.pdf), o consensus.json (fonte única de verdade com walls/openings/rooms/soft_barriers em coordenadas de pdf-points), e as regras/constraints (Hard Rules + escala verificada + warnings conhecidos). HONESTO: o consensus já chega PRONTO e pinado nas fixtures — NÃO existe no repo um extrator PDF→consensus rodável (a extração foi feita por um 'vector extractor' externo, registrado só em metadata). Por isso esta etapa é 'mock' do ponto de vista de pipeline executável: o PDF está presente como referência, mas o que o motor consome de fato é o consensus pré-construído.",
    "inputs": [
      "D:/Claude/sketchup-mcp/planta_74.pdf (175850 bytes — PDF da planta, presente como referência/origem)",
      "D:/Claude/sketchup-mcp/fixtures/planta_74/consensus_with_human_walls_and_soft_barriers.json (consensus PINADO: 20 walls, 12 openings, 8 rooms, 9 soft_barriers; wall_thickness_pts=5.399517; page_size_pts=[595,842]; coordinate_system=pdf_points)",
      "D:/Claude/sketchup-mcp/fixtures/quadrado/consensus_with_window.json (micro-fixture: 4 walls + 1 window em w_bottom; usada como smoke/POC)",
      "D:/Claude/sketchup-mcp/fixtures/planta_74/known_warnings.json (WARNs arquiteturais baseline que DEVEM persistir no veredito: room_fidelity_open_plan, sb007_ambiguous, sb_sliver_group_1)",
      "Anotações humanas (referências visuais): fixtures/planta_74/human_walls_annotation.png, human_openings_annotation.png, human_soft_barriers_annotation.png",
      "Regras/constraints: D:/Claude/sketchup-mcp/.claude/CLAUDE.md (Hard Rules: nunca inventar walls/rooms/openings; nunca carvar janela full-height; nunca mutar fixtures sem aprovação)"
    ],
    "outputs": [
      "consensus.json validado e legível (dict com chaves: schema_version, source, coordinate_system, page_size_pts, planta_region, wall_thickness_pts, walls[], openings[], rooms[], soft_barriers[], metadata)",
      "Escala real por planta resolvida: PLANT_PT_TO_M['planta_74']=0.0259 (cota-anchored), default 0.19/5.4≈0.0352",
      "Provenance da extração lida de metadata (extractor='vector', openings_extractor='vector_arc_window_v1', rooms via method='polygonize')"
    ],
    "scripts": [
      "D:/Claude/sketchup-mcp/core/scale.py — FONTE ÚNICA de escala (PT_TO_M/PT_TO_IN); resolve_plant_pt_to_m() injeta 0.0259 p/ planta_74 via env",
      "D:/Claude/sketchup-mcp/tools/pdf_knowledge/ingest_pdfs.py — ingestão/indexação de PDFs de conhecimento (NÃO é o extrator de planta→consensus)",
      "(NÃO existe no repo) um tools/plan_extract*.py ou build_consensus*.py rodável que converta planta_74.pdf → consensus.json — o consensus chega pré-feito"
    ],
    "apis": [],
    "artifacts": [
      "D:/Claude/sketchup-mcp/planta_74.pdf",
      "D:/Claude/sketchup-mcp/fixtures/planta_74/consensus_with_human_walls_and_soft_barriers.json",
      "D:/Claude/sketchup-mcp/fixtures/quadrado/consensus_with_window.json",
      "D:/Claude/sketchup-mcp/fixtures/planta_74/known_warnings.json"
    ],
    "gates": [
      "Hard Rule #1 (CLAUDE.md): se não está no consensus.json, NÃO entra no .skp — consensus é a fonte de verdade",
      "Hard Rule #3: nunca mutar fixtures/quadrado/ ou fixtures/planta_74/ sem aprovação humana explícita (a smoke suite pina contra elas)"
    ],
    "errosComuns": [
      "Tratar o PDF como entrada executável do pipeline: NÃO há extrator rodável; o motor consome o consensus, não o PDF",
      "Editar a fixture pinada (mutação proibida) — quebra a suite que pina contra ela",
      "Esquecer de setar PT_TO_M antes do import de core.scale → build sai na escala default (0.0352) inflando a planta ~1.36x (bbox 186 m² p/ um apê de 74 m²)"
    ],
    "debug": [
      "python -c \"import json;d=json.load(open('fixtures/planta_74/consensus_with_human_walls_and_soft_barriers.json'));print({k:(len(v) if isinstance(v,list) else v) for k,v in d.items()})\" — confere contagens (20/12/8/9)",
      "Ler metadata.extractor e metadata.openings_extractor p/ saber a proveniência (vector / vector_arc_window_v1)",
      "Conferir core/scale.py PLANT_PT_TO_M p/ a escala verificada da planta"
    ]
  },
  {
    "id": "interpretacao",
    "title": "INTERPRETAÇÃO — normalização do consensus, rooms/walls/openings, escala e validações iniciais",
    "timelineLabel": "Fatia 2 / 3 · Interpretação",
    "status": "implemented",
    "objetivo": "Interpretar o consensus já em pdf-points: normalizar kind dos openings (kind_v5), classificar janela vs porta/passagem (peitoril/verga preservados p/ janela), classificar endpoints de parede como junção-vs-livre (trim de stub LL-017), resolver a escala real por planta, e rodar as VALIDAÇÕES determinísticas (opening↔host-wall, sobreposição de paredes). HONESTO: tudo aqui roda no código sobre o consensus; NÃO há leitura/segmentação do PDF em runtime — o 'coordinate system' e a 'escala' já vêm em pdf-points no consensus, e a interpretação é geométrica/semântica sobre esses dados.",
    "inputs": [
      "consensus.json (walls[] com start/end/orientation('h'|'v')/thickness; openings[] com wall_id/center/opening_width_pts/kind|kind_v5/geometry_origin; rooms[] com polygon_pts/id/name; soft_barriers[] com polyline_pts/barrier_type)",
      "PT_TO_M resolvido (env / core.scale.resolve_plant_pt_to_m)",
      "metadata (extractor/provenance) e known_warnings.json (WARNs baseline)"
    ],
    "outputs": [
      "Classificação de openings: opening_kind_v5_normalised() → interior_door | interior_passage | window | glazed_balcony; is_window_aperture() separa janelas (carve 3D) de portas/passagens (carve 2D full-height)",
      "Roteamento por geometry_origin: CARVING_ORIGINS={svg_arc, svg_segments, human_annotation} carvam; 'wall_gap' já tem o vão nos dados da parede (não carva — vira passage marker)",
      "Classificação de endpoints de parede (_classify_endpoint_junctions): {wall_id:(start_is_junction,end_is_junction)} p/ trim de stub LL-017 (extende meia-espessura só em junção perpendicular)",
      "Veredito determinístico combinado (PASS/FAIL/INCOMPLETE) das validações de consistência",
      "(opcional) consensus CANDIDATO regenerado: paredes colineares fundidas + openings re-hospedados (tools/regenerate_consensus.py — escreve em runs/, NUNCA sobrescreve a fixture)"
    ],
    "scripts": [
      "D:/Claude/sketchup-mcp/tools/build_plan_shell_skp.py — funções de interpretação: opening_kind_v5_normalised(), is_window_aperture(), _classify_endpoint_junctions(), opening_carve_rect()",
      "D:/Claude/sketchup-mcp/tools/run_deterministic_gates.py — run_all(): roda os detectores consensus-only e emite UM veredito + exit code (PASS=0/FAIL=1/INCOMPLETE=3)",
      "D:/Claude/sketchup-mcp/tools/opening_host_audit.py — audit_opening_hosts(): host_mismatch / off_host_segment / width_exceeds_host (opening cujo wall_id não o hospeda geometricamente)",
      "D:/Claude/sketchup-mcp/tools/wall_overlap_audit.py — audit_wall_overlaps(): paredes duplicadas/sobrepostas",
      "D:/Claude/sketchup-mcp/tools/regenerate_consensus.py — regenerate(): merge de paredes colineares (fixed_tol, bridge_gap) + re-host de openings ao wall mais próximo",
      "D:/Claude/sketchup-mcp/core/scale.py — resolução de escala pt→m→in (única fonte)"
    ],
    "apis": [
      "Decisão real roteada por HTTP ao GPT Auto-Consult Gate em localhost:8765 (tools/ask_gpt_gate.py); degrada p/ SKIPPED_OFFLINE se cair (não fabrica resposta)"
    ],
    "artifacts": [
      "runs/<plant>/consensus_regenerated.json (candidato do regenerate_consensus — scratch, gitignored)",
      "report do run_deterministic_gates (verdict por gate: opening_host, wall_overlap, [render_bbox/wall_presence quando há render])"
    ],
    "gates": [
      "opening_host (audit_opening_hosts) — opening↔host-wall: era 9/12 FAIL na planta_74 antes do merge/re-host",
      "wall_overlap (audit_wall_overlaps) — duplicata humana×extrator (1 flag na planta_74)",
      "Hard Rule #2: janela NUNCA carva full-height — preserva massa abaixo do peitoril e acima da verga (WINDOW_APERTURE_KINDS={window})",
      "Veredito determinístico self-PASSa em julgamento visual/fixture (esse fica NEEDS-HUMAN)"
    ],
    "errosComuns": [
      "Confundir geometry_origin='wall_gap' com algo a carvar — carvar duas vezes encolhe a parede (double-shrink); wall_gap só ganha passage marker",
      "Extender meia-espessura em endpoint LIVRE (não-junção) → stub LL-017 (toquinho saindo p/ o espaço)",
      "Re-hospedar opening num stub que não o hospeda → janela renderiza na parede errada (FP-031)",
      "Achar que a interpretação lê o PDF: ela lê o consensus; o sistema de coordenadas/escala já vem resolvido em pdf-points"
    ],
    "debug": [
      "python -m tools.run_deterministic_gates --fixture planta_74 — roda opening_host + wall_overlap e dá veredito + exit code",
      "python -m tools.opening_host_audit / wall_overlap_audit sobre o consensus p/ ver os flags por opening/parede",
      "python -m tools.regenerate_consensus --fixture planta_74 --out runs/planta_74/consensus_regenerated.json — gera candidato merge+rehost (não muta a fixture)",
      "Inspecionar stats['endpoints_free']/['endpoints_junction'] no _shell_polygon.json p/ ver a classificação de junções"
    ]
  },
  {
    "id": "geracao",
    "title": "GERAÇÃO do modelo — consensus → .skp (2D Python via shapely + 3D Ruby via SketchUp)",
    "timelineLabel": "Fatia 3 / 3 · Geração",
    "status": "implemented",
    "objetivo": "Gerar o .skp fiel: fase Python computa a casca 2D (footprints de parede → unary_union → buffer-close-gap mitre → subtração de openings full-height → filtro de slivers → canonicalização de cantos → pisos que encostam nas faces internas) e serializa _shell_polygon.json; fase Ruby (SketchUp 2026, via autorun) extruda a casca à altura do teto, carva janelas em 3D preservando peitoril/verga, monta pisos + esquadrias + portas + guarda-corpos, e salva o .skp + renders + geometry_report.json. O .skp é o artefato humano mais importante.",
    "inputs": [
      "consensus.json (path passado ao build_plan_shell_skp.py)",
      "_shell_polygon.json (produzido pela fase Python; lido pela fase Ruby via ENV['SHELL_JSON_IN'])",
      "ENV: PT_TO_M (escala), PNG_ISO_OUT, PNG_TOP_OUT, REPORT_OUT, SHELL_JSON_IN, SOFT_BARRIERS_MODE, CONSENSUS_JSON, SKP_OUT",
      "autorun_control.txt em %APPDATA%/SketchUp/.../Plugins (3 linhas: consensus, out_skp, ruby_template) escrito por write_control()"
    ],
    "outputs": [
      "model.skp (deliverable) — em runs/<plant>/ (scratch); promovido p/ artifacts/<plant>/<plant>.skp via --promote (só com gates self-check + determinísticos verdes)",
      "_shell_polygon.json (polygons[] outer/holes em pdf-points + rooms + room_floors + soft_barriers + window_apertures + stats)",
      "model_iso.png, model_top.png (+ model_top.png.proj.json projeção exata p/ wall-presence), model_floors_top.png (piso isolado, paredes ocultas)",
      "geometry_report.json (plan_shell faces/edges, floor_groups, soft_barrier_groups, gates_self_check, groups_diagnostic, shell_stats_from_python)",
      "<out_skp>.metadata.json (sidecar com consensus_sha256 p/ cache content-hash)"
    ],
    "scripts": [
      "D:/Claude/sketchup-mcp/tools/build_plan_shell_skp.py — fase Python: build_shell_polygon() (footprints→union→buffer mitre join_style=2→difference openings→sliver filter→canonicalise_axis_aligned_polygon/_remove_small_teeth), compute_room_floors() (piso na célula até as faces internas, tuck FLOOR_UNDER_FRAC=0.4), serialize_polygons(), run() (lança SU, escreve control, espera o .skp, cache+promote)",
      "D:/Claude/sketchup-mcp/tools/build_plan_shell_skp.rb — fase Ruby/SU: build_plan_shell() (add_face+pushpull WALL_HEIGHT_IN=2.70m), build_floor(), build_window_aperture_3d() (carve 3D peitoril/verga; basculante p/ janela estreita ≤1.20m), build_window_frame_h() (esquadria perfil-fixo), build_door_leaf(), build_glazed_balcony(), build_passage_marker(), build_soft_barrier() (mureta+vidro+montantes; SOURCE GATE: só com barrier_type+human_annotation), write_geometry_report(), cameras+write_png()",
      "D:/Claude/sketchup-mcp/tools/disarm_sketchup_autoruns.py — disarm de autoruns órfãos antes/depois do launch",
      "D:/Claude/sketchup-mcp/tools/su_runner_safety.py — parse_mode/should_terminate (modo headless só em CI; interactive default em dev)",
      "D:/Claude/sketchup-mcp/tools/promote_canonical.py — promote runs/ → artifacts/<plant>/ (chamado por _auto_promote com --promote)"
    ],
    "apis": [
      "SketchUp 2026 (C:/Program Files/SketchUp/SketchUp 2026/SketchUp/SketchUp.exe) lançado via subprocess.Popen (DETACHED_PROCESS); comunicação por autorun_control.txt + ENV; sinal de saída = aparecimento do .skp",
      "BFF cockpit_api.py (:8782) — runner é STUB: _start_run()/_runner() (cockpit_api.py:275-299) SIMULAM steps+logs ao vivo, NÃO chamam build_plan_shell_skp de verdade (ponto de plugue p/ runner real)"
    ],
    "artifacts": [
      "runs/<plant>/model.skp + _shell_polygon.json + model_iso.png + model_top.png(+.proj.json) + model_floors_top.png + geometry_report.json (scratch, gitignored)",
      "artifacts/<plant>/<plant>.skp (deliverable canônico promovido)",
      "D:/Claude/sketchup-mcp-bff/mocks/state.sample.json (estado mock do cockpit, 40KB)"
    ],
    "gates": [
      "gates_self_check no geometry_report (Ruby): plan_shell_group_exists, wall_shell_is_single_group, floors_separated_from_walls, default_material_faces_zero",
      "_auto_promote: só promove se result.ok, NÃO cached, gates_self_check todos verdes E run_deterministic_gates overall==PASS (senão PROMOTE_SKIPPED)",
      "Hard Rule #2 reforçada na fase 3D: build_window_aperture_3d carva só [sill..head], parede acima/abaixo preservada (verga/peitoril)",
      "FP-031: find_wall_face_for_aperture exige face da parede HOST (senão fallback p/ build_window_panel, não carva facade errada)",
      "VISUAL_REVIEW (único gate humano): mudança de APARÊNCIA exige olho do Felipe vs PDF; veredito IMPROVED/SAME/WORSE nunca é auto"
    ],
    "errosComuns": [
      "buffer com join_style padrão (round) troca cada canto reto por leque de 16 segmentos — usar join_style=2 (mitre) p/ planta axis-aligned",
      "Pontos duplicados no add_face do SU ('Duplicate points in array') — _drop_coincident/dedupe_consecutive_pts removem ruído de união <1e-3 pdf-pt",
      "pushpull(-global_thickness) numa parede MERGED mais grossa (mean) não atravessa → bolso cego (janela sem vidro); usar host_wall['thickness']",
      "Janela carvada full-height vira shaft+infill (3 volumes soltos) em vez de parede-com-vão — proibido (ADR-007/FP-024)",
      "--mode headless em dev local é PROIBIDO (só CI); default interactive deixa SU aberto p/ inspeção",
      "Achar que o cockpit (:8782) gera o .skp — o runner é STUB; o build real é o build_plan_shell_skp via CLI"
    ],
    "debug": [
      "python -m tools.build_plan_shell_skp fixtures/planta_74/consensus_with_human_walls_and_soft_barriers.json --out runs/planta_74/model.skp — build real (precisa SketchUp 2026)",
      "Inspecionar _shell_polygon.json stats (input_walls, openings_carved, window_apertures_3d, redundant_vertices_dropped, total_shell_area_pts2)",
      "Ler geometry_report.json gates_self_check + groups_diagnostic (bbox_m, height_m, footprint_top_face_m2) p/ achar pisos faltando / faces sem material",
      "Em falha/timeout: ver %APPDATA%/SketchUp/.../Plugins/autorun_error.txt (erro Ruby impresso pelo run() quando SU sai cedo)",
      "Conferir model_floors_top.png p/ vazamento/overlap de piso sem a parede tapando",
      "--force-skp p/ furar o cache content-hash (sidecar .metadata.json); --promote p/ promover só com gates verdes"
    ]
  },
  {
    "id": "04",
    "title": "Gates determinísticos de fidelidade",
    "timelineLabel": "4 · GATES",
    "status": "implemented",
    "objetivo": "Validar o .skp/consensus contra regras objetivas, machine-readable, ANTES de qualquer julgamento humano. Pega a classe de erro que mais quebrou a planta_74 (janela em host errado, parede duplicada, parede sumida no render, abertura mal posicionada) com detectores puros — sem SketchUp, sem PDF, sem rede. Veredito único + exit code que bloqueia o avanço.",
    "inputs": [
      "fixtures/planta_74/consensus_with_human_walls_and_soft_barriers.json (fonte de verdade — walls/openings/soft_barriers; Hard Rule #1: nada fora dela entra)",
      "runs/<plant>/geometry_report.json (schema 1.0.0; bloco gates_self_check + groups_diagnostic + shell_stats_from_python, escrito por build_plan_shell_skp.rb:write_geometry_report L1382)",
      "render top model_top.png + sidecar model_top.png.proj.json (projeção exata pdf-pts→pixel, escrita por write_top_projection_sidecar enquanto a câmera top está ativa, build_plan_shell_skp.rb L1691)"
    ],
    "outputs": [
      "dict {overall: PASS|FAIL|INCOMPLETE, gates:{...}} de tools/run_deterministic_gates.py:run_all (L42)",
      "exit code: PASS=0, FAIL=1, INCOMPLETE=3 (3 distinto de FAIL: 'não rodou' != 'rodou e divergiu')",
      "gates_self_check (4 booleanos) embutido no geometry_report.json: plan_shell_group_exists, wall_shell_is_single_group, floors_separated_from_walls, default_material_faces_zero"
    ],
    "scripts": [
      "tools/run_deterministic_gates.py (orquestrador FP-031 — agrega todos os detectores e emite 1 veredito + exit)",
      "tools/opening_host_audit.py:audit_opening_hosts (host_mismatch / off_host_segment / width_exceeds_host, em pdf-points)",
      "tools/wall_overlap_audit.py:audit_wall_overlaps (paredes colineares e sobrepostas = geometria duplicada; ex. h_w001 dup w020)",
      "tools/render_bbox_audit.py:audit_render_bbox (framing: planta cortada na borda invalida review; pixel-only)",
      "tools/overlay_diff.py:run_gate (wall_presence: projeta cada parede do consensus no render top e exige cobertura mínima de pixel escuro)",
      "tools/railing_exact_match_gate.py + tools/parapet_not_railing_fallback_gate.py (grade/parapeito = match exato vs consensus)",
      "tools/position_fidelity_gate.py:compare (centro/largura/host de portas+janelas + alinhamento/fechamento da grade vs geometry_report; TOL center 0.10m / host_wall 0.15m)"
    ],
    "apis": [
      "CLI: python -m tools.run_deterministic_gates --fixture planta_74 [--render <top.png>] [--report geometry_report.json]",
      "CLI individual: python -m tools.opening_host_audit --fixture planta_74 (exit 0 PASS / 1 FAIL)"
    ],
    "artifacts": [
      "runs/<plant>/geometry_report.json",
      "artifacts/planta_74/geometry_report.json (canônico)",
      "artifacts/planta_74/planta_74_top.png.proj.json (sidecar de projeção promovido por promote_canonical.py)"
    ],
    "gates": [
      "PASS: nenhum detector FAIL e há sidecar para o wall_presence",
      "FAIL: qualquer detector retorna overall/verdict=FAIL (exit 1) → BLOQUEIA promoção",
      "INCOMPLETE: --render dado mas sidecar .proj.json ausente → wall_presence=SKIPPED_NO_SIDECAR, overall=INCOMPLETE (exit 3) — nunca verde silencioso",
      "gates_self_check: qualquer um dos 4 false = FAIL canônico, build não promove pra artifacts/ (fidelity_gate.md Eixo 1)",
      "Visual/qualitativo NÃO é decidido aqui (auto-PASSa); fica como NEEDS-HUMAN para a etapa 5/6"
    ],
    "errosComuns": [
      "render dado sem o sidecar .proj.json → INCOMPLETE em vez de PASS (LL-035; um print-only ficaria exit 0 e o canônico sem sidecar passaria batido)",
      "confiar no gate verde como 'modelo fiel' — é só 'checks codificados passaram', não fidelidade arquitetônica (Eixo 2 é prose humana no README)",
      "exit 3 colide com argparse se reutilizado (por isso INCOMPLETE=3, não 2)",
      "alterar fixture pra 'passar' o wall_overlap viola Hard Rule #3 (fixture só muta com aprovação humana)"
    ],
    "debug": [
      "rodar tools/opening_host_audit/wall_overlap_audit isolados imprime cada finding FAIL com host/nearest/distância em pt",
      "tests/test_run_deterministic_gates.py pina PASS no consensus limpo e na planta_74 regenerada; tests/test_opening_host_audit.py cobre o detector",
      "inspecionar groups_diagnostic[].bbox_m no geometry_report.json pra checar z_min de portas (floating) e altura de janela",
      "_summary_line() imprime por gate: opening_host (n_fail/n_openings), wall_presence (calibração), position_fid (n FAIL de n_total)"
    ]
  },
  {
    "id": "05",
    "title": "Render V-Ray + Visual Review (antes/depois vs PDF)",
    "timelineLabel": "5 · RENDER + VISUAL",
    "status": "implemented",
    "objetivo": "Materializar o .skp em imagens (top/iso ortho + render V-Ray premium para cena mobiliada) e montar o side-by-side PDF×SKP que só o olho humano valida. Rodar heurísticas determinísticas sobre o geometry_report (contagem/posição de portas, janelas, grades, leak de piso) e, opcionalmente, um Visual Oracle. O veredito visual IMPROVED/SAME/WORSE NUNCA é auto — é a chamada do Felipe (modo B).",
    "inputs": [
      "runs/<plant>/<plant>.skp recém-buildado (ou artifacts/<plant>/*.png canônicos via --image-source canonical)",
      "model_top.png + model_iso.png (build_plan_shell_skp.rb: setup_iso_camera/setup_top_camera + write_png, L1683-1689)",
      "<plant>.pdf (ground truth para o side-by-side)",
      "runs/scenes/<id>/scene.json + scene_parts.json (cena composta mobiliada, para o caminho V-Ray)",
      "fixtures/<plant>/known_warnings.json (WARNs arquiteturais carregados, ex. room open-plan)"
    ],
    "outputs": [
      "artifacts/review/<plant>/<run>/final/: model.skp, model_top.png, model_iso.png, side_by_side_pdf_vs_skp.png, geometry_report.json",
      "visual_findings.json (schema visual_findings.v1; top_level_verdict + axes wall/door/window/room/scale_rotation/global_visual + findings com severity/location/evidence/proposed_fix)",
      "regression_summary.md (tabela de attempts, axes, findings determinísticos, maturidade estimada %, bloco Constitution #8)",
      "PNG V-Ray premium: runs/scenes/<id>/vray_three_quarter.png (render_scene_vray, status success/fail/skipped — sem sucesso fabricado)"
    ],
    "scripts": [
      "tools/run_skp_visual_review.py (FP-030 Visual Oracle Gate runner: build → inspect_report (10 checks) → side-by-side → oracle opcional → promove final/ → regression_summary)",
      "tools/compose_side_by_side.py:compose_to_file (monta o comparativo PDF×top×iso)",
      "tools/render_scene_vray.py:render_scene_vray (SU headless → vray_export.rb → .vrscene → tweak_vrscene exposição interior iso100/f7/sh160/sky0.3 → vray.exe → PNG; no-disrupt: pula se SU aberto)",
      "tools/run_skp_visual_review.py:inspect_report (window/door/glazed_balcony count, floating_door z>0.05, orphan_glass, soft_barrier_routed_as_window, duplicate window, bad_window_aperture, full_height_void, floor_leak)"
    ],
    "apis": [
      "CLI: python -m tools.run_skp_visual_review --fixture planta_74 --out artifacts/review/planta_74/<run> --max-attempts 3 --oracle none",
      "CLI: ... --oracle chatgpt_bridge [--require-oracle] (Visual Oracle; --require-oracle BLOCKED se backend não entrega)",
      "CLI: python -m tools.render_scene_vray runs/scenes/<id> --out nome.png",
      "Visual Oracle bridge: GET/POST http://localhost:8765 (check_oracle_bridge_available + call_oracle_bridge com imagens b64)"
    ],
    "artifacts": [
      "artifacts/review/<plant>/<run>/final/* (evidência do ciclo)",
      "artifacts/<plant>/side_by_side_pdf_vs_skp.png + *_top.png + *_iso.png (canônico, exigidos pelo fidelity_gate §Evidências 1-5)",
      "runs/scenes/<id>/vray_three_quarter.png + scene_closed.skp"
    ],
    "gates": [
      "Side-by-side OBRIGATÓRIO para PASS — BLOCKED se o composer não produz output (Constitution #8: no visual proof, no progress)",
      "Eixos global_visual e scale_rotation NÃO se decidem por número → default WARN, exigem revisão humana/oracle das imagens",
      "top_level_verdict = FAIL se qualquer finding FAIL; WARN se algum axis WARN; senão PASS",
      "HUMANO vs IA: as 10 heurísticas + contagens são determinísticas (IA-free); o veredito de aparência IMPROVED/SAME/WORSE é exclusivamente humano (modo B / negative_dogfood provou auto-julgamento não-confiável)",
      "Maturidade capada honestamente: sem oracle funcional max ~70%, com oracle ~85%; 100% não é prometido",
      "render V-Ray pula (status=skipped) se SketchUp já está aberto (no-disrupt) — não é falha"
    ],
    "errosComuns": [
      "declarar progresso sem side-by-side/visual_findings → viola Constitution #8 (regression_summary marca MISSING)",
      "tratar PASS do oracle como decisão final ignorando known_warnings carregados (a etapa 6 reconcilia: oracle PASS não sobrepõe WARN arquitetural)",
      "janela carvada full-height (z_min≈0) por peitoril/verga faltando → full_height_window_void FAIL (Hard Rule #2)",
      "V-Ray: background do céu sai com alpha=0 e parece 'buraco/janela estourada' — _flatten_alpha achata pra RGB",
      "SU resolve save/write contra o CWD dele → path do run dir sempre resolvido absoluto (lição cycle 002)"
    ],
    "debug": [
      "abrir artifacts/review/<plant>/<run>/final/side_by_side_pdf_vs_skp.png + model_top.png + model_iso.png e comparar com o PDF",
      "ler regression_summary.md: tabela de attempts, axes (verdict+evidence), maturidade %, compliance Constitution #8",
      "visual_findings.json lista cada finding com location (ex. groups_diagnostic[name=...].bbox_m.min[2]) + proposed_fix + suspected_owner",
      "render_scene_vray devolve dict com timing_s, base_intact (sha do .skp antes/depois), vray_tail no fail"
    ]
  },
  {
    "id": "06",
    "title": "Bridge / Oracle de decisão + GPT Auto-Consult Gate",
    "timelineLabel": "6 · ORACLE",
    "status": "implemented",
    "objetivo": "Rotear as decisões reais (arquitetura, merge, A/B/C, carregar WARN, abrir ciclo) para um oráculo via HTTP em :8765 — atendido pelo CLAUDE headless em modo B (autonomia delegada). O oráculo DECIDE sozinho o técnico com base em evidência determinística e só escala VISUAL_REVIEW pro humano. Tudo é rastreável: pergunta→GPT/Claude→resposta→veredito→arquivo vinculado ao ciclo/agente/artifact.",
    "inputs": [
      "estado do pipeline (oracle_verdict, final_verdict, carried_known_warnings_verdict, oracle_status) montado por run_skp_visual_review:_build_consult_state",
      "trigger canônico detectado (detect_gpt_consult_trigger ou um dos 9 de ask_gpt_gate.CANONICAL_TRIGGERS)",
      "context JSON + repo_state (branch, develop_sha, fixture, paths dos artifacts) para o prompt",
      "tier da consulta (fast=Sonnet+low rotina / deep=Opus xhigh o JUIZ — choose_gate_tier; veredito visual final PINADO em deep)"
    ],
    "outputs": [
      "resposta estruturada do oráculo: Verdict (GO/NO-GO/MORE-INFO/VISUAL_REVIEW) + Confidence + Reasoning + Assumptions + Risks + Next action",
      "arquivos .ai_bridge/questions/<UTC>_<trigger>.md e .ai_bridge/responses/<UTC>_<trigger>.md (pergunta + raw + parsed §6.4 + 'Decision taken')",
      "GateResult{status: ok|SKIPPED_OFFLINE|BLOCKED_BRIDGE_OFFLINE|invalid, verdict, confidence, ...}",
      "evento de audit em .ai_bridge/audit/audit.jsonl (kind=consult: tier, model, effort, q_chars, a_chars, dur_sec)",
      "bloco 'GPT Auto-Consult Gate (LL-024)' no regression_summary.md (mode/trigger/status/question_file/response_file/decision)"
    ],
    "scripts": [
      "tools/claude_bridge/server.py (HTTP :8765; /health + POST /ask; ask_claude roda `claude -p` headless Opus 4.8 effort xhigh; SYSTEM modo B; cwd neutro pra não recursar o SessionStart hook)",
      "tools/ask_gpt_gate.py (LL-024 gate: valida 1 dos 9 triggers, build_prompt, probe_bridge, write_question_file, call_bridge, parse_verdict, write_response_file)",
      "tools/run_skp_visual_review.py:detect_gpt_consult_trigger + _maybe_run_gpt_consult (liga a etapa 5 na 6: dispara consult quando final=FAIL/BLOCKED, oracle!=final, ou oracle PASS+known warnings)",
      "tools/consult_tier.py:choose_gate_tier (roteia fast/deep por purpose; final_visual_verdict é deep pinado)",
      "tools/gate_verdict.py:parse_verdict (extrai Verdict/Confidence/Assumptions/Risks do texto)"
    ],
    "apis": [
      "GET http://localhost:8765/health (self-doc: ask_field, verdict_enum, modes [default,redteam], tiers, endpoints)",
      "POST http://localhost:8765/ask {prompt|question[, mode=redteam][, tier=fast|deep]} → {response}",
      "POST /heartbeat {session_id, cycle, last_action} (orquestrador de liveness: STALLED/PARALYZED)",
      "GET /api/gate-ledger, /api/activity, /api/status (GREEN/YELLOW/RED), /api/memory/search?q= (RAG #2 read-only)"
    ],
    "artifacts": [
      ".ai_bridge/questions/*.md + .ai_bridge/responses/*.md (Q&A rastreável por timestamp+trigger)",
      ".ai_bridge/audit/audit.jsonl (ledger de consults + heartbeats)",
      "regression_summary.md (vincula o consult ao run/fixture/artifacts)"
    ],
    "gates": [
      "ÚNICO gate humano = Verdict VISUAL_REVIEW (aparência da planta mudou e só o olho do Felipe valida vs PDF); todo o resto o oráculo decide sozinho (modo B)",
      "REDTEAM automático nos triggers de alto risco (a_b_c_decision, risk_of_inventing_geometry, big_pr_changes) — o oráculo steelmana a oposição antes do veredito (anti-agreement-bias)",
      "FILE-FETCH §6.3: se a decisão depende de um arquivo não dado → Verdict MORE-INFO + linha Need-files (não chuta conteúdo)",
      "--require-consult / --gpt-consult required: bridge offline → BLOCKED_BRIDGE_OFFLINE (exit 3), pergunta ainda gravada",
      "bridge offline sem require → SKIPPED_OFFLINE (degrada honesto, NÃO fabrica resposta)",
      "NÃO consultar em: typo/doc-only, teste pequeno, merge de PR verde pequeno, cleanup local, decisão já coberta por regra"
    ],
    "errosComuns": [
      "pedir ao humano no chat em vez de rotear pelo gate — no chat trava até alguém ver; pelo gate é respondido automático",
      "oráculo dar IMPROVED/SAME/WORSE sozinho — proibido (negative_dogfood); veredito visual é do humano",
      "timeout: Opus+xhigh é lento; BRIDGE_CALL_TIMEOUT 260s > CLAUDE_TIMEOUT 240s do server",
      "claude headless não autenticado → erro explícito (rodar `claude setup-token`, exportar CLAUDE_CODE_OAUTH_TOKEN via .oauth_token gitignorado)",
      "2 servers no mesmo :8765 (allow_reuse_address=False faz o 2º falhar alto em vez de empilhar SYSTEM velho)",
      "'oracle PASS mas known_warnings' avaliado ANTES do 'oracle != final' genérico, senão a planta_74 dispara a pergunta errada"
    ],
    "debug": [
      "GET :8765/health confirma oráculo no ar + contrato; dashboard inline em / mostra timeline UP/DOWN (refresh 5s)",
      "ler .ai_bridge/responses/<ts>_<trigger>.md: bloco 'Parsed verdict (§6.4)' + raw + 'Decision taken'",
      "python tools/claude_bridge/server.py --selftest testa ask_claude sem subir o servidor",
      "/api/gate-ledger mostra latência por consult, pendentes (esperando o gate) e veredito — 'o gate ajudou ou virou teatro?'",
      "audit.jsonl: kind=consult com dur_sec/q_chars/a_chars por chamada; _classify_gate_state distingue ONLINE_ACTIVE/IDLE/BLOCKED/DOWN"
    ]
  },
  {
    "id": "07",
    "title": "Approved Artifact (entrega canônica)",
    "timelineLabel": "7 · APPROVED",
    "status": "implemented",
    "objetivo": "Promover o run aprovado (gates determinísticos PASS + visual review + veredito do oráculo, com VISUAL_REVIEW do humano quando a aparência mudou) para o artefato canônico humano-facing em artifacts/<plant>/, com renders, report, side-by-side, sidecar de proveniência e o sidecar de projeção que re-habilita o wall_presence gate.",
    "inputs": [
      "artifacts/review/<plant>/<run>/final/ aprovado (model.skp, model_top.png, model_iso.png, geometry_report.json, side_by_side_pdf_vs_skp.png, visual_findings.json, regression_summary.md)",
      "veredito final: gates PASS + final_verdict do visual review + GO/VISUAL_REVIEW do oráculo (modo B)",
      "model.skp.metadata.json do run (consensus_sha256 = cache key + build stats)"
    ],
    "outputs": [
      "artifacts/<plant>/<plant>.skp (o artefato humano #1 — Constitution #1)",
      "artifacts/<plant>/<plant>_top.png, _iso.png, _floors_top.png, side_by_side_pdf_vs_skp.png",
      "artifacts/<plant>/geometry_report.json (gates_self_check 4×true) + regression_summary.md",
      "artifacts/<plant>/<plant>.skp.metadata.json (proveniência: sha + build stats, apontando pra artifacts/ não runs/)",
      "artifacts/<plant>/<plant>_top.png.proj.json (sidecar de projeção carregado — sem ele o wall_presence gate vira INCOMPLETE)",
      "artifacts/<plant>/README.md (provenance prose: Eixo 2 wall/room/opening fidelity + justificativa de cada WARN)"
    ],
    "scripts": [
      "tools/promote_canonical.py (copia final/ → artifacts/<plant>/ com nomes estáveis; carrega .proj.json e .skp.metadata.json; reaponta sidecar pra artifacts/)",
      "tools/promote_artifact.py (promoção runs/ → artifacts/ geral)"
    ],
    "apis": [
      "CLI: python -m tools.promote_canonical (mapping model.skp→{plant}.skp, model_top.png.proj.json→{plant}_top.png.proj.json, etc.)"
    ],
    "artifacts": [
      "artifacts/planta_74/ (estado canônico atual: planta_74.skp + 4 renders + geometry_report + side_by_side + README + 2 sidecars — verificado no disco)"
    ],
    "gates": [
      "Constitution #1: o .skp é o artefato mais importante; #8: no SKP + no visual proof, no progress",
      "fidelity_gate §Evidências obrigatórias (7 itens): .skp + top + iso + side_by_side + report(4 gates true) + pytest verde + README com Eixo 2 — falta 1 = status INCOMPLETO, não declarar sucesso",
      "/runs/ é scratch (não commitar); só o promovido vira evidência canônica em artifacts/<plant>/ (artifact_policy)",
      "VISUAL_REVIEW do humano deve estar resolvido quando a aparência mudou antes de promover (modo B)",
      "promover SEM o .proj.json deixa o wall_presence gate cego (INCOMPLETE) no próximo ciclo — promote_canonical carrega o sidecar de propósito"
    ],
    "errosComuns": [
      "promover de runs/ direto pulando a etapa de review/ (quebra a hierarquia runs→review→artifacts do artifact_policy)",
      "esquecer de carregar model_top.png.proj.json na promoção → wall_presence INCOMPLETE depois (gotcha documentado em promote_canonical)",
      "sidecar .skp.metadata.json apontando pra runs/ em vez de artifacts/ após promoção ('promotion gotcha')",
      "declarar canônico sem README de Eixo 2 (julgamento humano de wall/room/opening fidelity como prose)"
    ],
    "debug": [
      "ls artifacts/<plant>/ confirma os 5 arquivos de evidência + 2 sidecars + README",
      "abrir geometry_report.json e checar gates_self_check com os 4 booleans em true",
      "/api/skp-timeline e /api/status (server.py) listam o canônico atual + verdict extraído do regression_summary",
      "_find_verdict() no server varre regression_summary.md/verdict.md procurando IMPROVED/SAME/WORSE/PASS pra exibir no cockpit"
    ]
  }
];
