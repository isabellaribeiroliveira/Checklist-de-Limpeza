/* Checklist de Limpeza — front-end (GitHub Pages) */
(function () {
  'use strict';

  /* ---------- utilitários ---------- */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const NOMES = { O: 'Ótimo', B: 'Bom', R: 'Regular', I: 'Insatisfatório', NA: 'Não aplicável' };
  const ORDEM = ['O', 'B', 'R', 'I', 'NA'];
  const CORES = { O: '#1E7A4C', B: '#8DAA3B', R: '#E0A21B', I: '#C8372D', NA: '#9AA6A9' };
  const ORDEM_CK = ['geral', 'predial_garagem', 'predial_pa', 'parcial'];
  const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const STATUS = { PLANEJADO: 'Planejado', REALIZADO: 'Realizado', CANCELADO: 'Cancelado' };
  const PALETA = ['#0E4D5C', '#4F8A99', '#8DAA3B', '#E0A21B', '#7A4E9C', '#C8372D', '#14262B'];
  const app = $('#app');

  const state = { sessao: lerSessao(), rota: null, form: null, charts: [], chartsModal: [], fotos: new Map(),
    semestre: null, filial: '', anoCrono: null, crono: null, auditorias: new Map(), usuarios: [], filiais: [] };

  const uid = () => Math.random().toString(36).slice(2, 10);
  const hojeISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const fmt = (n, d = 2) => (n === null || n === undefined || isNaN(n)) ? '—' : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const pct = (v, t) => t ? fmt(v / t * 100, 1) + '%' : '—';
  const fmtData = (s) => { if (!s) return '—'; const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/); return m ? `${m[3]}/${m[2]}/${m[1]}${m[4] ? ' ' + m[4] + ':' + m[5] : ''}` : s; };
  const ciclo = (e) => `${MESES[(e.mes || (e.ciclo === 1 ? 6 : 12)) - 1]}/${e.ano}`;
  const seq = (e) => e.ano * 2 + (e.ciclo - 1);
  const ehQualidade = () => state.sessao && state.sessao.perfil === 'QUALIDADE';
  const categoria = (item) => /uniforme/i.test(item) ? 'uniforme' : (/\bEPI/i.test(item) ? 'epi' : 'limpeza');
  const exigeEvidencia = (item, nota) => nota === 'R' || nota === 'I' || (nota === 'B' && categoria(item) !== 'limpeza');
  const iniciais = (n) => String(n || '').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

  function lerSessao() { try { return JSON.parse(localStorage.getItem('ck_sessao')); } catch (e) { return null; } }
  function salvarSessao(s) { state.sessao = s; try { s ? localStorage.setItem('ck_sessao', JSON.stringify(s)) : localStorage.removeItem('ck_sessao'); } catch (e) {} }

  /* ---------- API ---------- */
  async function api(action, dados = {}) {
    const url = window.CONFIG && CONFIG.API_URL;
    if (!url || url.includes('COLE_AQUI')) throw new Error('Configure a URL da API no arquivo config.js.');
    let res;
    try {
      res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ action, token: state.sessao && state.sessao.token }, dados)) });
    } catch (e) { throw new Error('Sem conexão com o servidor. Verifique a internet e tente de novo.'); }
    let data;
    try { data = await res.json(); } catch (e) { throw new Error('Resposta inválida do servidor. Confira a implantação do Apps Script.'); }
    if (!data.ok) {
      if (data.erro === 'SESSAO') { salvarSessao(null); rota('login'); throw new Error('Sua sessão expirou. Entre de novo.'); }
      throw new Error(data.erro || 'Erro no servidor.');
    }
    return data;
  }

  /* ---------- feedback ---------- */
  let toastTimer;
  function toast(msg, tipo = '') {
    const t = $('#toast'); t.textContent = msg; t.className = 'mostrar ' + tipo;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = ''; }, 5000);
  }
  function carregando(msg) {
    let o = $('#carregando');
    if (!msg) { if (o) o.remove(); return; }
    if (!o) { o = document.createElement('div'); o.id = 'carregando'; document.body.appendChild(o); }
    o.innerHTML = `<div class="carregando-caixa"><span class="giro"></span><p>${esc(msg)}</p></div>`;
  }
  const carregandoHTML = (t = 'Carregando…') => `<div class="vazio"><span class="giro"></span><p>${t}</p></div>`;
  const erroHTML = (m) => `<div class="vazio erro"><p>${esc(m)}</p><button class="btn sec" data-acao="recarregar">Tentar de novo</button></div>`;

  function modal(html, largo = false) {
    fecharModal();
    const m = document.createElement('div'); m.className = 'modal-fundo'; m.id = 'modal';
    m.innerHTML = `<div class="modal ${largo ? 'largo' : ''}" role="dialog" aria-modal="true"><button class="modal-fechar" data-acao="fecharModal" aria-label="Fechar">×</button><div class="modal-corpo">${html}</div></div>`;
    m.addEventListener('click', (e) => { if (e.target === m) fecharModal(); });
    document.body.appendChild(m); document.body.classList.add('sem-rolagem');
    return $('.modal-corpo', m);
  }
  function fecharModal() {
    state.chartsModal.forEach((c) => c.destroy()); state.chartsModal = [];
    const m = $('#modal'); if (m) m.remove(); document.body.classList.remove('sem-rolagem');
  }
  function confirmar(titulo, texto, ok = 'Confirmar') {
    return new Promise((resolve) => {
      const corpo = modal(`<h2>${esc(titulo)}</h2><p>${esc(texto)}</p><div class="acoes"><button class="btn sec" data-r="0">Cancelar</button><button class="btn primario" data-r="1">${esc(ok)}</button></div>`);
      corpo.addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (b) { fecharModal(); resolve(b.dataset.r === '1'); } });
      $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' || e.target.dataset.acao === 'fecharModal') resolve(false); });
    });
  }

  /* ---------- rotas ---------- */
  const VIEWS = {};
  const SO_QUALIDADE = ['painel', 'avaliacoes', 'cronograma', 'filiais', 'usuarios'];
  function rota(nome, arg) {
    state.charts.forEach((c) => c.destroy()); state.charts = [];
    fecharModal();
    if (!state.sessao) nome = 'login';
    if (SO_QUALIDADE.includes(nome) && !ehQualidade()) nome = 'inicio';
    state.rota = nome; state.rotaArg = arg;
    VIEWS[nome](arg);
    medirTopo();
    window.scrollTo(0, 0);
  }
  function medirTopo() { const h = $('.topo'); if (h) document.documentElement.style.setProperty('--topo', h.offsetHeight + 'px'); }
  window.addEventListener('resize', medirTopo);

  function topo(ativo) {
    const q = ehQualidade();
    const links = q ? [['painel', 'Painel'], ['avaliacoes', 'Avaliações'], ['cronograma', 'Cronograma'], ['inicio', 'Preencher'], ['filiais', 'Filiais'], ['usuarios', 'Usuários']]
      : [['inicio', 'Minhas auditorias']];
    return `<header class="topo">
      <div class="marca"><span class="marca-sinal" aria-hidden="true"><i></i><i></i><i></i><i></i></span><div><strong>Checklist de limpeza</strong><small>REG-UTL-176</small></div></div>
      <nav class="nav">${links.map(([r, l]) => `<button class="nav-link ${ativo === r ? 'ativo' : ''}" data-rota="${r}">${l}</button>`).join('')}</nav>
      <div class="usuario"><span>${esc(state.sessao.nome)}<small>${q ? 'Qualidade' : 'Avaliador'}</small></span>
        <button class="link" data-acao="senha">Senha</button><button class="link" data-acao="sair">Sair</button></div>
    </header>`;
  }

  /* ---------- LOGIN ---------- */
  VIEWS.login = function () {
    app.innerHTML = `<main class="login">
      <section class="login-lado">
        <span class="marca-sinal grande" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <h1>Checklist de limpeza</h1>
        <p>Inspeção de veículos, garagens e pontos de apoio de todas as filiais.</p>
        <ul class="escala">${ORDEM.map((n) => `<li><b class="chip n-${n}">${n}</b>${NOMES[n]}</li>`).join('')}</ul>
      </section>
      <form class="login-form" id="fLogin" autocomplete="on">
        <h2>Entrar</h2>
        <label>Usuário<input name="login" autocomplete="username" autocapitalize="none" required></label>
        <label>Senha<input type="password" name="senha" autocomplete="current-password" required></label>
        <button class="btn primario largo">Entrar</button>
        <p class="erro-msg" id="loginErro" role="alert"></p>
      </form>
    </main>`;
    $('#fLogin').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target); const btn = $('button', e.target);
      btn.disabled = true; btn.textContent = 'Entrando…'; $('#loginErro').textContent = '';
      try {
        const r = await api('login', { login: fd.get('login'), senha: fd.get('senha') });
        salvarSessao({ token: r.token, login: r.login, nome: r.nome, perfil: r.perfil });
        rota(r.perfil === 'QUALIDADE' ? 'painel' : 'inicio');
      } catch (err) { $('#loginErro').textContent = err.message; btn.disabled = false; btn.textContent = 'Entrar'; }
    });
  };

  /* ---------- AUDITORIAS DO AVALIADOR ---------- */
  const chaveRascunho = (cid, k) => `ck_rascunho_${state.sessao.login}_${cid}_${k}`;
  function lerRascunho(cid, k) { try { return JSON.parse(localStorage.getItem(chaveRascunho(cid, k))); } catch (e) { return null; } }

  async function carregarAuditorias() {
    const d = await api('minhasAuditorias');
    state.auditorias = new Map(d.auditorias.map((a) => [a.id, a]));
    return d.auditorias;
  }
  const locaisAud = (a) => [a.garagem].concat(a.pontos);

  VIEWS.inicio = async function () {
    const q = ehQualidade();
    app.innerHTML = topo('inicio') + `<main class="pagina">
      <h1>${q ? 'Preencher checklist' : 'Minhas auditorias'}</h1>
      <p class="suave">${q ? 'Auditorias planejadas no cronograma. Escolha uma para preencher os checklists.' : 'Auditorias em que você foi escalado pela Qualidade.'}</p>
      <div id="lista">${carregandoHTML()}</div></main>`;
    try {
      const lista = await carregarAuditorias();
      const el = $('#lista'); if (!el) return;
      if (!lista.length) {
        el.innerHTML = `<div class="vazio"><p>${q ? 'Nenhuma auditoria planejada. Monte o ciclo em Cronograma.' : 'Nenhuma auditoria programada para você. Quando a Qualidade escalar você no cronograma, ela aparece aqui.'}</p></div>`;
        return;
      }
      el.innerHTML = `<div class="auditorias">${lista.map((a) => {
        const feitos = a.aplicaveis.filter((k) => a.enviados.includes(k)).length;
        return `<button class="aud-card st-${a.status}" data-auditoria="${esc(a.id)}">
          <span class="aud-ciclo">${ciclo(a)}</span>
          <strong>${esc(a.filial_nome)}</strong>
          <span class="aud-locais">${locaisAud(a).map(esc).join(' · ')}</span>
          <span class="aud-rodape"><span class="badge st-${a.status}">${STATUS[a.status]}</span><span>${feitos} de ${a.aplicaveis.length} checklists enviados</span></span>
          ${q ? `<small>Avaliador: ${esc(a.auditores.join(', '))}</small>` : ''}
        </button>`; }).join('')}</div>`;
    } catch (e) { $('#lista') && ($('#lista').innerHTML = erroHTML(e.message)); }
  };

  VIEWS.auditoria = async function (id) {
    app.innerHTML = topo('inicio') + `<main class="pagina"><div id="conteudo">${carregandoHTML()}</div></main>`;
    try {
      await carregarAuditorias();
      const a = state.auditorias.get(id); const el = $('#conteudo'); if (!el) return;
      if (!a) { el.innerHTML = '<div class="vazio"><p>Esta auditoria não está mais disponível.</p><button class="btn sec" data-rota="inicio">Voltar</button></div>'; return; }
      el.innerHTML = `<button class="link voltar" data-rota="inicio">Voltar</button>
        <div class="aud-cab"><span class="aud-ciclo">${ciclo(a)}</span><h1>${esc(a.filial_nome)}</h1>
          <p><strong>Locais:</strong> ${locaisAud(a).map(esc).join(', ')}</p>
          <p class="suave">Avaliador: ${esc(a.auditores.join(', '))}</p>
          ${a.observacao ? `<p class="nota-crono">${esc(a.observacao)}</p>` : ''}</div>
        <h2 class="titulo-sec">Checklists desta auditoria</h2>
        <div class="escolha">${a.aplicaveis.map((k) => {
          const c = CHECKLISTS[k]; const env = a.enviados.includes(k); const r = !env && lerRascunho(a.id, k);
          const cols = locaisDoModelo(c, a);
          const tag = env ? 'div' : 'button';
          return `<${tag} class="escolha-item ${env ? 'enviado' : ''}" ${env ? '' : `data-abrir="${k}"`}>
            <span class="escolha-tipo">${c.tipo === 'veiculo' ? 'Veículos' : 'Predial'}</span>
            <strong>${esc(c.titulo)}</strong><small>${esc(cols.join(' · '))}</small>
            ${env ? '<em class="ok">Enviado</em>' : r ? `<em>Rascunho de ${fmtData(r.salvoEm)}</em>` : ''}
          </${tag}>`; }).join('')}</div>`;
    } catch (e) { $('#conteudo') && ($('#conteudo').innerHTML = erroHTML(e.message)); }
  };

  function locaisDoModelo(ck, a) {
    if (ck.locais === 'garagem') return [a.garagem];
    if (ck.locais === 'pontos') return a.pontos.slice();
    return locaisAud(a);
  }

  async function abrirForm(cid, k) {
    const r = lerRascunho(cid, k);
    if (r && await confirmar('Continuar rascunho?', `Há um rascunho salvo em ${fmtData(r.salvoEm)}. Deseja continuar de onde parou?`, 'Continuar rascunho')) {
      state.form = r;
    } else {
      if (r) localStorage.removeItem(chaveRascunho(cid, k));
      state.form = novoForm(state.auditorias.get(cid), k);
    }
    rota('form');
  }

  function respostasIniciais(ck) {
    const r = {};
    ck.secoes.forEach((s, si) => s.itens.forEach((it, ii) => { if (it.outros) r[`${si}-${ii}`] = { nota: 'NA' }; }));
    return r;
  }

  function novoForm(a, k) {
    const ck = CHECKLISTS[k]; const colunas = [];
    const locais = locaisDoModelo(ck, a);
    if (ck.tipo === 'veiculo') locais.forEach((l) => { for (let i = 0; i < (ck.min || 1); i++) colunas.push({ id: uid(), grupo: l, nome: '' }); });
    else locais.forEach((l) => colunas.push({ id: uid(), grupo: l, nome: l, fixo: true }));
    const respostas = {}; colunas.forEach((c) => { respostas[c.id] = respostasIniciais(ck); });
    return { cronogramaId: a.id, filial: a.filial_nome, ciclo: ciclo(a), chave: k, dataInspecao: hojeISO(), obs: '', colunas, respostas, ativa: colunas[0].id };
  }

  /* ---------- FORMULÁRIO ---------- */
  let rascunhoTimer;
  function salvarRascunho() {
    clearTimeout(rascunhoTimer);
    rascunhoTimer = setTimeout(() => {
      const f = state.form; if (!f) return;
      f.salvoEm = new Date().toISOString().slice(0, 16);
      const chave = chaveRascunho(f.cronogramaId, f.chave);
      try { localStorage.setItem(chave, JSON.stringify(f)); }
      catch (e) { // sem espaço para as fotos: guarda só as respostas
        try {
          const leve = JSON.parse(JSON.stringify(f));
          Object.values(leve.respostas).forEach((col) => Object.values(col).forEach((r) => { delete r.foto; }));
          localStorage.setItem(chave, JSON.stringify(leve));
        } catch (e2) {}
      }
    }, 400);
  }

  const ckAtual = () => CHECKLISTS[state.form.chave];
  const colAtiva = () => state.form.colunas.find((c) => c.id === state.form.ativa) || state.form.colunas[0];
  function rotuloColuna(c) {
    if (c.fixo) return c.nome;
    const doGrupo = state.form.colunas.filter((x) => x.grupo === c.grupo);
    return c.nome.trim() || `Veículo ${doGrupo.indexOf(c) + 1}`;
  }
  const totalItens = () => ckAtual().secoes.reduce((s, sec) => s + sec.itens.length, 0);
  function statusColuna(c) {
    const ck = ckAtual(); let feitos = 0, pend = 0;
    ck.secoes.forEach((s, si) => s.itens.forEach((it, ii) => {
      const r = state.form.respostas[c.id][`${si}-${ii}`];
      if (r && r.nota) { feitos++; if (exigeEvidencia(it.nome, r.nota) && (!r.justificativa || !r.foto)) pend++; }
    }));
    return { feitos, pend, total: totalItens() };
  }

  VIEWS.form = function () {
    const f = state.form, ck = ckAtual();
    app.innerHTML = topo('inicio') + `<main class="pagina form">
      <div class="form-cab">
        <button class="link voltar" data-acao="voltar">Voltar à auditoria</button>
        <span class="aud-ciclo">${esc(f.filial)} · ${esc(f.ciclo)}</span>
        <h1>${esc(ck.titulo)}</h1>
        <p class="regra">${esc(ck.regra)}</p>
        <div class="meta">
          <label>Data da inspeção<input type="date" id="fData" value="${f.dataInspecao}" max="${hojeISO()}"></label>
          <label>Responsável pela inspeção<input value="${esc(state.sessao.nome)}" disabled></label>
        </div>
      </div>
      <div class="legenda">
        <ul class="escala compacta">${ORDEM.map((n) => `<li><b class="chip n-${n}">${n}</b>${NOMES[n]}</li>`).join('')}</ul>
        <p>Regular e Insatisfatório pedem foto e motivo. Em Uniforme e EPI, qualquer nota abaixo de Ótimo também.</p>
      </div>
      <div id="abasColunas" class="abas-colunas"></div>
      <section id="painelColuna"></section>
      <label class="obs-gerais">Observações gerais (opcional)<textarea id="fObs" rows="3" placeholder="Algo que a Qualidade precisa saber sobre esta inspeção">${esc(f.obs)}</textarea></label>
    </main>
    <footer class="barra-envio"><div class="prog-info"><strong id="progTxt"></strong><div class="prog"><span id="progBar"></span></div></div>
      <button class="btn primario" data-acao="enviar">Enviar checklist</button></footer>`;
    renderAbas(); renderColuna(); atualizarProgresso();
  };

  function renderAbas() {
    const f = state.form, ck = ckAtual();
    const grupos = [...new Set(f.colunas.map((c) => c.grupo))];
    $('#abasColunas').innerHTML = f.colunas.length === 1 ? '' : grupos.map((g) => {
      const cols = f.colunas.filter((c) => c.grupo === g);
      return `<div class="grupo">${ck.tipo === 'veiculo' ? `<span class="grupo-nome">${esc(g)}</span>` : ''}<div class="tabs" role="tablist">
        ${cols.map((c) => { const s = statusColuna(c); const ok = s.feitos === s.total && !s.pend && (c.fixo || c.nome.trim());
          return `<button role="tab" aria-selected="${c.id === f.ativa}" class="tab ${c.id === f.ativa ? 'ativa' : ''} ${ok ? 'completa' : ''}" data-coluna="${c.id}">
            <span>${esc(rotuloColuna(c))}</span><small>${s.feitos}/${s.total}${s.pend ? ' · falta evidência' : ''}</small></button>`; }).join('')}
        ${ck.tipo === 'veiculo' ? `<button class="tab adicionar" data-add="${esc(g)}">+ Veículo</button>` : ''}
      </div></div>`;
    }).join('');
  }

  function renderColuna() {
    const f = state.form, ck = ckAtual(), c = colAtiva();
    let cab = '';
    if (ck.tipo === 'veiculo') {
      const podeRemover = f.colunas.filter((x) => x.grupo === c.grupo).length > (ck.min || 1);
      cab = `<div class="veic-cab"><label>Prefixo do veículo · ${esc(c.grupo)}<input id="fPrefixo" value="${esc(c.nome)}" placeholder="Ex.: M1710" autocapitalize="characters" autocomplete="off"></label>
        ${podeRemover ? `<button class="link perigo" data-remover="${c.id}">Remover este veículo</button>` : ''}</div>`;
    } else if (f.colunas.length > 1) {
      cab = `<div class="veic-cab"><h2 class="local-nome">${esc(c.nome)}</h2></div>`;
    }
    $('#painelColuna').innerHTML = cab + ck.secoes.map((s, si) => `<div class="secao"><h3>${esc(s.nome)}</h3>
      ${s.itens.map((it, ii) => itemHTML(c.id, si, ii)).join('')}</div>`).join('');
  }

  function itemHTML(colId, si, ii) {
    const it = ckAtual().secoes[si].itens[ii]; const key = `${si}-${ii}`;
    const r = state.form.respostas[colId][key] || {};
    const precisa = r.nota && exigeEvidencia(it.nome, r.nota);
    return `<div class="item ${r.nota ? 'feito' : ''}" id="it-${colId}-${key}" data-col="${colId}" data-key="${key}">
      <div class="item-nome">${esc(it.nome)}</div>
      <div class="notas" role="radiogroup" aria-label="${esc(it.nome)}">${ORDEM.map((n) => `<button type="button" role="radio" aria-checked="${r.nota === n}" class="nota n-${n} ${r.nota === n ? 'sel' : ''}" data-nota="${n}" title="${NOMES[n]}"><b>${n}</b><span>${NOMES[n]}</span></button>`).join('')}</div>
      ${it.outros && r.nota && r.nota !== 'NA' ? `<label class="campo">Qual item foi avaliado?<input data-campo="descricao" value="${esc(r.descricao || '')}" placeholder="Descreva o item"></label>` : ''}
      ${precisa ? `<div class="evidencia">
        <p><b class="chip n-${r.nota}">${r.nota}</b> Explique o motivo da nota ${NOMES[r.nota]} e anexe uma foto do que foi pontuado.</p>
        <label class="campo">Motivo da classificação<textarea data-campo="justificativa" rows="2" placeholder="O que foi encontrado e onde">${esc(r.justificativa || '')}</textarea></label>
        <div class="foto">${r.foto ? `<img src="${r.foto}" alt="Foto anexada de ${esc(it.nome)}"><button type="button" class="link perigo" data-acao="tirarFoto">Remover foto</button>`
          : `<label class="btn sec foto-btn">Tirar ou escolher foto<input type="file" accept="image/*" data-campo="foto" hidden></label>`}</div>
      </div>` : ''}
    </div>`;
  }

  function atualizarItem(colId, key) {
    const [si, ii] = key.split('-').map(Number);
    const el = document.getElementById(`it-${colId}-${key}`);
    if (el) el.outerHTML = itemHTML(colId, si, ii);
  }

  function atualizarProgresso() {
    const f = state.form; let feitos = 0; const total = totalItens() * f.colunas.length;
    f.colunas.forEach((c) => { feitos += statusColuna(c).feitos; });
    $('#progTxt').textContent = `${feitos} de ${total} itens avaliados`;
    $('#progBar').style.width = (total ? feitos / total * 100 : 0) + '%';
  }

  function comprimirFoto(file) {
    return new Promise((resolve, reject) => {
      const img = new Image(); const url = URL.createObjectURL(file);
      img.onload = () => {
        const s = Math.min(1, 1280 / Math.max(img.width, img.height));
        const cv = document.createElement('canvas'); cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url); resolve(cv.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler a imagem. Tente outra foto.')); };
      img.src = url;
    });
  }

  function validar() {
    const f = state.form, ck = ckAtual();
    if (!f.dataInspecao) return { msg: 'Informe a data da inspeção.', alvo: '#fData' };
    const prefixos = {};
    for (const c of f.colunas) {
      if (ck.tipo === 'veiculo') {
        const p = c.nome.trim().toUpperCase();
        if (!p) return { c, msg: `Informe o prefixo do ${rotuloColuna(c)} (${c.grupo}).`, alvo: '#fPrefixo' };
        if (prefixos[p]) return { c, msg: `O prefixo ${p} foi usado duas vezes.`, alvo: '#fPrefixo' };
        prefixos[p] = true;
      }
      for (let si = 0; si < ck.secoes.length; si++) {
        const s = ck.secoes[si];
        for (let ii = 0; ii < s.itens.length; ii++) {
          const it = s.itens[ii], key = `${si}-${ii}`, r = f.respostas[c.id][key] || {}, onde = `“${it.nome}” em ${rotuloColuna(c)}`;
          if (!r.nota) return { c, key, msg: `Avalie o item ${onde}.` };
          if (it.outros && r.nota !== 'NA' && !(r.descricao || '').trim()) return { c, key, msg: `Descreva qual item foi avaliado em ${onde}.` };
          if (exigeEvidencia(it.nome, r.nota)) {
            if (!(r.justificativa || '').trim()) return { c, key, msg: `Escreva o motivo da classificação de ${onde}.` };
            if (!r.foto) return { c, key, msg: `Anexe a foto de ${onde}.` };
          }
        }
      }
    }
    return null;
  }

  function irParaErro(e) {
    if (e.c && e.c.id !== state.form.ativa) { state.form.ativa = e.c.id; renderAbas(); renderColuna(); }
    const el = e.key ? document.getElementById(`it-${e.c.id}-${e.key}`) : $(e.alvo);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('erro'); if (!e.key && el.focus) el.focus(); }
    toast(e.msg, 'erro');
  }

  async function enviarChecklist() {
    const erro = validar(); if (erro) return irParaErro(erro);
    const f = state.form, ck = ckAtual();
    if (!await confirmar('Enviar checklist?', 'Depois do envio as respostas não podem ser alteradas.', 'Enviar checklist')) return;
    const dados = { cronogramaId: f.cronogramaId, checklist: f.chave, dataInspecao: f.dataInspecao, obsGerais: f.obs,
      colunas: f.colunas.map((c) => ({ id: c.id, grupo: c.grupo, nome: c.nome.trim() })), respostas: [] };
    f.colunas.forEach((c) => ck.secoes.forEach((s, si) => s.itens.forEach((it, ii) => {
      const r = f.respostas[c.id][`${si}-${ii}`]; const precisa = exigeEvidencia(it.nome, r.nota);
      dados.respostas.push({ colunaId: c.id, grupo: c.grupo, coluna: c.nome.trim(), secao: s.nome, item: it.nome, outros: !!it.outros,
        descricao: it.outros ? (r.descricao || '') : '', nota: r.nota, justificativa: precisa ? r.justificativa.trim() : '',
        foto: precisa && r.foto ? { mime: 'image/jpeg', base64: r.foto.split(',')[1] } : null });
    })));
    carregando('Enviando checklist e fotos…');
    try {
      await api('enviarChecklist', { dados });
      localStorage.removeItem(chaveRascunho(f.cronogramaId, f.chave));
      const cid = f.cronogramaId; state.form = null; carregando(); rota('enviado', { titulo: ck.titulo, cid });
    } catch (e) { carregando(); toast(e.message, 'erro'); }
  }

  VIEWS.enviado = function (arg) {
    app.innerHTML = topo('inicio') + `<main class="pagina enviado">
      <div class="selo" aria-hidden="true">✓</div>
      <h1>Checklist enviado</h1>
      <p>${esc(arg.titulo)} foi recebido pela Qualidade. O resultado será apresentado na reunião de avaliação.</p>
      <button class="btn primario" data-auditoria="${esc(arg.cid)}">Voltar à auditoria</button>
    </main>`;
  };

  /* ---------- PAINEL DA QUALIDADE ---------- */
  function filtros(d, comFilial = true) {
    return `<div class="filtros">
      ${comFilial ? `<label>Filial<select id="selFilial"><option value="">Todas as filiais</option>${d.filiais.map((f) => `<option value="${esc(f.id)}" ${f.id === d.filial ? 'selected' : ''}>${esc(f.nome)}</option>`).join('')}</select></label>` : ''}
      <label>Semestre<select id="selSem">${(d.semestres.length ? d.semestres : [d.semestre]).map((s) => `<option ${s === d.semestre ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
    </div>`;
  }
  const nomeFilial = (d) => (d.filiais.find((f) => f.id === d.filial) || {});
  function rotuloIndicador(k, d) {
    const f = nomeFilial(d);
    if (k === 'predial_garagem' && f.garagem) return `Nível de limpeza Predial - ${f.garagem}`;
    return d.resumo.checklists[k].indicador;
  }

  VIEWS.painel = async function () {
    app.innerHTML = topo('painel') + `<main class="pagina"><div id="conteudo">${carregandoHTML()}</div></main>`;
    try {
      const d = await api('painel', { semestre: state.semestre, filial: state.filial });
      state.semestre = d.semestre; if (!$('#conteudo')) return;
      d.filial ? renderPainelFilial(d) : renderPainelGeral(d);
    } catch (e) { $('#conteudo') && ($('#conteudo').innerHTML = erroHTML(e.message)); }
  };

  function renderPainelGeral(d) {
    const el = $('#conteudo');
    const comDados = d.porFilial.filter((f) => f.envios);
    el.innerHTML = `<div class="painel-cab"><h1>Avaliação do serviço de limpeza</h1>${filtros(d)}</div>
      ${!d.avaliacoes.length ? `<div class="vazio"><p>Nenhum checklist enviado em ${esc(d.semestre)}. Os resultados aparecem aqui assim que os avaliadores enviarem.</p></div>` : `
      <section class="resultado">
        <div class="nota-final"><span>Nota consolidada</span><strong>${fmt(d.resumo.final)}</strong><small>${esc(d.semestre)} · ${comDados.length} filial(is) · ${d.avaliacoes.length} envio(s)</small></div>
        <div class="bloco sem-margem"><div class="grafico-barras"><canvas id="gFiliais" aria-label="Nota final por filial"></canvas></div></div>
      </section>
      <h2 class="titulo-sec">Comparação entre filiais</h2>
      <div class="rolagem"><table class="tab-lista tab-filiais"><thead><tr><th>Filial</th>${ORDEM_CK.map((k) => `<th class="num">${esc(CHECKLISTS[k].titulo)}</th>`).join('')}<th class="num">Uniforme</th><th class="num">EPI</th><th class="num">Nota final</th><th></th></tr></thead><tbody>
        ${d.porFilial.map((f) => `<tr class="${f.envios ? '' : 'apagado'}"><td><strong>${esc(f.nome)}</strong><small>${f.envios} envio(s)</small></td>
          ${ORDEM_CK.map((k) => `<td class="num">${fmt(f.checklists[k])}</td>`).join('')}<td class="num">${fmt(f.uniforme)}</td><td class="num">${fmt(f.epi)}</td>
          <td class="num"><b>${fmt(f.final)}</b></td><td><button class="btn sec pequeno" data-ver-filial="${esc(f.id)}">Detalhar</button></td></tr>`).join('')}
      </tbody></table></div>
      <h2 class="titulo-sec">Itens pontuados e evidências</h2>${listaObservacoes(d.observacoes, true)}`}
      ${d.acumuladoFiliais && d.acumuladoFiliais.length ? `<h2 class="titulo-sec">Acumulado por filial</h2>
      <section class="bloco"><div class="rolagem"><table class="tab-acum"><thead><tr><th>Filial</th>${d.acumuladoFiliais.map((a) => `<th class="num">${esc(a.semestre.replace(' Semestre', ' Sem.'))}</th>`).join('')}</tr></thead><tbody>
        ${d.filiais.map((f) => `<tr><td>${esc(f.nome)}</td>${d.acumuladoFiliais.map((a) => `<td class="num">${fmt(a.finais[f.id])}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div><div class="grafico-linha"><canvas id="gAcum"></canvas></div></section>` : ''}`;

    if (window.Chart && $('#gFiliais')) {
      state.charts.push(new Chart($('#gFiliais'), { type: 'bar',
        data: { labels: comDados.map((f) => f.nome), datasets: [{ data: comDados.map((f) => f.final), backgroundColor: '#0E4D5C', borderRadius: 4 }] },
        options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: false, suggestedMin: 70, max: 100 } } } }));
    }
    if (window.Chart && $('#gAcum')) {
      state.charts.push(new Chart($('#gAcum'), { type: 'line',
        data: { labels: d.acumuladoFiliais.map((a) => a.semestre), datasets: d.filiais.map((f, i) => ({ label: f.nome, data: d.acumuladoFiliais.map((a) => a.finais[f.id]), borderColor: PALETA[i % PALETA.length], backgroundColor: PALETA[i % PALETA.length], tension: .25, spanGaps: true })) },
        options: { maintainAspectRatio: false, scales: { y: { suggestedMin: 70, max: 100 } }, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } } } }));
    }
    observarFotos();
  }

  function renderPainelFilial(d) {
    const r = d.resumo, el = $('#conteudo'), f = nomeFilial(d);
    if (!d.avaliacoes.length) {
      el.innerHTML = `<div class="painel-cab"><h1>${esc(f.nome || '')}</h1>${filtros(d)}</div>
        <div class="vazio"><p>Nenhum checklist de ${esc(f.nome || '')} enviado em ${esc(d.semestre)}.</p></div>`;
      return;
    }
    const linha = (k) => `<tr><td>${esc(rotuloIndicador(k, d))}</td><td class="num">${fmt(r.checklists[k].nota)}</td></tr>`;
    el.innerHTML = `
      <div class="painel-cab"><div><button class="link voltar" data-ver-filial="">Todas as filiais</button><h1>${esc(f.nome)}</h1></div>${filtros(d)}</div>
      <div class="barra-planilha"><div><strong>Planilha de resultado</strong>
        <span class="suave">${d.planilha ? `Atualizada em ${fmtData(d.planilha.atualizado_em)}. Ela se atualiza sozinha até 10 minutos após cada envio.` : 'Gerada automaticamente até 10 minutos após o primeiro envio, no formato da Avaliação Limpeza.'}</span></div>
        <div class="acoes-inline">${d.planilha ? `<a class="btn sec" href="${esc(d.planilha.url)}" target="_blank" rel="noopener">Abrir planilha</a>` : ''}
        <button class="btn primario" data-acao="gerarPlanilha">${d.planilha ? 'Atualizar agora' : 'Gerar agora'}</button></div></div>
      <section class="resultado">
        <div class="nota-final"><span>Nota final</span><strong>${fmt(r.final)}</strong><small>${esc(d.semestre)} · ${d.avaliacoes.length} envio(s)</small></div>
        <table class="tab-resultado">
          <thead><tr><th>Item avaliado</th><th class="num">Nota</th></tr></thead>
          <tbody>
            <tr class="grupo-linha"><th colspan="2">Limpeza geral <span>peso ${r.pesos.limpeza}</span></th></tr>
            ${linha('geral')}${linha('predial_garagem')}${linha('predial_pa')}
            <tr class="grupo-linha"><th colspan="2">Limpeza parcial <span>peso ${r.pesos.limpeza}</span></th></tr>
            ${linha('parcial')}
            <tr class="grupo-linha"><th colspan="2">Apresentação <span>peso ${r.pesos.uniforme}</span></th></tr>
            <tr><td>Higiene pessoal e uniforme</td><td class="num">${fmt(r.uniforme.nota)}</td></tr>
            <tr class="grupo-linha"><th colspan="2">EPIs <span>peso ${r.pesos.epi}</span></th></tr>
            <tr><td>Uso adequado de EPIs</td><td class="num">${fmt(r.epi.nota)}</td></tr>
          </tbody>
          <tfoot><tr><th>Nota final</th><th class="num">${fmt(r.final)}</th></tr></tfoot>
        </table>
      </section>
      <h2 class="titulo-sec">Resultado por checklist</h2>
      <section class="cards">${ORDEM_CK.map((k) => cardChecklist(k, r.checklists[k])).join('')}
        ${cardSimples('Uniforme e higiene pessoal', r.uniforme)}${cardSimples('Uso de EPIs', r.epi)}</section>
      <h2 class="titulo-sec">Itens pontuados e evidências</h2>
      ${listaObservacoes(d.observacoes, false)}
      <h2 class="titulo-sec">Acumulado</h2>
      <section class="bloco">${tabelaAcumulado(d)}<div class="grafico-linha"><canvas id="gAcum"></canvas></div></section>`;
    ORDEM_CK.forEach((k) => { const c = r.checklists[k]; if (c.total) state.charts.push(donut($('#g-' + k), c.contagem)); });
    graficoAcumulado(d.acumulado);
    observarFotos();
  }

  function cardChecklist(k, c) {
    const titulo = CHECKLISTS[k].titulo;
    if (!c.total) return `<article class="card sem-dados"><header><h3>${esc(titulo)}</h3></header><p class="suave">Sem envios neste semestre.</p></article>`;
    return `<article class="card"><header><h3>${esc(titulo)}</h3><span>${c.envios} envio(s)</span></header>
      <div class="card-corpo">
        <div class="donut"><canvas id="g-${k}"></canvas><div class="donut-centro"><strong>${fmt(c.positivo, 1)}%</strong><small>positivo</small></div></div>
        <ul class="dist">${['O', 'B', 'R', 'I'].map((n) => `<li><i class="ponto n-${n}"></i><span>${NOMES[n]}</span><b>${pct(c.contagem[n], c.total)}</b><em>${c.contagem[n]}</em></li>`).join('')}
          <li class="na"><i class="ponto n-NA"></i><span>Não aplicável</span><b></b><em>${c.contagem.NA}</em></li></ul>
      </div>
      <footer><div><small>Nota</small><strong>${fmt(c.nota)}</strong></div><div><small>Itens avaliados</small><strong>${c.total}</strong></div></footer></article>`;
  }

  function cardSimples(titulo, c) {
    return `<article class="card simples"><header><h3>${esc(titulo)}</h3></header>
      <div class="barra-dist">${['O', 'B', 'R', 'I'].map((n) => c.contagem[n] ? `<span class="n-${n}" style="flex:${c.contagem[n]}" title="${NOMES[n]}: ${c.contagem[n]}"></span>` : '').join('')}</div>
      <p class="suave">${['O', 'B', 'R', 'I'].filter((n) => c.contagem[n]).map((n) => `${NOMES[n]} ${c.contagem[n]}`).join(' · ') || 'Sem avaliações'}</p>
      <footer><div><small>Nota</small><strong>${fmt(c.nota)}</strong></div><div><small>Avaliações</small><strong>${c.total}</strong></div></footer></article>`;
  }

  function donut(canvas, cont) {
    if (!canvas || !window.Chart) return { destroy() {} };
    return new Chart(canvas, { type: 'doughnut',
      data: { labels: ['Ótimo', 'Bom', 'Regular', 'Insatisfatório'], datasets: [{ data: [cont.O, cont.B, cont.R, cont.I], backgroundColor: [CORES.O, CORES.B, CORES.R, CORES.I], borderWidth: 2, borderColor: '#fff' }] },
      options: { cutout: '70%', plugins: { legend: { display: false } }, animation: { duration: 500 } } });
  }

  function obsHTML(o, mostrarFilial) {
    const ck = CHECKLISTS[o.checklist] ? CHECKLISTS[o.checklist].titulo : o.checklist;
    return `<article class="obs">
      <div class="obs-foto">${o.foto_id ? `<div class="foto-lazy" data-foto="${esc(o.foto_id)}"><span>Carregando foto…</span></div>` : '<div class="sem-foto">Sem foto</div>'}</div>
      <div class="obs-texto"><p class="obs-topo"><b class="chip n-${o.nota}">${o.nota}</b><strong>${esc(o.item)}${o.descricao ? ' · ' + esc(o.descricao) : ''}</strong></p>
        <p class="suave">${mostrarFilial && o.filial_nome ? esc(o.filial_nome) + ' · ' : ''}${esc(ck)} · ${esc(o.coluna)}${o.data_inspecao ? ' · ' + fmtData(o.data_inspecao) : ''}</p>
        <p>${esc(o.justificativa || '—')}</p>
        ${o.avaliacao_id ? `<button class="link" data-detalhe="${esc(o.avaliacao_id)}">Ver avaliação completa</button>` : ''}</div></article>`;
  }
  function listaObservacoes(obs, mostrarFilial) {
    if (!obs.length) return '<section class="bloco"><p class="suave">Nenhum item Regular, Insatisfatório ou justificado neste semestre.</p></section>';
    return `<section class="observacoes">${obs.map((o) => obsHTML(o, mostrarFilial)).join('')}</section>`;
  }

  function tabelaAcumulado(d) {
    const ac = d.acumulado;
    return `<div class="rolagem"><table class="tab-acum"><thead><tr><th>Item avaliado</th>${ac.map((a) => `<th class="num">${esc(a.semestre.replace(' Semestre', ' Sem.'))}</th>`).join('')}</tr></thead><tbody>
      ${ORDEM_CK.map((k) => `<tr><td>${esc(rotuloIndicador(k, d))}</td>${ac.map((a) => `<td class="num">${fmt(a.checklists[k])}</td>`).join('')}</tr>`).join('')}
      <tr><td>Higiene pessoal e uniforme</td>${ac.map((a) => `<td class="num">${fmt(a.uniforme)}</td>`).join('')}</tr>
      <tr><td>Uso adequado de EPIs</td>${ac.map((a) => `<td class="num">${fmt(a.epi)}</td>`).join('')}</tr>
      </tbody><tfoot><tr><th>Nota final</th>${ac.map((a) => `<th class="num">${fmt(a.final)}</th>`).join('')}</tr></tfoot></table></div>`;
  }

  function graficoAcumulado(ac) {
    const cv = $('#gAcum'); if (!cv || !window.Chart) return;
    const ds = ORDEM_CK.map((k, i) => ({ label: CHECKLISTS[k].titulo, data: ac.map((a) => a.checklists[k]), borderColor: PALETA[i], backgroundColor: PALETA[i], tension: .25, spanGaps: true }));
    ds.push({ label: 'Nota final', data: ac.map((a) => a.final), borderColor: '#14262B', backgroundColor: '#14262B', borderWidth: 3, tension: .25 });
    state.charts.push(new Chart(cv, { type: 'line', data: { labels: ac.map((a) => a.semestre), datasets: ds },
      options: { maintainAspectRatio: false, scales: { y: { suggestedMin: 70, max: 100 } }, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } } } }));
  }

  async function gerarPlanilha() {
    carregando('Montando a planilha de resultado… pode levar até um minuto.');
    try {
      const r = await api('planilhaResultado', { filial: state.filial, semestre: state.semestre });
      carregando();
      modal(`<h2>Planilha pronta</h2><p>${esc(r.nome)}</p>
        <p class="suave">Abas: uma por checklist (notas, observações com link para as fotos, contagem e gráfico), Resultado e Acumulado.</p>
        <div class="acoes"><a class="btn sec" href="${esc(r.xlsx)}" target="_blank" rel="noopener">Baixar em Excel</a>
        <a class="btn primario" href="${esc(r.url)}" target="_blank" rel="noopener">Abrir no Google Planilhas</a></div>`);
    } catch (e) { carregando(); toast(e.message, 'erro'); }
  }

  /* fotos sob demanda (ficam privadas no Drive e passam pela API) */
  let observador;
  function observarFotos(raiz = document) {
    if (!observador) observador = new IntersectionObserver((ents) => ents.forEach((e) => { if (e.isIntersecting) { observador.unobserve(e.target); carregarFoto(e.target); } }), { rootMargin: '200px' });
    $$('.foto-lazy[data-foto]', raiz).forEach((el) => observador.observe(el));
  }
  async function carregarFoto(el) {
    const id = el.dataset.foto;
    try {
      let src = state.fotos.get(id);
      if (!src) { const r = await api('foto', { id }); src = `data:${r.mime};base64,${r.base64}`; state.fotos.set(id, src); }
      el.innerHTML = `<button class="foto-abrir" data-ampliar="${esc(id)}"><img src="${src}" alt="Foto da evidência"></button>`;
    } catch (e) { el.innerHTML = `<span>${esc(e.message)}</span>`; }
  }
  function ampliarFoto(id) {
    const src = state.fotos.get(id); if (!src) return;
    const fundo = document.createElement('div'); fundo.className = 'foto-cheia'; fundo.innerHTML = `<img src="${src}" alt="Foto ampliada"><button aria-label="Fechar">×</button>`;
    fundo.addEventListener('click', () => fundo.remove()); document.body.appendChild(fundo);
  }

  /* ---------- AVALIAÇÕES ---------- */
  VIEWS.avaliacoes = async function () {
    app.innerHTML = topo('avaliacoes') + `<main class="pagina"><div id="conteudo">${carregandoHTML()}</div></main>`;
    try {
      const d = await api('painel', { semestre: state.semestre, filial: state.filial }); state.semestre = d.semestre;
      $('#conteudo').innerHTML = `<div class="painel-cab"><h1>Avaliações recebidas</h1>${filtros(d)}</div>
        ${d.avaliacoes.length ? `<div class="rolagem"><table class="tab-lista"><thead><tr><th>Filial</th><th>Checklist</th><th>Inspeção</th><th>Responsável</th><th>Veículos/locais</th><th class="num">Positivo</th><th class="num">Nota</th><th></th></tr></thead><tbody>
          ${d.avaliacoes.map((a) => `<tr><td>${esc(a.filial_nome)}</td><td><strong>${esc(a.checklist_nome)}</strong><small>${esc(a.id)}</small></td><td>${fmtData(a.data_inspecao)}</td><td>${esc(a.nome)}</td>
            <td>${esc(a.colunas.join(', '))}</td><td class="num">${a.positivo === null ? '—' : fmt(a.positivo, 1) + '%'}</td><td class="num"><b>${fmt(a.nota)}</b></td>
            <td><button class="btn sec pequeno" data-detalhe="${esc(a.id)}">Abrir</button></td></tr>`).join('')}
        </tbody></table></div>` : `<div class="vazio"><p>Nenhum checklist enviado em ${esc(d.semestre)}.</p></div>`}`;
    } catch (e) { $('#conteudo') && ($('#conteudo').innerHTML = erroHTML(e.message)); }
  };

  async function abrirDetalhe(id) {
    const corpo = modal(carregandoHTML('Carregando avaliação…'), true);
    try {
      const d = await api('detalhe', { id }); const a = d.avaliacao;
      const colunas = a.colunas.length ? a.colunas : [...new Map(d.respostas.map((r) => [r.coluna_id, { id: r.coluna_id, nome: r.coluna, grupo: r.grupo }])).values()];
      const secoes = [...new Set(d.respostas.map((r) => r.secao))];
      const mapa = {}; d.respostas.forEach((r) => { mapa[`${r.coluna_id}|${r.secao}|${r.item}`] = r; });
      const cont = (a.contagens && a.contagens.limpeza) || { O: 0, B: 0, R: 0, I: 0, NA: 0 };
      const total = cont.O + cont.B + cont.R + cont.I;
      const notaCol = (cid) => { const c = { O: 0, B: 0, R: 0, I: 0 }; d.respostas.forEach((r) => { if (r.coluna_id === cid && r.categoria === 'limpeza' && c[r.nota] !== undefined) c[r.nota]++; });
        const t = c.O + c.B + c.R + c.I; return t ? (c.O * 5 + c.B * 4.5 + c.R * 3 + c.I * 2) / (t * 5) * 100 : null; };
      const evid = d.respostas.filter((r) => r.justificativa || r.nota === 'R' || r.nota === 'I');

      corpo.innerHTML = `<div class="det-cab"><div><h2>${esc(a.filial_nome)} · ${esc(a.checklist_nome)}</h2>
          <p class="suave">Inspeção ${fmtData(a.data_inspecao)} · ${esc(a.nome)} · enviado ${fmtData(a.enviado_em)} · ${esc(a.id)}</p></div>
          <div class="det-nota"><small>Nota da aba</small><strong>${fmt(a.nota)}</strong></div></div>
        <div class="det-resumo"><div class="donut pequeno"><canvas id="gDet"></canvas><div class="donut-centro"><strong>${fmt(a.positivo, 1)}%</strong><small>positivo</small></div></div>
          <ul class="dist">${['O', 'B', 'R', 'I'].map((n) => `<li><i class="ponto n-${n}"></i><span>${NOMES[n]}</span><b>${pct(cont[n], total)}</b><em>${cont[n]}</em></li>`).join('')}
          <li class="na"><i class="ponto n-NA"></i><span>Não aplicável</span><b></b><em>${cont.NA}</em></li></ul></div>
        <div class="rolagem"><table class="tab-grade"><thead><tr><th>Item</th>${colunas.map((c) => `<th>${esc(c.nome)}<small>${c.grupo !== c.nome ? esc(c.grupo) : ''}</small></th>`).join('')}</tr></thead><tbody>
          ${secoes.map((s) => `<tr class="grupo-linha"><th colspan="${colunas.length + 1}">${esc(s)}</th></tr>` +
            [...new Set(d.respostas.filter((r) => r.secao === s).map((r) => r.item))].map((item) => `<tr><td>${esc(item)}</td>${colunas.map((c) => { const r = mapa[`${c.id}|${s}|${item}`];
              return `<td class="cel">${r ? `<b class="chip n-${r.nota}" title="${NOMES[r.nota]}${r.descricao ? ': ' + esc(r.descricao) : ''}">${r.nota}</b>` : ''}</td>`; }).join('')}</tr>`).join('')).join('')}
          </tbody><tfoot><tr><th>Nota por coluna</th>${colunas.map((c) => `<th class="num">${fmt(notaCol(c.id))}</th>`).join('')}</tr></tfoot></table></div>
        ${a.obs_gerais ? `<div class="bloco"><h3>Observações gerais</h3><p>${esc(a.obs_gerais)}</p></div>` : ''}
        <h3>Evidências</h3>
        ${evid.length ? `<div class="observacoes">${evid.map((o) => obsHTML(Object.assign({}, o, { checklist: a.checklist }), false)).join('')}</div>` : '<p class="suave">Nenhum item pontuado abaixo de Bom.</p>'}`;
      if (total) state.chartsModal.push(donut($('#gDet'), cont));
      observarFotos(corpo);
    } catch (e) { corpo.innerHTML = `<p class="erro-msg">${esc(e.message)}</p>`; }
  }

  /* ---------- CRONOGRAMA ---------- */
  VIEWS.cronograma = async function () {
    app.innerHTML = topo('cronograma') + `<main class="pagina"><div id="conteudo">${carregandoHTML()}</div></main>`;
    try { state.crono = await api('cronograma'); renderCronograma(); }
    catch (e) { $('#conteudo') && ($('#conteudo').innerHTML = erroHTML(e.message)); }
  };

  const nomeAud = (l) => (state.crono.nomes[l] || l);
  const entradaDe = (fid, ano, c) => state.crono.entradas.find((e) => e.filial_id === fid && e.ano === ano && e.ciclo === c && e.status !== 'CANCELADO');

  function renderCronograma() {
    const d = state.crono; const el = $('#conteudo'); if (!el) return;
    const anoAtual = new Date().getFullYear();
    const anos = [...new Set(d.entradas.map((e) => e.ano).concat([anoAtual, anoAtual + 1]))].sort();
    const ano = state.anoCrono || anoAtual; state.anoCrono = ano;
    el.innerHTML = `<div class="painel-cab"><div><h1>Cronograma de auditorias</h1>
        <p class="suave">Dois ciclos por ano. O rodízio sugere os pontos de apoio há mais tempo sem auditoria e alterna os avaliadores entre as filiais.</p></div>
      <div class="filtros"><label>Ano<select id="selAno">${anos.map((a) => `<option ${a === ano ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
        <button class="btn primario" data-acao="sugerir">Sugerir rodízio</button></div></div>
      <div class="crono-lista">${d.filiais.filter((f) => f.ativo).map((f) => `
        <article class="crono-filial">
          <header><h2>${esc(f.nome)}</h2><p class="suave">${esc(f.garagem)} · ${f.pontos.filter((p) => p.ativo).length} pontos de apoio · ${f.pontos_por_ciclo} por ciclo · avaliadores: ${f.auditores.map(nomeAud).map(esc).join(', ') || '—'}</p></header>
          <div class="crono-ciclos">${[1, 2].map((c) => celulaCrono(f, ano, c)).join('')}</div>
          <details class="mapa"><summary>Mapa de rodízio</summary>${mapaRodizio(f)}</details>
        </article>`).join('')}</div>
      ${d.filiais.some((f) => !f.ativo) ? `<p class="suave">Filiais inativas não aparecem aqui: ${d.filiais.filter((f) => !f.ativo).map((f) => esc(f.nome)).join(', ')}.</p>` : ''}`;
  }

  function celulaCrono(f, ano, c) {
    const e = entradaDe(f.id, ano, c);
    if (!e) return `<button class="ciclo vazio" data-novo-crono="${esc(f.id)}|${ano}|${c}"><span>${c === 1 ? 'Jun' : 'Dez'}/${ano}</span>+ Programar</button>`;
    return `<div class="ciclo st-${e.status}">
      <div class="ciclo-topo"><strong>${ciclo(e)}</strong><span class="badge st-${e.status}">${STATUS[e.status]}</span></div>
      <ul class="locais"><li class="garagem">${esc(f.garagem)}</li>${e.pontos.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
      <p class="auds">${e.auditores.map((a) => `<span class="pessoa">${esc(nomeAud(a))}</span>`).join('')}</p>
      ${e.observacao ? `<p class="nota-crono">${esc(e.observacao)}</p>` : ''}
      <button class="link" data-editar-crono="${esc(e.id)}">Editar</button></div>`;
  }

  function mapaRodizio(f) {
    const hist = state.crono.entradas.filter((e) => e.filial_id === f.id && e.status !== 'CANCELADO').sort((a, b) => seq(a) - seq(b));
    if (!hist.length) return '<p class="suave">Sem histórico ainda.</p>';
    const pontos = [...new Set(f.pontos.map((p) => p.nome).concat(...hist.map((e) => e.pontos)))];
    return `<div class="rolagem"><table class="tab-mapa"><thead><tr><th>Local</th>${hist.map((e) => `<th>${ciclo(e)}</th>`).join('')}</tr></thead><tbody>
      ${pontos.map((p) => { const ativo = (f.pontos.find((x) => x.nome === p) || {}).ativo;
        return `<tr class="${ativo ? '' : 'apagado'}"><td>${esc(p)}${ativo ? '' : ' <small>(inativo)</small>'}</td>${hist.map((e) => e.pontos.includes(p)
          ? `<td class="marcado" title="${esc(e.auditores.map(nomeAud).join(', '))}">${e.auditores.map((a) => iniciais(nomeAud(a))).join('/')}</td>` : '<td></td>').join('')}</tr>`; }).join('')}
      </tbody><tfoot><tr><th>Avaliador</th>${hist.map((e) => `<th>${esc(e.auditores.map(nomeAud).map((n) => n.split(' ')[0]).join(', '))}</th>`).join('')}</tr></tfoot></table></div>`;
  }

  function opcoesPontos(f, marcados) {
    return f.pontos.map((p) => `<label class="check ${p.ativo ? '' : 'apagado'}"><input type="checkbox" name="pontos" value="${esc(p.nome)}" ${marcados.includes(p.nome) ? 'checked' : ''}>${esc(p.nome)}${p.ativo ? '' : ' (inativo)'}</label>`).join('') || '<p class="suave">Filial sem pontos de apoio cadastrados.</p>';
  }
  function opcoesAuditores(f, marcados) {
    return f.auditores.map((a) => `<label class="check"><input type="checkbox" name="auditores" value="${esc(a)}" ${marcados.includes(a) ? 'checked' : ''}>${esc(nomeAud(a))}</label>`).join('') || '<p class="suave">Cadastre os avaliadores desta filial em Filiais.</p>';
  }

  function editarCrono(e) {
    const f = state.crono.filiais.find((x) => x.id === e.filial_id);
    const corpo = modal(`<h2>${e.id ? 'Editar' : 'Programar'} auditoria · ${esc(f.nome)}</h2>
      <form id="fCrono">
        <div class="linha3"><label>Ano<input type="number" name="ano" value="${e.ano}" min="2020" max="2100" required></label>
          <label>Ciclo<select name="ciclo"><option value="1" ${e.ciclo === 1 ? 'selected' : ''}>1º semestre</option><option value="2" ${e.ciclo === 2 ? 'selected' : ''}>2º semestre</option></select></label>
          <label>Mês<select name="mes">${MESES.map((m, i) => `<option value="${i + 1}" ${(e.mes || (e.ciclo === 1 ? 6 : 12)) === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select></label></div>
        <fieldset><legend>Locais</legend><label class="check"><input type="checkbox" checked disabled>${esc(f.garagem)} (sempre)</label>${opcoesPontos(f, e.pontos || [])}</fieldset>
        <fieldset><legend>Avaliadores</legend>${opcoesAuditores(f, e.auditores || [])}</fieldset>
        <label>Situação<select name="status">${Object.keys(STATUS).map((s) => `<option value="${s}" ${(e.status || 'PLANEJADO') === s ? 'selected' : ''}>${STATUS[s]}</option>`).join('')}</select></label>
        <label>Observação<textarea name="observacao" rows="3" placeholder="Lembretes para este ciclo ou para o próximo">${esc(e.observacao || '')}</textarea></label>
        <div class="acoes">${e.id ? '<button type="button" class="btn sec perigo-txt" data-acao="excluirCrono">Excluir</button>' : ''}<button class="btn primario">Salvar</button></div>
      </form>`);
    const form = $('#fCrono', corpo);
    form.ciclo.addEventListener('change', () => { form.mes.value = form.ciclo.value === '1' ? '6' : '12'; });
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const entrada = { id: e.id, filial_id: f.id, ano: Number(form.ano.value), ciclo: Number(form.ciclo.value), mes: Number(form.mes.value),
        pontos: $$('input[name=pontos]:checked', form).map((i) => i.value), auditores: $$('input[name=auditores]:checked', form).map((i) => i.value),
        status: form.status.value, observacao: form.observacao.value };
      carregando('Salvando…');
      try {
        const r = await api('salvarCronograma', { entrada }); carregando();
        toast(r.avisos && r.avisos.length ? 'Salvo. Atenção: ' + r.avisos.join(' ') : 'Programação salva.', r.avisos && r.avisos.length ? 'aviso' : 'ok');
        state.anoCrono = entrada.ano; rota('cronograma');
      } catch (err) { carregando(); toast(err.message, 'erro'); }
    });
    const ex = $('[data-acao=excluirCrono]', corpo);
    if (ex) ex.addEventListener('click', async () => {
      if (!await confirmar('Excluir programação?', `${f.nome} · ${ciclo(e)}. Se já houver checklists enviados, use a situação Cancelado.`, 'Excluir')) { editarCrono(e); return; }
      carregando('Excluindo…');
      try { await api('excluirCronograma', { id: e.id }); carregando(); toast('Programação excluída.', 'ok'); rota('cronograma'); }
      catch (err) { carregando(); toast(err.message, 'erro'); }
    });
  }

  function modalSugerir() {
    const anoAtual = new Date().getFullYear(); const prox = new Date().getMonth() < 6 ? { a: anoAtual, c: 2 } : { a: anoAtual + 1, c: 1 };
    const corpo = modal(`<h2>Sugerir rodízio</h2>
      <p class="suave">Para cada filial, o sistema escolhe os pontos de apoio há mais tempo sem auditoria e um avaliador que não está escalado em outra filial no mesmo ciclo, preferindo quem está há mais tempo sem auditar aquela filial.</p>
      <form id="fSug" class="linha3"><label>Ano<input type="number" name="ano" value="${prox.a}" min="2020" max="2100"></label>
        <label>Ciclo<select name="ciclo"><option value="1" ${prox.c === 1 ? 'selected' : ''}>1º semestre (Jun)</option><option value="2" ${prox.c === 2 ? 'selected' : ''}>2º semestre (Dez)</option></select></label>
        <button class="btn primario">Gerar sugestão</button></form>
      <div id="propostas"></div>`, true);
    $('#fSug', corpo).addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const ano = Number(ev.target.ano.value), c = Number(ev.target.ciclo.value);
      $('#propostas').innerHTML = carregandoHTML('Calculando rodízio…');
      try { const r = await api('sugerirCronograma', { ano, ciclo: c }); renderPropostas(r); }
      catch (err) { $('#propostas').innerHTML = `<p class="erro-msg">${esc(err.message)}</p>`; }
    });
  }

  function renderPropostas(r) {
    Object.assign(state.crono.nomes, r.nomes || {});
    const el = $('#propostas');
    el.innerHTML = `<div class="propostas">${r.propostas.map((p, i) => { const f = state.crono.filiais.find((x) => x.id === p.filial_id);
      return `<article class="prop" data-i="${i}">
        <header><label class="check forte"><input type="checkbox" data-incluir ${p.existente ? '' : 'checked'}>${esc(p.filial_nome)}</label>
          ${p.existente ? `<span class="badge">Já programado: ${esc(p.existente.pontos.join(', ') || 'só garagem')} · ${esc(p.existente.auditores.map(nomeAud).join(', '))}</span>` : ''}</header>
        <div class="prop-corpo">
          <fieldset><legend>Locais</legend><label class="check"><input type="checkbox" checked disabled>${esc(p.garagem)}</label>${opcoesPontos(f, p.pontos)}</fieldset>
          <fieldset><legend>Avaliadores</legend>${opcoesAuditores(f, p.auditores)}</fieldset>
          <ul class="motivos">${p.motivos.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
        </div></article>`; }).join('')}</div>
      <div class="acoes"><button class="btn primario" data-acao="salvarPropostas">Salvar selecionadas no cronograma</button></div>`;
    $('[data-acao=salvarPropostas]', el).addEventListener('click', async () => {
      const escolhidas = $$('.prop', el).filter((a) => $('[data-incluir]', a).checked);
      if (!escolhidas.length) { toast('Marque pelo menos uma filial.', 'erro'); return; }
      carregando('Salvando cronograma…'); const avisos = [], erros = [];
      for (const art of escolhidas) {
        const p = r.propostas[Number(art.dataset.i)];
        const entrada = { id: p.existente ? p.existente.id : '', filial_id: p.filial_id, ano: r.ano, ciclo: r.ciclo, mes: p.existente ? p.existente.mes : p.mes,
          pontos: $$('input[name=pontos]:checked', art).map((x) => x.value), auditores: $$('input[name=auditores]:checked', art).map((x) => x.value),
          status: p.existente ? p.existente.status : 'PLANEJADO', observacao: p.existente ? p.existente.observacao : '' };
        try { const res = await api('salvarCronograma', { entrada }); avisos.push(...(res.avisos || [])); }
        catch (err) { erros.push(`${p.filial_nome}: ${err.message}`); }
      }
      carregando(); state.anoCrono = r.ano; rota('cronograma');
      if (erros.length) toast(erros.join(' '), 'erro');
      else toast(avisos.length ? 'Cronograma salvo. Atenção: ' + [...new Set(avisos)].join(' ') : 'Cronograma salvo.', avisos.length ? 'aviso' : 'ok');
    });
  }

  /* ---------- FILIAIS ---------- */
  VIEWS.filiais = async function () {
    app.innerHTML = topo('filiais') + `<main class="pagina"><div id="conteudo">${carregandoHTML()}</div></main>`;
    try {
      const d = await api('listarFiliais'); state.filiais = d.filiais; state.usuarios = d.usuarios;
      const nome = (l) => (d.usuarios.find((u) => u.login === l) || {}).nome || l;
      $('#conteudo').innerHTML = `<div class="painel-cab"><div><h1>Filiais</h1><p class="suave">Garagem, pontos de apoio e avaliadores que entram no rodízio de cada filial.</p></div>
        <button class="btn primario" data-acao="novaFilial">Nova filial</button></div>
        <div class="filiais-grid">${d.filiais.map((f) => `<article class="card ${f.ativo ? '' : 'sem-dados'}">
          <header><h3>${esc(f.nome)}</h3><span>${f.ativo ? '' : 'Inativa'}</span></header>
          <p><strong>${esc(f.garagem)}</strong></p>
          <p class="suave">Pontos de apoio (${f.pontos_por_ciclo} por ciclo): ${f.pontos.map((p) => esc(p.nome) + (p.ativo ? '' : ' (inativo)')).join(', ') || '—'}</p>
          <p class="suave">Avaliadores (${f.auditores_por_ciclo} por ciclo): ${f.auditores.map((a) => esc(nome(a))).join(', ') || '—'}</p>
          <footer><button class="btn sec pequeno" data-editar-filial="${esc(f.id)}">Editar</button></footer></article>`).join('')}</div>`;
    } catch (e) { $('#conteudo') && ($('#conteudo').innerHTML = erroHTML(e.message)); }
  };

  const linhaPonto = (p = { nome: '', ativo: true }) => `<div class="ponto-linha"><input name="ponto_nome" value="${esc(p.nome)}" placeholder="Nome do ponto de apoio">
    <label class="check"><input type="checkbox" name="ponto_ativo" ${p.ativo ? 'checked' : ''}>Ativo</label><button type="button" class="link perigo" data-acao="removerPonto">Remover</button></div>`;

  function editarFilial(f) {
    f = f || { nome: '', garagem: '', pontos: [], auditores: [], pontos_por_ciclo: 1, auditores_por_ciclo: 1, ativo: true };
    const usuarios = state.usuarios.slice().sort((a, b) => (f.auditores.includes(b.login) - f.auditores.includes(a.login)) || a.nome.localeCompare(b.nome));
    const corpo = modal(`<h2>${f.id ? 'Editar ' + esc(f.nome) : 'Nova filial'}</h2>
      <form id="fFilial">
        <div class="linha2"><label>Nome da filial<input name="nome" value="${esc(f.nome)}" required></label><label>Garagem<input name="garagem" value="${esc(f.garagem)}" required placeholder="Ex.: Garagem Mariana"></label></div>
        <fieldset><legend>Pontos de apoio</legend><div id="pontos">${f.pontos.map(linhaPonto).join('')}</div>
          <button type="button" class="btn sec pequeno" data-acao="addPonto">+ Ponto de apoio</button>
          <p class="suave">Desative em vez de remover quando o ponto parar temporariamente (ex.: mudança de endereço). O histórico do rodízio é mantido.</p></fieldset>
        <fieldset><legend>Avaliadores do rodízio</legend><div class="checks-colunas">${usuarios.map((u) => `<label class="check"><input type="checkbox" name="auditores" value="${esc(u.login)}" ${f.auditores.includes(u.login) ? 'checked' : ''}>${esc(u.nome)}${u.ativo === 'SIM' ? '' : ' <small>(sem acesso)</small>'}</label>`).join('')}</div></fieldset>
        <div class="linha3"><label>Pontos por ciclo<input type="number" name="ppc" min="0" max="20" value="${f.pontos_por_ciclo}"></label>
          <label>Avaliadores por ciclo<input type="number" name="apc" min="1" max="5" value="${f.auditores_por_ciclo}"></label>
          <label>Situação<select name="ativo"><option value="SIM">Ativa</option><option value="NAO" ${f.ativo ? '' : 'selected'}>Inativa</option></select></label></div>
        <div class="acoes"><button class="btn primario">Salvar filial</button></div>
      </form>`, true);
    const form = $('#fFilial', corpo);
    corpo.addEventListener('click', (e) => {
      const a = e.target.closest('[data-acao]'); if (!a) return;
      if (a.dataset.acao === 'addPonto') { $('#pontos', corpo).insertAdjacentHTML('beforeend', linhaPonto()); $$('#pontos input[name=ponto_nome]', corpo).pop().focus(); }
      if (a.dataset.acao === 'removerPonto') a.closest('.ponto-linha').remove();
    });
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const filial = { id: f.id, nome: form.nome.value, garagem: form.garagem.value,
        pontos: $$('.ponto-linha', form).map((l) => ({ nome: $('input[name=ponto_nome]', l).value, ativo: $('input[name=ponto_ativo]', l).checked })).filter((p) => p.nome.trim()),
        auditores: $$('input[name=auditores]:checked', form).map((i) => i.value), pontos_por_ciclo: Number(form.ppc.value), auditores_por_ciclo: Number(form.apc.value),
        ativo: form.ativo.value === 'SIM' };
      carregando('Salvando filial…');
      try { await api('salvarFilial', { filial }); carregando(); toast('Filial salva.', 'ok'); rota('filiais'); }
      catch (err) { carregando(); toast(err.message, 'erro'); }
    });
  }

  /* ---------- USUÁRIOS ---------- */
  VIEWS.usuarios = async function () {
    app.innerHTML = topo('usuarios') + `<main class="pagina"><div class="painel-cab"><div><h1>Usuários</h1>
      <p class="suave">Avaliadores marcados como “Sem acesso” ainda não podem entrar: defina uma senha e mude para Ativo.</p></div></div>
      <section class="usuarios-grid">
        <form id="fUsuario" class="bloco form-usuario"><h2 id="fuTitulo">Novo usuário</h2>
          <label>Usuário (login)<input name="login" required autocapitalize="none" placeholder="ex.: joao.silva"></label>
          <label>Nome completo<input name="nome" required></label>
          <label>Perfil<select name="perfil"><option value="COLABORADOR">Avaliador (preenche)</option><option value="QUALIDADE">Qualidade (vê resultados)</option></select></label>
          <label>Senha<input name="senha" type="password" autocomplete="new-password" placeholder="Mínimo 6 caracteres"></label>
          <label>Situação<select name="ativo"><option value="SIM">Ativo</option><option value="NAO">Sem acesso</option></select></label>
          <div class="acoes"><button type="button" class="btn sec" data-acao="limparUsuario">Limpar</button><button class="btn primario">Salvar usuário</button></div>
          <p class="suave">Ao editar, deixe a senha em branco para manter a atual.</p>
        </form>
        <div class="bloco"><div id="listaUsuarios">${carregandoHTML()}</div></div>
      </section></main>`;
    $('#fUsuario').addEventListener('submit', async (e) => {
      e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target));
      carregando('Salvando usuário…');
      try { await api('salvarUsuario', { usuario: fd }); carregando(); toast('Usuário salvo.', 'ok'); e.target.reset(); $('#fuTitulo').textContent = 'Novo usuário'; e.target.login.readOnly = false; carregarUsuarios(); }
      catch (err) { carregando(); toast(err.message, 'erro'); }
    });
    carregarUsuarios();
  };

  async function carregarUsuarios() {
    try {
      const d = await api('listarUsuarios'); state.usuarios = d.usuarios;
      $('#listaUsuarios').innerHTML = `<div class="rolagem"><table class="tab-lista"><thead><tr><th>Nome</th><th>Usuário</th><th>Perfil</th><th>Situação</th><th></th></tr></thead><tbody>
        ${d.usuarios.map((u) => `<tr><td>${esc(u.nome)}</td><td>${esc(u.login)}</td><td>${u.perfil === 'QUALIDADE' ? 'Qualidade' : 'Avaliador'}</td><td>${u.ativo === 'SIM' ? 'Ativo' : '<span class="badge st-CANCELADO">Sem acesso</span>'}</td>
          <td><button class="btn sec pequeno" data-editar-usuario="${esc(u.login)}">Editar</button></td></tr>`).join('')}</tbody></table></div>`;
    } catch (e) { $('#listaUsuarios').innerHTML = erroHTML(e.message); }
  }

  function modalSenha() {
    const corpo = modal(`<h2>Trocar senha</h2><form id="fSenha">
      <label>Senha atual<input type="password" name="senhaAtual" autocomplete="current-password" required></label>
      <label>Nova senha<input type="password" name="novaSenha" autocomplete="new-password" minlength="6" required></label>
      <label>Repita a nova senha<input type="password" name="conf" autocomplete="new-password" required></label>
      <div class="acoes"><button class="btn primario">Salvar nova senha</button></div><p class="erro-msg" id="senhaErro"></p></form>`);
    $('#fSenha', corpo).addEventListener('submit', async (e) => {
      e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target));
      if (fd.novaSenha !== fd.conf) { $('#senhaErro').textContent = 'As senhas novas não são iguais.'; return; }
      try { await api('trocarSenha', fd); fecharModal(); toast('Senha alterada.', 'ok'); } catch (err) { $('#senhaErro').textContent = err.message; }
    });
  }

  /* ---------- eventos globais ---------- */
  document.addEventListener('click', async (e) => {
    const t = e.target, el = (s) => t.closest(s);
    if (el('[data-rota]')) { rota(el('[data-rota]').dataset.rota); return; }
    if (el('[data-auditoria]')) { rota('auditoria', el('[data-auditoria]').dataset.auditoria); return; }
    if (el('[data-abrir]')) { abrirForm(state.rotaArg, el('[data-abrir]').dataset.abrir); return; }
    if (el('[data-detalhe]')) { abrirDetalhe(el('[data-detalhe]').dataset.detalhe); return; }
    if (el('[data-ampliar]')) { ampliarFoto(el('[data-ampliar]').dataset.ampliar); return; }
    if (el('[data-ver-filial]')) { state.filial = el('[data-ver-filial]').dataset.verFilial; rota('painel'); return; }
    if (el('[data-novo-crono]')) { const [fid, ano, c] = el('[data-novo-crono]').dataset.novoCrono.split('|'); editarCrono({ filial_id: fid, ano: Number(ano), ciclo: Number(c), pontos: [], auditores: [] }); return; }
    if (el('[data-editar-crono]')) { editarCrono(state.crono.entradas.find((x) => x.id === el('[data-editar-crono]').dataset.editarCrono)); return; }
    if (el('[data-editar-filial]')) { editarFilial(state.filiais.find((x) => x.id === el('[data-editar-filial]').dataset.editarFilial)); return; }
    if (el('[data-editar-usuario]')) {
      const u = state.usuarios.find((x) => x.login === el('[data-editar-usuario]').dataset.editarUsuario); const f = $('#fUsuario'); if (!u || !f) return;
      f.login.value = u.login; f.login.readOnly = true; f.nome.value = u.nome; f.perfil.value = u.perfil; f.ativo.value = u.ativo === 'SIM' ? 'SIM' : 'NAO'; f.senha.value = '';
      $('#fuTitulo').textContent = 'Editar ' + u.nome; f.scrollIntoView({ behavior: 'smooth' }); f.senha.focus(); return;
    }

    const acao = el('[data-acao]') && el('[data-acao]').dataset.acao;
    if (acao === 'sair') { try { await api('logout'); } catch (err) {} salvarSessao(null); rota('login'); return; }
    if (acao === 'senha') { modalSenha(); return; }
    if (acao === 'fecharModal') { fecharModal(); return; }
    if (acao === 'recarregar') { rota(state.rota, state.rotaArg); return; }
    if (acao === 'sugerir') { modalSugerir(); return; }
    if (acao === 'gerarPlanilha') { gerarPlanilha(); return; }
    if (acao === 'novaFilial') { editarFilial(null); return; }
    if (acao === 'limparUsuario') { const f = $('#fUsuario'); f.reset(); f.login.readOnly = false; $('#fuTitulo').textContent = 'Novo usuário'; return; }

    if (state.rota !== 'form' || !state.form) return;
    const f = state.form;
    if (acao === 'voltar') { salvarRascunho(); rota('auditoria', f.cronogramaId); return; }
    if (acao === 'enviar') { enviarChecklist(); return; }

    const tab = el('[data-coluna]');
    if (tab) { f.ativa = tab.dataset.coluna; renderAbas(); renderColuna(); $('#abasColunas').scrollIntoView({ behavior: 'smooth', block: 'start' }); salvarRascunho(); return; }
    const add = el('[data-add]');
    if (add) { const c = { id: uid(), grupo: add.dataset.add, nome: '' }; const ult = f.colunas.map((x) => x.grupo).lastIndexOf(c.grupo);
      f.colunas.splice(ult + 1, 0, c); f.respostas[c.id] = respostasIniciais(ckAtual()); f.ativa = c.id; renderAbas(); renderColuna(); atualizarProgresso(); salvarRascunho(); $('#fPrefixo') && $('#fPrefixo').focus(); return; }
    const rem = el('[data-remover]');
    if (rem) { if (!await confirmar('Remover veículo?', 'As respostas deste veículo serão apagadas.', 'Remover')) return;
      const id = rem.dataset.remover; const idx = f.colunas.findIndex((x) => x.id === id); f.colunas.splice(idx, 1); delete f.respostas[id];
      f.ativa = f.colunas[Math.max(0, idx - 1)].id; renderAbas(); renderColuna(); atualizarProgresso(); salvarRascunho(); return; }

    const item = el('.item'); if (!item) return;
    const r = f.respostas[item.dataset.col][item.dataset.key] || (f.respostas[item.dataset.col][item.dataset.key] = {});
    const notaBtn = el('[data-nota]');
    if (notaBtn) { r.nota = notaBtn.dataset.nota; atualizarItem(item.dataset.col, item.dataset.key); renderAbas(); atualizarProgresso(); salvarRascunho(); return; }
    if (acao === 'tirarFoto') { delete r.foto; atualizarItem(item.dataset.col, item.dataset.key); renderAbas(); salvarRascunho(); }
  });

  document.addEventListener('input', (e) => {
    const t = e.target;
    if (state.rota !== 'form' || !state.form) return;
    const f = state.form;
    if (t.id === 'fObs') { f.obs = t.value; salvarRascunho(); return; }
    if (t.id === 'fPrefixo') { colAtiva().nome = t.value.toUpperCase(); renderAbas(); salvarRascunho(); return; }
    const item = t.closest('.item'); if (!item || !t.dataset.campo || t.dataset.campo === 'foto') return;
    f.respostas[item.dataset.col][item.dataset.key][t.dataset.campo] = t.value;
    item.classList.remove('erro'); salvarRascunho();
  });

  document.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.id === 'selSem') { state.semestre = t.value; rota(state.rota); return; }
    if (t.id === 'selFilial') { state.filial = t.value; rota(state.rota); return; }
    if (t.id === 'selAno') { state.anoCrono = Number(t.value); renderCronograma(); return; }
    if (state.rota !== 'form' || !state.form) return;
    if (t.id === 'fData') { state.form.dataInspecao = t.value; salvarRascunho(); return; }
    if (t.dataset.campo === 'foto' && t.files && t.files[0]) {
      const item = t.closest('.item'); const r = state.form.respostas[item.dataset.col][item.dataset.key];
      try { carregando('Preparando foto…'); r.foto = await comprimirFoto(t.files[0]); carregando(); atualizarItem(item.dataset.col, item.dataset.key); renderAbas(); salvarRascunho(); }
      catch (err) { carregando(); toast(err.message, 'erro'); }
    }
  });

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const fc = $('.foto-cheia'); if (fc) fc.remove(); else fecharModal(); } });

  rota(state.sessao ? (ehQualidade() ? 'painel' : 'inicio') : 'login');
})();
