/* ════════════════════════════════════════════════════════════════════════
   docs-nav.js — Navbar global + toggle de tema + buscador de la documentación.
   Se inyecta en cada página vía nginx sub_filter (no se edita ningún HTML).

   FUENTE ÚNICA: el array SITEMAP de abajo. Añadir/mover una página = tocar
   solo aquí; el navbar, el menú móvil y el buscador se generan de él.

   Tema: misma clave y comportamiento que la intranet ('intranet_leon_tema',
   valores claro/oscuro, atributo data-theme en <html>). El anti-FOUC lo aplica
   un script inline en <head> (inyectado también por nginx) ANTES del paint;
   aquí solo sincronizamos el icono y enganchamos el toggle. prefers-color-scheme
   es el default si el usuario nunca eligió (no se escribe hasta que hace clic).
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── Fuente única de la navegación (derivada de index.html) ──────────
  var SITEMAP = [
    { id: 'introduccion', label: 'Introducción', color: 'teal', items: [
      { t: 'Qué es y cómo se accede', u: 'introduccion.html', d: 'Acceso, roles, tema claro/oscuro y tour de la interfaz.' },
      { t: 'Glosario', u: 'glosario.html', d: 'SKU, movimiento, stock derivado, pedido, comprobante…' },
    ]},
    { id: 'it', label: 'IT / Sistemas', color: 'indigo', groups: [
      { g: 'Arquitectura y componentes', items: [
        { t: 'Arquitectura del ERP', u: 'arquitectura.html', d: 'Diagrama vivo: interfaces, motor, 3 bases y workers.' },
        { t: 'El motor (backend)', u: 'el-motor.html', d: 'Qué es y su stack real (Django 5.2 + DRF).' },
        { t: 'Base principal', u: 'base-principal.html', d: 'PostgreSQL: la fuente de verdad. 3 bases sin FK entre ellas.' },
        { t: 'Memoria rápida (Redis)', u: 'memoria-rapida.html', d: 'Solo cola de Celery hoy; sin carrito ni sesiones.' },
        { t: 'Almacenamiento de fotos', u: 'almacenamiento.html', d: 'Pillow, conversión a WebP, miniatura/media/original.' },
        { t: 'Búsqueda', u: 'buscador.html', d: 'pg_trgm, integrada en Postgres. No es un servicio aparte.' },
        { t: 'Tareas automáticas (Celery)', u: 'tareas-automaticas.html', d: 'Las 2 tareas reales de hoy; sin periódicas.' },
        { t: 'Servicios externos', u: 'servicios-externos.html', d: 'Qué está conectado y qué es un stub (SUNAT).' },
        { t: 'Tienda pública (Frontend)', u: 'catalogo-publico.html', d: 'Sitio Astro de catálogo + WhatsApp. Sin carrito.' },
      ]},
      { g: 'Modelo de datos', items: [
        { t: 'Esquema de datos', u: 'bases-de-datos.html', d: 'El modelo canónico, tabla por tabla y campo por campo.' },
        { t: 'Cómo se deriva el stock', u: 'stock-derivado.html', d: 'Nunca se guarda, siempre se calcula: el porqué y el cómo.' },
        { t: 'Relaciones entre tablas', u: 'connect-tables-db.html', d: 'Esquema inicial (histórico · v1), ya superado.' },
      ]},
      { g: 'API y seguridad', items: [
        { t: 'API del backend', u: 'backend-api.html', d: 'El contrato REST completo, endpoint por endpoint.' },
        { t: 'Roles y permisos', u: 'permisos-roles.html', d: 'Matriz de qué puede escribir cada rol.' },
        { t: 'Registro de actividad', u: 'auditoria-actividad.html', d: 'Cómo se audita quién hizo qué.' },
      ]},
      { g: 'Operación', items: [
        { t: 'Despliegue y mantenimiento', u: 'operacion.html', d: 'Arrancar servicios, logs, backup, comandos frecuentes.' },
        { t: 'Ruta de desarrollo', u: 'ruta-desarrollo.html', d: 'Qué se hizo, qué está en curso y qué está planeado.' },
      ]},
    ]},
    { id: 'funcional', label: 'Funcional', color: 'blue', items: [
      { t: 'Ventas', u: 'funcional-ventas.html', d: 'Catálogo, clientes, pedidos, comprobantes.' },
      { t: 'Importación / Compras', u: 'funcional-compras.html', d: 'Proveedores, órdenes de compra, embarques, recepción.' },
      { t: 'Almacén / Inventario', u: 'funcional-almacen.html', d: 'Movimientos, stock derivado, reponer, rotación.' },
      { t: 'Administración', u: 'funcional-administracion.html', d: 'Facturación, equipo y usuarios, actividad.' },
      { t: 'Reportes y analítica', u: 'reportes-analitica.html', d: 'Ventas, inventario, compras y rentabilidad.' },
    ]},
    { id: 'guias', label: 'Guías', color: 'amber', items: [
      { t: 'Registrar una venta y emitir el comprobante', u: 'guia-registrar-venta.html', d: 'Crear el pedido, cobrar, emitir boleta o factura y entregar.' },
      { t: 'Dar de alta un producto', u: 'guia-dar-alta-producto.html', d: 'Producto, variantes (SKU), volumen, fotos y publicarlo.' },
      { t: 'Recibir mercancía de una importación', u: 'guia-recibir-mercancia.html', d: 'Localizar la OC, registrar la recepción y comprobar stock y costo.' },
    ]},
    { id: 'flujos', label: 'Flujos', color: 'rose', items: [
      { t: 'Mapa de flujos', u: 'flujos.html', d: 'Visión de conjunto: venta, abastecimiento y post-venta.' },
      { t: '1 · Compra desde la web', u: 'flujo-venta-web.html', d: 'Del catálogo público a la entrega.' },
      { t: '2 · Tienda y pago en efectivo', u: 'flujo-venta-tienda.html', d: 'Venta presencial: pedido, cobro, boleta y entrega.' },
      { t: '3 · Pedido con reserva', u: 'flujo-pedido-reserva.html', d: 'Objetivo: reserva de stock, expiración, precio en vivo.' },
      { t: '4 · Crear un producto', u: 'flujo-crear-producto.html', d: 'Producto, variantes (SKU), volumen y fotos.' },
      { t: '5 · Compra importación', u: 'flujo-compra-importacion.html', d: 'De la orden en China al stock, con costo landed.' },
      { t: '6 · Ciclo de vida del pedido', u: 'flujo-ciclo-pedido.html', d: 'Pendiente → Pagado → Enviado → Entregado.' },
      { t: '7 · Reclamación web', u: 'flujo-reclamacion.html', d: 'Objetivo: libro de reclamaciones en línea.' },
    ]},
    { id: 'legal', label: 'Legal', color: 'slate', items: [
      { t: 'Aviso legal', u: 'legal-aviso.html', d: 'Titular y condiciones generales de uso.' },
      { t: 'Términos y condiciones', u: 'legal-terminos.html', d: 'Precios, comprobantes, pagos, envíos, devoluciones.' },
      { t: 'Política de privacidad', u: 'legal-privacidad.html', d: 'Datos personales conforme a la Ley N° 29733.' },
      { t: 'Política de cookies', u: 'legal-cookies.html', d: 'Qué cookies usa el sitio y cómo gestionarlas.' },
      { t: 'Libro de reclamaciones', u: 'legal-libro-reclamaciones.html', d: 'Registro exigido por Indecopi (Ley N° 29571).' },
    ]},
  ];

  var TEMA_KEY = 'intranet_leon_tema';

  var ICON = {
    chev: '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    burger: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    sol: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.4M12 19.6V22M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2 12h2.4M19.6 12H22M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7"/></svg>',
    luna: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>',
  };

  // ── helpers ─────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) { if (attrs[k] != null) n.setAttribute(k, attrs[k]); }
    if (html != null) n.innerHTML = html;
    return n;
  }
  function currentFile() {
    var p = location.pathname.replace(/\/+$/, '');
    var f = p.split('/').pop() || 'index.html';
    if (f === '') f = 'index.html';
    if (!/\.html?$/i.test(f)) f += '.html';
    return f.toLowerCase();
  }
  var CUR = currentFile();

  function styleFor(color) { return '--c:var(--' + color + ');--c-tint:var(--' + color + '-tint)'; }
  function isActive(sec) {
    if (sec.items) return sec.items.some(function (i) { return i.u === CUR; });
    return sec.groups.some(function (g) { return g.items.some(function (i) { return i.u === CUR; }); });
  }
  function linkHTML(it, cls) {
    var cur = it.u === CUR ? ' aria-current="page"' : '';
    return '<a class="' + cls + '" href="' + esc(it.u) + '"' + cur + '>' +
      '<span class="lk-t">' + esc(it.t) + '</span>' +
      (it.d ? '<span class="lk-d">' + esc(it.d) + '</span>' : '') + '</a>';
  }

  // ── navbar (desktop) ────────────────────────────────────────────────
  function topItem(sec, idx) {
    var li = el('li', { class: 'docnav-item' + (isActive(sec) ? ' active' : ''), style: styleFor(sec.color) });
    var dropId = 'docdrop-' + sec.id;
    var btn = el('button', {
      class: 'docnav-top', type: 'button', 'aria-expanded': 'false',
      'aria-haspopup': 'true', 'aria-controls': dropId,
    }, esc(sec.label) + ICON.chev);
    // Las 2 últimas secciones abren hacia la izquierda para no salirse.
    var alignRight = idx >= SITEMAP.length - 2 ? ' right' : '';
    var drop = el('div', { class: 'docnav-drop' + alignRight, id: dropId });
    var inner = '';
    if (sec.groups) {
      sec.groups.forEach(function (g) {
        inner += '<div class="docnav-group"><span class="docnav-grouph">' + esc(g.g) + '</span>' +
          g.items.map(function (it) { return linkHTML(it, 'docnav-link'); }).join('') + '</div>';
      });
    } else {
      inner = sec.items.map(function (it) { return linkHTML(it, 'docnav-link'); }).join('');
    }
    drop.innerHTML = inner;
    li.appendChild(btn);
    li.appendChild(drop);
    return li;
  }

  function searchBox() {
    var box = el('div', { class: 'docsearch' });
    box.innerHTML = '<input class="docsearch-input" type="search" placeholder="Buscar en la documentación…" ' +
      'aria-label="Buscar en la documentación" autocomplete="off"><div class="docsearch-results" role="listbox"></div>';
    return box;
  }

  // ── menú móvil (acordeones) ─────────────────────────────────────────
  function accordion(sec) {
    var acc = el('div', { class: 'docacc' + (isActive(sec) ? ' open' : ''), style: styleFor(sec.color) });
    var bodyId = 'docacc-' + sec.id;
    var head = el('button', { class: 'docacc-h', type: 'button', 'aria-expanded': String(isActive(sec)), 'aria-controls': bodyId },
      '<span>' + esc(sec.label) + '</span>' + ICON.chev);
    var body = el('div', { class: 'docacc-body', id: bodyId });
    if (sec.groups) {
      body.innerHTML = sec.groups.map(function (g) {
        return '<span class="docacc-grouph">' + esc(g.g) + '</span>' +
          g.items.map(function (it) { return linkHTML(it, 'docacc-link'); }).join('');
      }).join('');
    } else {
      body.innerHTML = sec.items.map(function (it) { return linkHTML(it, 'docacc-link'); }).join('');
    }
    acc.appendChild(head);
    acc.appendChild(body);
    return acc;
  }

  // ── construcción ────────────────────────────────────────────────────
  function build() {
    var header = el('header', { class: 'docnav', role: 'banner' });
    var inner = el('div', { class: 'docnav-inner' });

    var brand = el('a', { class: 'docnav-brand', href: 'index.html', 'aria-label': 'Importadora León · Docs — inicio' },
      '<span class="docnav-logo">IL</span><span class="docnav-brand-tx">Importadora León<span class="docnav-brand-sub"> · Docs</span></span>');
    inner.appendChild(brand);

    var menu = el('nav', { class: 'docnav-menu', 'aria-label': 'Secciones de la documentación' });
    var list = el('ul', { class: 'docnav-list' });
    SITEMAP.forEach(function (sec, i) { list.appendChild(topItem(sec, i)); });
    menu.appendChild(list);
    inner.appendChild(menu);

    var actions = el('div', { class: 'docnav-actions' });
    actions.appendChild(searchBox());
    var theme = el('button', { class: 'docnav-theme', id: 'btnTemaDocs', type: 'button' });
    actions.appendChild(theme);
    var burger = el('button', { class: 'docnav-burger', type: 'button', 'aria-label': 'Abrir menú', 'aria-expanded': 'false', 'aria-controls': 'docnavMobile' }, ICON.burger);
    actions.appendChild(burger);
    inner.appendChild(actions);
    header.appendChild(inner);

    var mobile = el('div', { class: 'docnav-mobile', id: 'docnavMobile', hidden: 'hidden' });
    mobile.appendChild(searchBox());
    SITEMAP.forEach(function (sec) { mobile.appendChild(accordion(sec)); });
    header.appendChild(mobile);

    document.body.insertBefore(header, document.body.firstChild);
    wireDropdowns(header);
    wireMobile(burger, mobile);
    wireTheme();
    wireSearch(header);
  }

  // ── dropdowns (accesibles) ──────────────────────────────────────────
  function closeAll(except) {
    document.querySelectorAll('.docnav-item.open').forEach(function (li) {
      if (li === except) return;
      li.classList.remove('open');
      var b = li.querySelector('.docnav-top');
      if (b) b.setAttribute('aria-expanded', 'false');
    });
  }
  function wireDropdowns(header) {
    header.querySelectorAll('.docnav-item').forEach(function (li) {
      var btn = li.querySelector('.docnav-top');
      var drop = li.querySelector('.docnav-drop');
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = li.classList.toggle('open');
        btn.setAttribute('aria-expanded', String(open));
        closeAll(li);
        if (open) { var f = drop.querySelector('a'); }
      });
      btn.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          li.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); closeAll(li);
          var first = drop.querySelector('a'); if (first) first.focus();
        } else if (e.key === 'Escape') { li.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
      });
      // Mantener aria-expanded coherente con el foco (abre por :focus-within en CSS).
      li.addEventListener('focusin', function () { btn.setAttribute('aria-expanded', 'true'); });
      li.addEventListener('focusout', function () {
        setTimeout(function () { if (!li.contains(document.activeElement)) { li.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); } }, 0);
      });
      drop.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { li.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
      });
    });
    document.addEventListener('click', function () { closeAll(null); });
  }

  // ── menú móvil + acordeones ─────────────────────────────────────────
  function wireMobile(burger, mobile) {
    function setOpen(open) {
      mobile.hidden = !open;
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      burger.innerHTML = open ? ICON.close : ICON.burger;
      document.body.classList.toggle('docnav-locked', open);
    }
    burger.addEventListener('click', function (e) { e.stopPropagation(); setOpen(mobile.hidden); });
    mobile.querySelectorAll('.docacc-h').forEach(function (h) {
      h.addEventListener('click', function () {
        var acc = h.parentNode;
        var open = acc.classList.toggle('open');
        h.setAttribute('aria-expanded', String(open));
      });
    });
    // Cerrar el panel al navegar o con Escape; reabrir estado limpio en desktop.
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !mobile.hidden) { setOpen(false); burger.focus(); } });
    window.addEventListener('resize', function () { if (window.innerWidth > 900 && !mobile.hidden) setOpen(false); });
  }

  // ── tema ────────────────────────────────────────────────────────────
  function tema() { return document.documentElement.dataset.theme === 'oscuro' ? 'oscuro' : 'claro'; }
  function syncBtn(t) {
    document.querySelectorAll('.docnav-theme').forEach(function (b) {
      var dark = t === 'oscuro';
      b.innerHTML = dark ? ICON.sol : ICON.luna;
      b.setAttribute('aria-pressed', String(dark));
      b.setAttribute('aria-label', dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
    });
  }
  function setTema(t) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem(TEMA_KEY, t); } catch (e) {}
    syncBtn(t);
  }
  function wireTheme() {
    syncBtn(tema());  // solo icono/aria; NO escribe (respeta prefers hasta que elija)
    document.querySelectorAll('.docnav-theme').forEach(function (b) {
      b.addEventListener('click', function () { setTema(tema() === 'oscuro' ? 'claro' : 'oscuro'); });
    });
    // Si nunca eligió, sigue en vivo el cambio del sistema.
    try {
      var mq = matchMedia('(prefers-color-scheme: dark)');
      var onChange = function (e) {
        var stored; try { stored = localStorage.getItem(TEMA_KEY); } catch (_) {}
        if (!stored) { var t = e.matches ? 'oscuro' : 'claro'; document.documentElement.dataset.theme = t; syncBtn(t); }
      };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    } catch (_) {}
  }

  // ── buscador (client-side sobre el SITEMAP) ─────────────────────────
  var FLAT = [];
  SITEMAP.forEach(function (sec) {
    var add = function (it) { FLAT.push({ t: it.t, d: it.d || '', u: it.u, sec: sec.label, color: sec.color }); };
    if (sec.groups) sec.groups.forEach(function (g) { g.items.forEach(add); });
    else sec.items.forEach(add);
  });
  function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function buscar(q) {
    q = norm(q.trim());
    if (!q) return [];
    return FLAT.filter(function (x) {
      return norm(x.t).indexOf(q) >= 0 || norm(x.d).indexOf(q) >= 0 || norm(x.u).indexOf(q) >= 0 || norm(x.sec).indexOf(q) >= 0;
    }).slice(0, 12);
  }
  function wireSearch(header) {
    header.querySelectorAll('.docsearch').forEach(function (box) {
      var input = box.querySelector('.docsearch-input');
      var out = box.querySelector('.docsearch-results');
      var sel = -1, hits = [];
      function render() {
        hits = buscar(input.value); sel = -1;
        if (!input.value.trim()) { out.classList.remove('open'); out.innerHTML = ''; return; }
        if (!hits.length) { out.innerHTML = '<div class="docsearch-empty">Sin resultados para «' + esc(input.value.trim()) + '»</div>'; out.classList.add('open'); return; }
        out.innerHTML = hits.map(function (h) {
          return '<a class="docsearch-hit" href="' + esc(h.u) + '" style="' + styleFor(h.color) + '" role="option">' +
            '<span class="h-sec">' + esc(h.sec) + '</span>' +
            '<span class="h-t">' + esc(h.t) + '</span>' +
            (h.d ? '<span class="h-s">' + esc(h.d) + '</span>' : '') + '</a>';
        }).join('');
        out.classList.add('open');
      }
      function move(d) {
        var nodes = out.querySelectorAll('.docsearch-hit'); if (!nodes.length) return;
        sel = (sel + d + nodes.length) % nodes.length;
        nodes.forEach(function (n, i) { n.classList.toggle('sel', i === sel); });
        nodes[sel].scrollIntoView({ block: 'nearest' });
      }
      input.addEventListener('input', render);
      input.addEventListener('focus', function () { if (input.value.trim()) render(); });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
        else if (e.key === 'Enter') { var nodes = out.querySelectorAll('.docsearch-hit'); if (sel >= 0 && nodes[sel]) location.href = nodes[sel].getAttribute('href'); }
        else if (e.key === 'Escape') { input.value = ''; out.classList.remove('open'); out.innerHTML = ''; }
      });
      document.addEventListener('click', function (e) { if (!box.contains(e.target)) out.classList.remove('open'); });
    });
  }

  // ── init ────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
