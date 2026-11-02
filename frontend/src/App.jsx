import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownToLine, ArrowRight, BarChart3, BookOpen, Check, ChevronDown,
  ChevronLeft, ChevronRight, CircleAlert, Database, ExternalLink, Filter,
  Globe2, Info, Layers3, Leaf, Map as MapIcon, Menu, Mountain, RefreshCw,
  Satellite, Search, Settings2, ShieldCheck, SlidersHorizontal, Sparkles,
  TreePine, TrendingDown, X
} from "lucide-react";
import ForestMap2D from "./components/ForestMap2D.jsx";
import ForestMap3D from "./components/ForestMap3D.jsx";
import AnnualChart from "./components/AnnualChart.jsx";
import { API, request, urlDistrict, formatArea, formatPercent } from "./lib/api.js";

const districtNames = [
  "Gilé", "Mocuba", "Ile", "Gurué", "Alto Molócuè",
  "Maganja da Costa", "Pebane", "Mocubela", "Mulevala"
];
const modes = [
  { id: "loss_year", label: "Perda anual", sub: "Ano seleccionado", color: "#fa7965" },
  { id: "loss_total", label: "Perda acumulada", sub: "2001 até ao ano", color: "#fb9865" },
  { id: "cover", label: "Cobertura inicial", sub: "Copas no ano 2000", color: "#4acc97" },
  { id: "sentinel", label: "Sentinel-2 RGB", sub: "Composição anual", color: "#6aa4f6" },
];
function Label({ children }) { return <span className="field-label">{children}</span>; }
function Status({ health, validated, loading }) {
  const ok = Boolean(health?.gee_configured) && validated > 0;
  return <div className={"connection " + (ok ? "connected" : "not-connected")}>
    <span className="connection-dot"/>{loading ? "A verificar…" :
      ok ? "Earth Engine · ligado" : "Earth Engine · por configurar"}
  </div>;
}
function Metric({ icon: Icon, label, value, secondary, tone = "" }) {
  return <div className={"metric " + tone}>
    <div className="metric-heading"><span>{label}</span><span className="metric-icon"><Icon size={17}/></span></div>
    <div className="metric-value">{value}</div>
    <div className="metric-small">{secondary}</div>
  </div>;
}
function PanelHeader({ icon: Icon, title, subtitle, children }) {
  return <div className="panel-head">
    <div><div className="panel-title"><Icon size={18}/><h3>{title}</h3></div>
      {subtitle && <p>{subtitle}</p>}
    </div>
    {children}
  </div>;
}
function NavItem({ icon: Icon, text, active, click, soon }) {
  return <button onClick={click} className={"nav-item " + (active ? "nav-active" : "")}>
    <Icon size={19}/><span>{text}</span>{soon && <span className="soon">BREVE</span>}
    {active && <span className="nav-current"/>}
  </button>;
}
function EmptyMessage({ title, message, icon: Icon = CircleAlert }) {
  return <div className="empty-message"><div className="empty-icon"><Icon size={25}/></div>
    <strong>{title}</strong><span>{message}</span></div>;
}
function PageInfo({ title, subtitle, number }) {
  return <div className="info-section"><div className="info-number">{number}</div>
    <div><h3>{title}</h3><p>{subtitle}</p></div></div>;
}
export default function App() {
  const [screen, setScreen] = useState("overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [health, setHealth] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [district, setDistrict] = useState("Gilé");
  const [year, setYear] = useState(2025);
  const [compareYear, setCompareYear] = useState(2015);
  const [compare, setCompare] = useState(false);
  const [view, setView] = useState("2d");
  const [base, setBase] = useState("satellite");
  const [mode, setMode] = useState("loss_year");
  const [threshold, setThreshold] = useState(30);
  const [series, setSeries] = useState(null);
  const [boundary, setBoundary] = useState(null);
  const [layer, setLayer] = useState(null);
  const [comparisonLayer, setComparisonLayer] = useState(null);
  const [busy, setBusy] = useState({ bootstrap: true, series: false, layer: false });
  const [error, setError] = useState("");
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    setBusy(old => ({ ...old, bootstrap: true }));
    Promise.allSettled([request("/api/health"), request("/api/districts")])
      .then(([h, d]) => {
        if (!active) return;
        if (h.status === "fulfilled") setHealth(h.value);
        if (d.status === "fulfilled") {
          setCatalog(d.value);
          if (d.value.available.length &&
              !d.value.available.some(x => x.name === district)) {
            setDistrict(d.value.available[0].name);
          }
        } else {
          setError("Ainda não foi possível validar os limites distritais. Configure o Earth Engine no servidor.");
        }
      }).finally(() => { if (active) setBusy(old => ({...old, bootstrap: false})); });
    return () => { active = false; };
  }, [refreshIndex]);

  const available = catalog?.available?.map(item => item.name) || [];
  const supported = available.includes(district);
  useEffect(() => {
    setSeries(null);
    if (!supported) return;
    let active = true;
    setBusy(old => ({...old, series: true}));
    request("/api/series/" + urlDistrict(district) + "?threshold=" + threshold)
      .then(data => { if (active) { setSeries(data); setError(""); } })
      .catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setBusy(old => ({...old, series: false})); });
    return () => { active = false; };
  }, [district, threshold, supported, refreshIndex]);

  useEffect(() => {
    setBoundary(null);
    if (!supported) return;
    let active = true;
    request("/api/boundary/" + urlDistrict(district))
      .then(data => { if (active) setBoundary(data); })
      .catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [district, supported, refreshIndex]);

  useEffect(() => {
    setLayer(null);
    setComparisonLayer(null);
    if (!supported) return;
    let active = true;
    setBusy(old => ({...old, layer: true}));
    const load = async () => {
      try {
        const primary = await request("/api/tiles/" + urlDistrict(district) +
          "?year=" + year + "&mode=" + mode + "&threshold=" + threshold);
        if (active) setLayer(primary);
        if (compare && view === "2d") {
          const secondary = await request("/api/tiles/" + urlDistrict(district) +
            "?year=" + compareYear + "&mode=" + mode + "&threshold=" + threshold);
          if (active) setComparisonLayer(secondary);
        }
      } catch(e) { if (active) setError(e.message); }
      finally { if (active) setBusy(old => ({...old, layer: false})); }
    };
    load();
    return () => { active = false; };
  }, [district, year, compareYear, threshold, mode, compare, view, supported, refreshIndex]);

  const rows = series?.rows || [];
  const annual = rows.find(row => row.year === year)?.loss_ha;
  const peak = useMemo(() => rows.length ?
    rows.reduce((best, item) => item.loss_ha > best.loss_ha ? item : best, rows[0]) : null,
    [rows]);
  const lastFive = rows.filter(r => r.year >= 2021).reduce((sum, row) => sum + row.loss_ha, 0);
  const filteredDistricts = districtNames.filter(d => d.toLowerCase().includes(search.toLowerCase()));
  const exportSeries = useCallback(() => {
    if (!supported || !series) return;
    window.open(API + "/api/export/" + urlDistrict(district) + ".csv?threshold=" + threshold, "_blank", "noopener,noreferrer");
  }, [supported, series, district, threshold]);
  const onNavigate = (page) => { setScreen(page); setMobileNav(false); };

  return <div className="app-shell">
    <aside className={"sidebar " + (mobileNav ? "mobile-open" : "")}>
      <div className="brand"><span className="brand-mark"><TreePine size={25} strokeWidth={2.5}/></span>
        <div><strong>MOZFOREST</strong><span>WATCH <i/> INTELLIGENCE</span></div>
        <button className="mobile-close icon-button" onClick={() => setMobileNav(false)} aria-label="Fechar menu"><X size={20}/></button>
      </div>
      <div className="workspace-pill"><span className="workspace-icon"><Globe2 size={17}/></span><span><b>Moçambique</b><small>Observatório florestal</small></span><ChevronDown size={15}/></div>
      <div className="nav-label">PLATAFORMA</div>
      <nav aria-label="Navegação principal">
        <NavItem icon={BarChart3} text="Visão geral" active={screen === "overview"} click={() => onNavigate("overview")}/>
        <NavItem icon={MapIcon} text="Explorador geográfico" active={screen === "explorer"} click={() => onNavigate("explorer")}/>
        <NavItem icon={Activity} text="Análise temporal" active={screen === "analysis"} click={() => onNavigate("analysis")}/>
        <NavItem icon={Database} text="Catálogo de dados" active={screen === "sources"} click={() => onNavigate("sources")}/>
      </nav>
      <div className="nav-label nav-label-2">FERRAMENTAS</div>
      <nav aria-label="Ferramentas">
        <NavItem icon={Layers3} text="Camadas & filtros" active={screen === "layers"} click={() => onNavigate("layers")}/>
        <NavItem icon={BookOpen} text="Metodologia" active={screen === "method"} click={() => onNavigate("method")}/>
      </nav>
      <div className="sidebar-bottom">
        <div className="mission"><div className="mission-title"><Sparkles size={16}/> Ciência para decisões</div>
          <p>Monitorização florestal transparente, reproduzível e orientada para Moçambique.</p>
          <a href="https://github.com/heltrakinho07/MozForest_Watch" target="_blank" rel="noreferrer">Código-fonte <ArrowRight size={14}/></a>
        </div>
        <div className="side-footer"><span className="side-avatar">MW</span><div><b>MozForest Watch</b><small>Versão experimental 0.2</small></div><ShieldCheck size={17}/></div>
      </div>
    </aside>

    <div className="main-shell">
      <header className="topbar">
        <div className="breadcrumbs"><button className="mobile-menu icon-button" onClick={() => setMobileNav(true)} aria-label="Abrir menu"><Menu size={22}/></button>
          <span>Plataforma</span><ChevronRight size={14}/><strong>{{
            overview: "Visão geral", explorer: "Explorador", analysis: "Análise temporal",
            sources: "Dados & fontes", layers: "Camadas & filtros", method: "Metodologia"
          }[screen]}</strong></div>
        <div className="top-actions"><Status health={health} validated={available.length} loading={busy.bootstrap}/>
          <button className="icon-button refresh" onClick={() => setRefreshIndex(n => n + 1)} title="Actualizar dados" aria-label="Actualizar dados"><RefreshCw size={18}/></button>
          <a className="top-github" href="https://github.com/heltrakinho07/MozForest_Watch" target="_blank" rel="noreferrer"><ExternalLink size={16}/> GitHub</a>
        </div>
      </header>

      <div className="content">
        <div className="page-banner"><div><div className="overline"><span className="accent-dot"/> OBSERVATÓRIO GEOSPACIAL · ZAMBÉZIA</div>
          <h1>{screen === "sources" ? "Catálogo de dados" : screen === "method" ? "Ciência & metodologia" :
            screen === "analysis" ? "Análise temporal" : screen === "layers" ? "Camadas & parâmetros" :
            screen === "explorer" ? "Explorador florestal" : "Inteligência florestal"}</h1>
          <p>Monitorização da cobertura arbórea a partir de observações de satélite.</p></div>
          <div className="banner-actions"><span className="range-chip"><span/> SÉRIE HISTÓRICA 2001—2025</span>
            <button className="button button-outline" disabled={!series} onClick={exportSeries}>
              <ArrowDownToLine size={16}/> Exportar dados</button></div>
        </div>

        {error && <div className="alert-error"><CircleAlert size={19}/><span>{error}</span><button aria-label="Dispensar aviso" onClick={() => setError("")}><X size={17}/></button></div>}
        {!health?.gee_configured && <div className="setup-info"><Info size={19}/><div>
          <b>Ambiente científico ainda não configurado.</b>
          <span>A interface e os mapas base funcionam. Para activar dados reais, configure <code>GEE_PROJECT</code> e a autenticação Earth Engine no backend. Não apresentamos valores fictícios.</span>
          </div></div>}

        {(screen === "overview" || screen === "explorer" || screen === "analysis" || screen === "layers") && <>
          <div className="metrics-grid">
            <Metric icon={TreePine} label="Cobertura arbórea inicial (2000)" value={busy.series ? "A calcular…" : series ? formatArea(series.baseline_ha) + " ha" : "—"} secondary={"Copas ≥ " + threshold + "% · distrito seleccionado"}/>
            <Metric icon={TrendingDown} label="Perda acumulada 2001–2025" tone="metric-loss" value={busy.series ? "A calcular…" : series ? formatArea(series.total_loss_ha) + " ha" : "—"} secondary={series ? formatPercent(series.loss_pct_baseline) + " do referencial 2000" : "À espera da análise"}/>
            <Metric icon={Activity} label={"Perda detectada em " + year} value={busy.series ? "A calcular…" : series ? formatArea(annual) + " ha" : "—"} secondary="Estimativa por pixelArea()"/>
            <Metric icon={Globe2} label="Distritos validados" value={catalog ? available.length + " / 9" : "—"} secondary={catalog?.unresolved?.length ? catalog.unresolved.length + " por verificar" : "Verificação geográfica pendente"}/>
          </div>

          <div className={"work-grid " + (screen === "analysis" ? "analysis-priority" : "")}>
            <section className="map-panel panel">
              <div className="map-toolbar">
                <div><div className="panel-title"><MapIcon size={18}/><h3>Exploração geográfica</h3></div>
                  <p>Visualiza a distribuição espacial da alteração florestal.</p></div>
                <div className="map-toolbar-right">
                  <div className="segmented" aria-label="Vista do mapa">
                    <button className={view === "2d" ? "active" : ""} onClick={() => setView("2d")}><MapIcon size={14}/> 2D</button>
                    <button className={view === "3d" ? "active" : ""} onClick={() => {setView("3d");setCompare(false);}}><Globe2 size={14}/> 3D</button>
                  </div>
                  <button className={"compact-btn " + (compare ? "compact-active" : "")} disabled={view === "3d"} onClick={() => setCompare(v => !v)}>Comparar</button>
                </div>
              </div>
              <div className="map-control-row">
                <div className="map-location"><span className="map-location-dot"/><strong>{district}</strong><span>· Zambézia, Moçambique</span></div>
                <div className="basemaps">
                  <button className={base === "satellite" ? "selected" : ""} onClick={() => setBase("satellite")}><Satellite size={14}/> Satélite</button>
                  <button className={base === "streets" ? "selected" : ""} onClick={() => setBase("streets")}><MapIcon size={14}/> Mapa</button>
                </div>
              </div>
              <div className={"map-stage " + (compare && view === "2d" ? "map-compare" : "")}>
                {view === "3d" ? <ForestMap3D boundary={boundary} tile={layer}/> :
                  <><ForestMap2D boundary={boundary} tile={layer} base={base}
                                      label={compare ? "Ano " + year : ""} compact={compare}/>
                    {compare && <ForestMap2D boundary={boundary} tile={comparisonLayer} base={base}
                                              label={"Ano " + compareYear} compact/>}</>}
                {busy.layer && supported && <div className="map-loading"><RefreshCw size={17} className="spin"/> A preparar camada…</div>}
                <div className="map-legend"><span className="legend-swatch" style={{
                  background: modes.find(m => m.id === mode)?.color
                }}/>{modes.find(m => m.id === mode)?.label}</div>
              </div>
              <div className="map-timebar"><div className="timebar-title"><span><Activity size={15}/> Exploração temporal</span>
                <strong>{year}</strong></div>
                <input aria-label="Ano principal" type="range" min="2001" max="2025" value={year}
                       onChange={e => setYear(Number(e.target.value))}/>
                <div className="timebar-labels"><span>2001</span><span>2007</span><span>2013</span><span>2019</span><span>2025</span></div>
                {compare && <div className="comparison-year"><label>Ano de comparação: <b>{compareYear}</b></label>
                  <input aria-label="Ano secundário" type="range" min="2001" max="2025"
                         value={compareYear} onChange={e => setCompareYear(Number(e.target.value))}/></div>}
              </div>
              <div className="source-note"><Info size={14}/> Pixel Hansen ≈30 m; resultados são observações remotas exploratórias, não alertas em tempo real.</div>
            </section>

            <aside className="control-panel panel">
              <div className="panel-head-with-icon"><span className="controls-badge"><SlidersHorizontal size={17}/></span>
                <div><h3>Centro de controlo</h3><p>Configura a análise</p></div>
                <button className="small-icon" onClick={() => setSettingsOpen(x => !x)} aria-label="Expandir ou recolher filtros"><ChevronDown size={19} className={settingsOpen ? "" : "rotate"}/></button>
              </div>
              {settingsOpen && <div className="controls-content">
                <Label>ÁREA DE ESTUDO</Label>
                <div className="select-shell"><MapIcon size={17}/><select aria-label="Distrito seleccionado" value={district}
                  onChange={e => setDistrict(e.target.value)}>{districtNames.map(name => <option key={name} value={name}
                    disabled={!available.includes(name)}>{name}{!available.includes(name) ? " · por validar" : ""}</option>)}</select><ChevronDown size={15}/></div>
                <div className="district-status"><span className={supported ? "ok-pin" : "bad-pin"}/>{supported ? "Limite administrativo validado" : "Aguardando validação administrativa"}</div>
                <div className="field-divider"/>
                <Label>CAMADA DE OBSERVAÇÃO</Label>
                <div className="layer-options">{modes.map(item => <button key={item.id}
                     className={"layer-choice " + (mode === item.id ? "layer-selected" : "")}
                     onClick={() => {setMode(item.id); if (item.id === "sentinel" && year < 2017) setYear(2025);}}>
                  <span className="choice-swatch" style={{background:item.color}}/>
                  <span><b>{item.label}</b><small>{item.sub}</small></span><span className="choice-radio">{mode === item.id && <Check size={13}/>}</span>
                </button>)}</div>
                <div className="field-divider"/>
                <div className="setting-label"><Label>LIMIAR DE COBERTURA (2000)</Label><strong>{threshold}%</strong></div>
                <input aria-label="Cobertura mínima de copas" className="setting-slider" type="range" min="10" max="80" step="10" value={threshold}
                       onChange={e => setThreshold(Number(e.target.value))}/>
                <div className="setting-extents"><span>10%</span><span>80%</span></div>
                <div className="detail-tip"><Info size={16}/><span>Este limiar restringe a análise aos píxeis com cobertura de copas inicial igual ou superior ao valor escolhido.</span></div>
                <button className="button reset-button" onClick={() => {setThreshold(30);setYear(2025);setMode("loss_year");setCompare(false);setView("2d");}}><RefreshCw size={15}/> Repor filtros</button>
              </div>}
            </aside>
          </div>

          <div className="bottom-grid">
            <section className="chart-panel panel">
              <PanelHeader icon={BarChart3} title="Evolução anual da perda" subtitle={"Série histórica 2001–2025 · " + district}>
                <span className="chart-unit">HECTARES (ha)</span></PanelHeader>
              <AnnualChart rows={rows} selectedYear={year} onYearChange={setYear}/>
              <div className="chart-bottom"><span><i/> Perda anual de cobertura arbórea</span>
                <span>Clica nas barras para escolher um ano</span></div>
            </section>
            <section className="insights-panel panel">
              <PanelHeader icon={Activity} title="Indicadores-chave" subtitle="Resumo calculado para o distrito"/>
              <div className="insight-list"><div><span>Maior perda anual</span><strong>{peak ? peak.year : "—"}</strong></div>
              <div><span>Área nesse ano</span><strong>{peak ? formatArea(peak.loss_ha) + " ha" : "—"}</strong></div>
              <div><span>Perda 2021–2025</span><strong>{series ? formatArea(lastFive) + " ha" : "—"}</strong></div>
              <div><span>Área de referência (2000)</span><strong>{series ? formatArea(series.baseline_ha) + " ha" : "—"}</strong></div></div>
              <div className="insights-footer"><Info size={15}/> A perda não indica, por si só, a causa ou a legalidade da alteração.</div>
            </section>
          </div>

          {catalog?.unresolved?.length > 0 && <div className="pending-notice">
            <CircleAlert size={18}/><span><b>Limites ainda por verificar:</b> {catalog.unresolved.map(d => d.name).join(", ")}. Necessitam de geometrias distritais verificadas antes de gerar estatísticas.</span>
          </div>}
        </>}

        {screen === "sources" && <div className="editorial-panel panel">
          <div className="eyebrow-green">RASTREABILIDADE & PROVENIÊNCIA</div><h2>Dados abertos e documentados</h2>
          <p>Os resultados dependem de fontes públicas e versões explicitamente identificadas. Não juntamos automaticamente produtos com definições científicas diferentes.</p>
          <div className="source-grid">
            <div className="source-card"><Satellite size={25}/><span>PRINCIPAL</span><h3>Hansen Global Forest Change v1.13</h3><p>Perda anual 2001–2025 e cobertura de copas em 2000. Resolução aproximada de 30 m.</p><a href="https://developers.google.com/earth-engine/datasets/catalog/UMD_hansen_global_forest_change_2025_v1_13" target="_blank" rel="noreferrer">Ver catálogo <ExternalLink size={14}/></a></div>
            <div className="source-card"><MapIcon size={25}/><span>LIMITES ADMINISTRATIVOS</span><h3>FAO GAUL 2025 · Nível 2</h3><p>Polígonos distritais usados após correspondência inequívoca com a área seleccionada.</p><a href="https://developers.google.com/earth-engine/datasets/catalog/FAO_GAUL_2025_level2" target="_blank" rel="noreferrer">Ver catálogo <ExternalLink size={14}/></a></div>
            <div className="source-card"><Layers3 size={25}/><span>CONTEXTO VISUAL</span><h3>Sentinel-2 Surface Reflectance</h3><p>Composições anuais RGB, filtradas e mascaradas para nuvens quando disponíveis.</p><a href="https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_SR_HARMONIZED" target="_blank" rel="noreferrer">Ver catálogo <ExternalLink size={14}/></a></div>
          </div>
          <div className="source-important"><ShieldCheck size={21}/><div><strong>Rigor científico</strong><p>A análise Hansen representa perturbação de cobertura arbórea e não constitui confirmação de desflorestação permanente, ilegalidade ou emissões. Os limites FAO são dados de referência, não substituem cartografia oficial nacional.</p></div></div>
        </div>}

        {screen === "method" && <div className="editorial-panel panel">
          <div className="eyebrow-green">METODOLOGIA REPRODUZÍVEL</div><h2>Como calculamos as perdas?</h2>
          <p>O sistema usa Google Earth Engine, com o processamento centralizado no servidor Python, parâmetros explícitos e uma definição conservadora da área analisada.</p>
          <PageInfo number="01" title="Seleccionar a cobertura de copas de referência"
            subtitle="Pixels com canopy cover 2000 igual ou superior ao limiar escolhido; são excluídas áreas sem dados ou sem terra válida."/>
          <PageInfo number="02" title="Seleccionar os eventos anuais"
            subtitle="A banda lossyear identifica o ano de perturbação, de 2001 a 2025. A análise exige máscara válida e um distrito verificado."/>
          <PageInfo number="03" title="Calcular a área real dos píxeis"
            subtitle="Utilizamos ee.Image.pixelArea(), convertida para hectares, agregada por ano a uma escala de análise de 30 metros."/>
          <PageInfo number="04" title="Validar e interpretar com cautela"
            subtitle="Os resultados são indicadores de perda de cobertura arbórea. A atribuição causal requer dados adicionais e validação independente."/>
          <div className="method-foot"><BookOpen size={18}/> O código-fonte e o método de redução por grupos estão disponíveis no GitHub.</div>
        </div>}
        <footer className="footer"><span>© 2026 MozForest Watch · Pesquisa e monitorização geoespacial</span>
          <span>Dados: Hansen / FAO GAUL / Copernicus · <b>Uso exploratório</b></span></footer>
      </div>
    </div>
  </div>;
}
