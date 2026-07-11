/* ════════════════════════════════════════════════════════════════════════
   comentarios.js — Feedback/comentarios en la documentación.

   Se inyecta en cada página vía nginx sub_filter (no se edita ningún HTML).
   · doc_slug     = nombre del archivo (sin .html), leído de la URL.
   · section_anchor = slug del texto del <h2> (estable ante regeneraciones).
   Auth por la cookie de sesión compartida; las escrituras mandan X-CSRFToken
   (token pedido a /auth/csrf), ya que no hay JWT en la documentación.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const API = 'https://api.importacionleon.com/api/v1';
  const BODY_MAX = 2000;

  const state = {
    docSlug: null,
    me: { id: null, es_admin: false },
    csrf: null,
    byAnchor: {},      // anchor -> { total, comentarios }
    page: { total: 0, comentarios: [] },
    titles: {},        // anchor -> texto del heading
    openAnchor: undefined,  // anchor del panel abierto (null = página, undefined = cerrado)
  };

  const ICON = {
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.9-.9L3 21l1.9-5.6A8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v11"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L11 3.24"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 14V3"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L13 20.76"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  };

  // ── DOM helper ──────────────────────────────────────────────────────
  function el(tag, props) {
    const n = document.createElement(tag);
    if (props) for (const k in props) {
      const v = props[k];
      if (v == null) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;      // solo iconos estáticos de confianza
      else if (k === 'dataset') Object.assign(n.dataset, v);
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
      else n.setAttribute(k, v);
    }
    for (let i = 2; i < arguments.length; i++) {
      let kids = arguments[i];
      if (!Array.isArray(kids)) kids = [kids];
      kids.forEach(k => { if (k == null || k === false) return; n.appendChild(typeof k === 'string' ? document.createTextNode(k) : k); });
    }
    return n;
  }

  // ── utilidades ──────────────────────────────────────────────────────
  function slugify(s) {
    return String(s || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // quita acentos
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function docSlugFromURL() {
    let p = location.pathname.replace(/\/+$/, '');       // sin barra final
    let base = p.split('/').pop() || 'index';
    base = base.replace(/\.html?$/i, '');
    return slugify(base) || 'index';
  }

  function initials(nombre) {
    const parts = String(nombre || '?').trim().split(/\s+/);
    return ((parts[0] || '?')[0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }

  function fmtFecha(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const f = d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
    const h = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    return `${f} · ${h}`;
  }

  let toastT;
  function toast(msg, tipo) {
    let t = document.querySelector('.dc-toast');
    if (!t) { t = el('div', { class: 'dc-toast' }); document.body.appendChild(t); }
    t.className = 'dc-toast' + (tipo ? ' ' + tipo : '');
    t.textContent = msg;
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), 3200);
  }

  // ── API ─────────────────────────────────────────────────────────────
  async function ensureCsrf() {
    if (state.csrf) return;
    const r = await fetch(API + '/auth/csrf', { credentials: 'include' });
    if (r.ok) state.csrf = (await r.json()).csrftoken;
  }

  function primerError(b) {
    if (!b || typeof b !== 'object') return null;
    if (b.detail) return b.detail;
    for (const k in b) { const v = b[k]; if (Array.isArray(v) && v.length) return v[0]; if (typeof v === 'string') return v; }
    return null;
  }

  async function api(path, opts) {
    opts = Object.assign({ credentials: 'include', headers: {} }, opts || {});
    const method = (opts.method || 'GET').toUpperCase();
    if (method !== 'GET') {
      await ensureCsrf();
      opts.headers['X-CSRFToken'] = state.csrf || '';
      if (opts.body && !opts.headers['Content-Type']) opts.headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(API + '/' + path.replace(/^\//, ''), opts);
    if (res.status === 401) { const e = new Error('Tu sesión expiró. Recarga la página para volver a entrar.'); e.status = 401; throw e; }
    if (!res.ok) {
      let b = null; try { b = await res.json(); } catch (_) {}
      const e = new Error(primerError(b) || ('Error ' + res.status)); e.status = res.status; e.body = b; throw e;
    }
    if (res.status === 204) return null;
    return res.json();
  }

  // ── anclaje: asigna id/slug a cada heading y le cuelga el botón ──────
  function anotarHeadings() {
    const wrap = document.querySelector('.wrap') || document.body;
    const usados = {};
    wrap.querySelectorAll('h2').forEach(h => {
      if (h.closest('.dc-page-block')) return;
      let base = slugify(h.textContent);
      if (!base) return;
      let slug = base, i = 2;
      while (usados[slug]) { slug = base + '-' + i; i++; }
      usados[slug] = true;
      if (!h.id) h.id = slug;
      const anchor = h.id;
      state.titles[anchor] = h.textContent.trim();

      const btn = el('button', {
        type: 'button', class: 'dc-hbtn', 'aria-label': 'Comentarios de esta sección',
        dataset: { dcAnchor: anchor },
        onclick: (e) => { e.preventDefault(); openPanel(anchor); },
        html: ICON.chat,
      });
      btn.appendChild(el('span', { class: 'dc-count' }));
      h.appendChild(btn);
    });
  }

  function actualizarContadores() {
    document.querySelectorAll('.dc-hbtn[data-dc-anchor]').forEach(btn => {
      const anchor = btn.dataset.dcAnchor;
      const total = (state.byAnchor[anchor] && state.byAnchor[anchor].total) || 0;
      const span = btn.querySelector('.dc-count');
      if (total > 0) { btn.classList.add('has-count'); span.textContent = total; }
      else { btn.classList.remove('has-count'); span.textContent = ''; }
    });
  }

  // ── carga de datos ──────────────────────────────────────────────────
  async function cargar() {
    const data = await api('docs/' + state.docSlug + '/comments/');
    state.me = data.usuario || state.me;
    state.byAnchor = {};
    (data.secciones || []).forEach(s => { state.byAnchor[s.anchor] = s; });
    state.page = data.pagina || { total: 0, comentarios: [] };
    actualizarContadores();
    renderPageBlock();
  }

  // ── render de un comentario ─────────────────────────────────────────
  function reaccionBtn(c, valor) {
    const on = c.mi_reaccion === valor;
    const cls = 'dc-react' + (on ? (valor === 'like' ? ' on-like' : ' on-dislike') : '');
    const btn = el('button', {
      type: 'button', class: cls, html: valor === 'like' ? ICON.up : ICON.down,
    });
    btn.appendChild(el('span', { text: String(valor === 'like' ? c.likes : c.dislikes) }));
    btn.addEventListener('click', () => reaccionar(c, valor, btn.closest('.dc-c')));
    return btn;
  }

  function comentarioCard(c, esReplyDe) {
    const raiz = !esReplyDe;
    const card = el('div', { class: 'dc-c', dataset: { dcId: c.id } });
    const atenuado = raiz && (c.status === 'resuelto' || c.status === 'descartado');
    if (atenuado) card.classList.add('dc-dim');

    // Cabecera: autor, fecha, estado
    const head = el('div', { class: 'dc-c-top' },
      el('span', { class: 'dc-avatar', text: initials(c.autor && c.autor.nombre) }),
      el('div', { class: 'dc-who' },
        el('div', { class: 'dc-name', text: (c.autor && c.autor.nombre) || 'Anónimo' }),
        el('div', { class: 'dc-date', text: fmtFecha(c.created_at) + (c.updated_at && c.updated_at !== c.created_at ? ' · editado' : '') }),
      ),
    );
    if (raiz) head.appendChild(el('span', { class: 'dc-status ' + c.status, text: estadoTexto(c.status) }));
    card.appendChild(head);

    const body = el('div', { class: 'dc-body', text: c.body });
    card.appendChild(body);

    // Comentarios atenuados: se muestran colapsados con un botón para abrir.
    if (atenuado) {
      const toggle = el('button', {
        class: 'dc-collapse', text: 'Ver comentario ' + estadoTexto(c.status).toLowerCase(),
        onclick: () => {
          card.classList.toggle('dc-open');
          toggle.textContent = card.classList.contains('dc-open') ? 'Ocultar' : ('Ver comentario ' + estadoTexto(c.status).toLowerCase());
        },
      });
      card.insertBefore(toggle, body);
    }

    // Acciones
    const acc = el('div', { class: 'dc-actions' }, reaccionBtn(c, 'like'), reaccionBtn(c, 'dislike'));
    if (raiz) acc.appendChild(el('button', { class: 'dc-link', text: 'Responder', onclick: () => toggleReplyForm(card, c) }));
    if (c.puede_editar) acc.appendChild(el('button', { class: 'dc-link', text: 'Editar', onclick: () => editarForm(card, c) }));
    if (c.puede_borrar) acc.appendChild(el('button', { class: 'dc-link danger', text: 'Borrar', onclick: () => borrar(c) }));
    if (raiz && state.me.es_admin) acc.appendChild(selectEstado(c));
    card.appendChild(acc);

    // Respuestas (solo en raíces)
    if (raiz) {
      const reps = el('div', { class: 'dc-replies', dataset: { dcReplies: c.id } });
      (c.respuestas || []).forEach(r => reps.appendChild(comentarioCard(r, c)));
      if (!(c.respuestas || []).length) reps.style.display = 'none';
      card.appendChild(reps);
    }
    return card;
  }

  function estadoTexto(s) {
    return { abierto: 'Abierto', en_revision: 'En revisión', resuelto: 'Resuelto', descartado: 'Descartado' }[s] || s;
  }

  function selectEstado(c) {
    const sel = el('select', { class: 'dc-select', 'aria-label': 'Cambiar estado' });
    ['abierto', 'en_revision', 'resuelto', 'descartado'].forEach(v => {
      const o = el('option', { value: v, text: estadoTexto(v) });
      if (v === c.status) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', () => cambiarEstado(c, sel.value));
    return sel;
  }

  // ── formularios ─────────────────────────────────────────────────────
  function formCuerpo({ initial, onEnviar, enviarLabel, onCancelar }) {
    const ta = el('textarea', { maxlength: BODY_MAX, placeholder: 'Escribe tu comentario…' });
    if (initial) ta.value = initial;
    const contador = el('span', { class: 'dc-count-chars' });
    const enviar = el('button', { class: 'dc-btn', type: 'button', text: enviarLabel || 'Comentar' });
    const refrescar = () => {
      const n = ta.value.trim().length;
      contador.textContent = n + ' / ' + BODY_MAX;
      contador.classList.toggle('over', n > BODY_MAX);
      enviar.disabled = n === 0 || n > BODY_MAX;
    };
    ta.addEventListener('input', refrescar);
    enviar.addEventListener('click', async () => {
      enviar.disabled = true;
      try { await onEnviar(ta.value.trim()); }
      catch (e) { enviar.disabled = false; toast(e.message, 'warn'); }
    });
    const row = el('div', { class: 'dc-form-row' }, contador, onCancelar ? el('button', { class: 'dc-btn ghost', type: 'button', text: 'Cancelar', onclick: onCancelar }) : null, enviar);
    const form = el('div', { class: 'dc-form' }, ta, row);
    refrescar();
    setTimeout(() => ta.focus(), 30);
    return form;
  }

  function toggleReplyForm(card, c) {
    const existente = card.querySelector(':scope > .dc-reply-form');
    if (existente) { existente.remove(); return; }
    const form = formCuerpo({
      enviarLabel: 'Responder',
      onCancelar: () => form.remove(),
      onEnviar: async (texto) => {
        await api('docs/' + state.docSlug + '/comments/', { method: 'POST', body: JSON.stringify({ body: texto, parent: c.id }) });
        await recargarPanel();
      },
    });
    form.classList.add('dc-reply-form');
    const reps = card.querySelector('[data-dc-replies]');
    card.insertBefore(form, reps);
  }

  function editarForm(card, c) {
    const body = card.querySelector(':scope > .dc-body');
    if (!body || card.querySelector(':scope > .dc-edit-form')) return;
    body.style.display = 'none';
    const form = formCuerpo({
      initial: c.body, enviarLabel: 'Guardar',
      onCancelar: () => { form.remove(); body.style.display = ''; },
      onEnviar: async (texto) => {
        await api('comments/' + c.id + '/', { method: 'PATCH', body: JSON.stringify({ body: texto }) });
        await recargarPanel();
      },
    });
    form.classList.add('dc-edit-form');
    card.insertBefore(form, body.nextSibling);
  }

  // ── acciones ────────────────────────────────────────────────────────
  async function reaccionar(c, valor, card) {
    try {
      const r = await api('comments/' + c.id + '/react/', { method: 'POST', body: JSON.stringify({ value: valor }) });
      c.likes = r.likes; c.dislikes = r.dislikes; c.mi_reaccion = r.mi_reaccion;
      // Repinta solo los botones de reacción de esa tarjeta (sin recargar todo).
      const acc = card.querySelector(':scope > .dc-actions');
      const nuevos = [reaccionBtn(c, 'like'), reaccionBtn(c, 'dislike')];
      acc.replaceChild(nuevos[0], acc.children[0]);
      acc.replaceChild(nuevos[1], acc.children[1]);
      // Los conteos por sección no cambian con reacciones; no hace falta recargar.
    } catch (e) { toast(e.message, 'warn'); }
  }

  async function cambiarEstado(c, nuevo) {
    try {
      await api('comments/' + c.id + '/status/', { method: 'PATCH', body: JSON.stringify({ status: nuevo }) });
      await recargarPanel();
    } catch (e) { toast(e.message, 'warn'); }
  }

  async function borrar(c) {
    if (!confirm('¿Borrar este comentario? No se puede deshacer.')) return;
    try {
      await api('comments/' + c.id + '/', { method: 'DELETE' });
      toast('Comentario borrado.');
      await cargar();          // refresca contadores por sección
      await recargarPanel();
    } catch (e) { toast(e.message, 'warn'); }
  }

  // ── panel (drawer / bottom-sheet) ───────────────────────────────────
  let overlay, panel, panelEyebrow, panelTitle, panelBody;
  function construirPanel() {
    overlay = el('div', { class: 'dc-overlay', onclick: cerrarPanel });
    panelEyebrow = el('p', { class: 'dc-eyebrow', text: 'Comentarios' });
    panelTitle = el('h3');
    panelBody = el('div', { class: 'dc-panel-body' });
    panel = el('div', { class: 'dc-panel', role: 'dialog', 'aria-modal': 'true' },
      el('div', { class: 'dc-panel-head' },
        el('span', { class: 'dc-panel-grip' }),
        el('div', {}, panelEyebrow, panelTitle),
        el('button', { class: 'dc-x', 'aria-label': 'Cerrar', html: ICON.x, onclick: cerrarPanel }),
      ),
      panelBody,
    );
    document.body.appendChild(overlay);
    document.body.appendChild(panel);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && state.openAnchor !== undefined) cerrarPanel(); });
  }

  function threadInto(container, roots, anchor) {
    container.textContent = '';
    if (!roots.length) container.appendChild(el('div', { class: 'dc-empty', text: 'Aún no hay comentarios en esta sección. Sé el primero.' }));
    roots.forEach(c => container.appendChild(comentarioCard(c, null)));
    // Formulario para un comentario nuevo en esta sección/página.
    const form = formCuerpo({
      enviarLabel: 'Comentar',
      onEnviar: async (texto) => {
        const payload = { body: texto };
        if (anchor) payload.section_anchor = anchor;
        await api('docs/' + state.docSlug + '/comments/', { method: 'POST', body: JSON.stringify(payload) });
        toast('Comentario publicado.');
        await cargar();
        await recargarPanel();
      },
    });
    const wrap = el('div', { class: 'dc-section-form' }, el('h4', { text: 'Añadir comentario' }), form);
    container.appendChild(wrap);
  }

  function openPanel(anchor) {
    state.openAnchor = anchor;
    panelTitle.textContent = state.titles[anchor] || 'Comentarios';
    panelEyebrow.textContent = 'Sección';
    const grupo = state.byAnchor[anchor];
    threadInto(panelBody, (grupo && grupo.comentarios) || [], anchor);
    overlay.classList.add('open');
    panel.classList.add('open');
    panelBody.scrollTop = 0;
  }

  function cerrarPanel() {
    state.openAnchor = undefined;
    overlay.classList.remove('open');
    panel.classList.remove('open');
  }

  async function recargarPanel() {
    await cargar();
    if (state.openAnchor === undefined) return;
    if (state.openAnchor === null) return;   // el bloque de página se repinta en cargar()
    openPanel(state.openAnchor);
  }

  // ── bloque de comentarios a nivel de página (al final del doc) ───────
  let pageBlock, pageThread;
  function renderPageBlock() {
    const wrap = document.querySelector('.wrap') || document.body;
    if (!pageBlock) {
      pageThread = el('div', { class: 'dc-page-thread' });
      pageBlock = el('div', { class: 'dc-page-block' },
        el('h2', { text: 'Comentarios sobre esta página' }),
        pageThread,
      );
      wrap.appendChild(pageBlock);
    }
    threadInto(pageThread, state.page.comentarios || [], null);
  }

  // ── init ────────────────────────────────────────────────────────────
  async function init() {
    state.docSlug = docSlugFromURL();
    anotarHeadings();
    construirPanel();
    try {
      await cargar();
    } catch (e) {
      // Documentación es de solo-lectura útil aunque la API falle: no romper.
      if (e.status === 401) return;   // sesión caída; el gate de nginx ya redirige normalmente
      console.error('[comentarios]', e);
      return;
    }
    // Enlace directo desde la gestión: ?dc=<anchor> abre esa sección.
    const abrir = new URLSearchParams(location.search).get('dc');
    if (abrir && (state.byAnchor[abrir] || state.titles[abrir])) {
      setTimeout(() => openPanel(abrir), 120);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
