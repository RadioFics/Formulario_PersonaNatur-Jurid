/**
 * static-mode.js — Modo DEMO sin servidor ni base de datos.
 *
 * Permite publicar el formulario en un hosting estático (Netlify, Vercel,
 * GitHub Pages, etc.) y que funcione COMPLETO para diligenciar información,
 * sin necesidad del backend Node ni de SQL Server.
 *
 * Cómo funciona:
 *   1. Al cargar, hace UNA prueba ("probe") para detectar si hay backend real.
 *        · Si lo hay (entorno local con `node server.js`)  → NO interviene:
 *          todas las peticiones van al servidor real, como siempre.
 *        · Si NO lo hay (hosting estático)                 → intercepta fetch/XHR:
 *          - Catálogos        → se sirven desde static-data.js (datos congelados).
 *          - Guardar          → se simula con éxito + descarga un .json con los datos.
 *          - Verificar/borrador/documentos → respuestas benignas simuladas.
 *   2. Muestra un aviso flotante de "modo demostración".
 *
 * Requiere que static-data.js se cargue ANTES (define window.STATIC_CATALOGOS).
 * Debe cargarse ANTES que el resto de scripts del formulario.
 */
'use strict';

(function () {
  const realFetch = window.fetch ? window.fetch.bind(window) : null;
  const RealXHR   = window.XMLHttpRequest;
  if (!realFetch) return;

  const C = window.STATIC_CATALOGOS || {};

  /* ── Detección de backend (una sola vez) ──────────────────────────────── */
  let _backendReady = null;          // null = aún sin resolver; true/false luego
  let _backendPromise = null;

  function probeBackend() {
    return realFetch('/api/catalogo/monedas', { headers: { Accept: 'application/json' } })
      .then(r => {
        if (!r.ok) return false;
        const ct = r.headers.get('content-type') || '';
        if (!ct.includes('json')) return false;
        return r.clone().json().then(j => Array.isArray(j)).catch(() => false);
      })
      .catch(() => false);
  }

  function backendAvailable() {
    if (_backendPromise) return _backendPromise;
    _backendPromise = probeBackend().then(ok => {
      _backendReady = ok;
      if (!ok) _mostrarAvisoDemo();
      return ok;
    });
    return _backendPromise;
  }
  // Arrancar la detección de inmediato.
  backendAvailable();

  // Exponer la detección para otros scripts (p.ej. dev-fill.js gatea su botón).
  // Resuelve a true si hay servidor real, false si es demo estática.
  window.__sarlaftBackendReady = backendAvailable;

  /* ── Utilidades ───────────────────────────────────────────────────────── */
  function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  function getParam(u, k) { return u.searchParams.get(k); }

  function descargarJSON(nombre, obj) {
    try {
      const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = nombre;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
    } catch (e) { console.warn('descargarJSON:', e); }
  }

  function nuevoCodigoEdicion() {
    const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 8; i++) { if (i === 4) s += '-'; s += c[Math.floor(Math.random() * c.length)]; }
    return s;
  }

  /* ── Resolución de catálogos desde datos congelados ───────────────────── */
  function resolverCatalogo(path, u) {
    switch (path) {
      case '/api/catalogo/tipos-documento':
        return getParam(u, 'todos') === '1' ? C.tiposDocumentoTodos : C.tiposDocumentoNit;

      case '/api/catalogo/paises':
        return C.paises;

      case '/api/catalogo/departamentos': {
        const codPais = getParam(u, 'cod_pais');
        if (!codPais) return [];
        const filas = (C.departamentos || []).filter(d => String(d.COD_PAIS) === String(codPais));
        // Orden del endpoint: COD_DEPT 2 primero, 8 segundo, resto por NOM_DEPT
        const rank = c => (Number(c) === 2 ? 0 : Number(c) === 8 ? 1 : 2);
        return filas.slice().sort((a, b) =>
          rank(a.COD_DEPT) - rank(b.COD_DEPT) || String(a.NOM_DEPT).localeCompare(String(b.NOM_DEPT)));
      }

      case '/api/catalogo/ciudades': {
        const codPais = getParam(u, 'cod_pais');
        const codDept = getParam(u, 'cod_dept');
        if (!codPais) return [];
        if (codPais === 'OTRO' || Number(codPais) === 52) return [];
        if (codDept === 'NA') return [];
        let filas = (C.ciudades || []).filter(m => String(m.COD_PAIS) === String(codPais));
        if (codDept) filas = filas.filter(m => String(m.COD_DEPT) === String(codDept));
        return filas.slice().sort((a, b) => String(a.NOM_MUNI).localeCompare(String(b.NOM_MUNI)));
      }

      case '/api/catalogo/vinculaciones':
        return C.vinculaciones;

      case '/api/catalogo/ciiu':
        return getParam(u, 'tipo') === 'J'
          ? (C.ciiu || []).filter(x => !String(x.COD_CIIU).startsWith('00'))
          : C.ciiu;

      case '/api/catalogo/tipos-sociedad': {
        const ubic = getParam(u, 'ubicacion');
        if (ubic === 'N') return (C.tiposSociedad || []).filter(s => ['N', 'A'].includes(s.UBIC_SOCIE));
        if (ubic === 'E') return (C.tiposSociedad || []).filter(s => ['E', 'A'].includes(s.UBIC_SOCIE));
        return C.tiposSociedad;
      }

      case '/api/catalogo/sistemas-prevencion':
        return C.sistemasPrevencion;

      case '/api/catalogo/bancos':
        return C.bancos;

      case '/api/catalogo/tipos-cuenta':
        return C.tiposCuenta;

      case '/api/catalogo/monedas':
        return C.monedas;

      default:
        return undefined;
    }
  }

  /* ── Manejo estático de cada ruta /api/* ──────────────────────────────── */
  function manejarRutaEstatica(url, init) {
    const u    = new URL(url, window.location.origin);
    const path = u.pathname;
    const method = (init && init.method ? init.method : 'GET').toUpperCase();

    // 1) Catálogos
    if (path.startsWith('/api/catalogo/')) {
      const datos = resolverCatalogo(path, u);
      return jsonResponse(Array.isArray(datos) ? datos : []);
    }

    // 2) Guardar (crear) — Jurídica y Natural
    if (path === '/api/guardar-completo' || path === '/api/guardar-completo-natural') {
      let payload = {};
      try { payload = JSON.parse(init && init.body ? init.body : '{}'); } catch (_) {}
      const numIden = payload.NUM_IDEN || payload.num_iden || 'DEMO';
      const esNatural = path.endsWith('-natural');
      descargarJSON(`SAGRILAFT_${numIden}_${esNatural ? 'natural' : 'juridica'}.json`, {
        _aviso: 'Datos diligenciados en MODO DEMO — no se guardaron en ninguna base de datos.',
        _fecha: new Date().toISOString(),
        tipo: esNatural ? 'Persona Natural' : 'Persona Jurídica',
        datos: payload,
      });
      // COD_TERC null a propósito: oculta el botón "Descargar Excel" (que
      // requeriría el backend). La descarga del .json de arriba lo reemplaza.
      return jsonResponse({
        success: true, demo: true,
        NUM_IDEN: numIden,
        COD_TERC: null,
        codigoEdicion: nuevoCodigoEdicion(),
      });
    }

    // 3) Actualizar (no persiste en demo, pero responde con éxito)
    if (path === '/api/actualizar-completo' || path === '/api/actualizar-completo-natural') {
      let payload = {};
      try { payload = JSON.parse(init && init.body ? init.body : '{}'); } catch (_) {}
      return jsonResponse({ success: true, demo: true, NUM_IDEN: payload.NUM_IDEN || 'DEMO' });
    }

    // 4) Subida de documentos (vía fetch) — simular éxito
    if (path.startsWith('/api/documentos/')) {
      return jsonResponse({ success: true, demo: true, recibidos: 0 });
    }

    // 5) Verificación de identidad (duplicados) — en demo, nunca existe
    if (path.startsWith('/api/verificar-identidad/')) {
      return jsonResponse({ existe: false, demo: true });
    }

    // 6) Verificación de código de edición — no disponible en demo
    if (path === '/api/verificar-codigo-edicion') {
      return jsonResponse({ valido: false, razon: 'demo' });
    }

    // 7) Borrador en servidor — respuestas benignas
    if (path === '/api/borrador') {
      if (method === 'POST')   return jsonResponse({ tokenDraft: 'demo-' + Date.now() });
      if (method === 'DELETE') return jsonResponse({ ok: true });
      return jsonResponse({ encontrado: false });   // GET
    }

    // 8) Cargar registro existente — no disponible en demo
    if (path.startsWith('/api/cargar-completo/')) {
      return jsonResponse({ error: 'No disponible en el modo demostración.' }, 404);
    }

    // Cualquier otra ruta /api/* — respuesta vacía para no romper el flujo
    return jsonResponse({});
  }

  /* ── Intercepción de fetch ────────────────────────────────────────────── */
  function esRutaApi(url) { return typeof url === 'string' && /\/api\//.test(url); }

  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (!esRutaApi(url)) return realFetch(input, init);
    const hayBackend = await backendAvailable();
    if (hayBackend) return realFetch(input, init);
    try {
      return manejarRutaEstatica(url, init || (typeof input === 'object' ? input : {}));
    } catch (e) {
      console.warn('static-mode fetch:', e);
      return jsonResponse({});
    }
  };

  /* ── Intercepción de XMLHttpRequest (solo subida de documentos) ───────── */
  // _subirArchivosConProgreso() usa XHR para reportar progreso real.
  function MockXHR() {
    this.upload = { addEventListener: (ev, cb) => { if (ev === 'progress') this._prog = cb; } };
    this._l = {};
    this.status = 0;
    this.responseText = '';
  }
  MockXHR.prototype.open = function (m, u) { this._url = u; };
  MockXHR.prototype.setRequestHeader = function () {};
  MockXHR.prototype.addEventListener = function (ev, cb) { this._l[ev] = cb; };
  MockXHR.prototype.send = function () {
    const self = this;
    setTimeout(() => { if (self._prog) self._prog({ lengthComputable: true, loaded: 60, total: 100 }); }, 60);
    setTimeout(() => {
      if (self._prog) self._prog({ lengthComputable: true, loaded: 100, total: 100 });
      self.status = 200;
      self.responseText = JSON.stringify({ success: true, demo: true });
      if (self._l.load) self._l.load();
    }, 160);
  };

  window.XMLHttpRequest = function () {
    // Si ya sabemos que NO hay backend, y la llamada es de documentos, usar mock.
    // (La subida ocurre al enviar el formulario, mucho después del probe inicial.)
    if (_backendReady === false) return new MockXHR();
    return new RealXHR();
  };

  /* ── Aviso flotante de modo demostración ──────────────────────────────── */
  function _mostrarAvisoDemo() {
    const crear = () => {
      if (document.getElementById('demo-banner')) return;
      const esEN = (window._currentLang === 'en');
      const b = document.createElement('div');
      b.id = 'demo-banner';
      // Estilo alineado con el formulario: tarjeta blanca, borde-acento a la
      // izquierda (como las cabeceras de sección), título en azul primario,
      // radios/colores tomados de las variables CSS de styles.css.
      b.style.cssText = [
        'position:fixed', 'bottom:16px', 'left:16px', 'z-index:99999',
        'max-width:340px', 'background:#fff', 'color:#37474f',
        'padding:12px 16px',
        'border:1px solid var(--color-primary-light, #C2E4EF)',
        'border-left:5px solid var(--color-accent, #20A7C9)',
        'border-radius:var(--radius, 6px)',
        'font-size:.78rem', 'line-height:1.5',
        'box-shadow:0 6px 22px rgba(12,107,140,.18)',
        'display:flex', 'gap:10px', 'align-items:flex-start',
      ].join(';');
      b.innerHTML =
        '<span style="flex-shrink:0;width:20px;height:20px;border-radius:50%;' +
        'background:var(--color-accent,#20A7C9);color:#fff;font-weight:700;font-style:italic;' +
        'font-size:.8rem;display:flex;align-items:center;justify-content:center;font-family:Georgia,serif">i</span>' +
        '<div><strong style="color:var(--color-primary,#0C6B8C);font-size:.82rem">' +
        (esEN ? 'Demo mode' : 'Modo demostración') + '</strong><br>' +
        (esEN
          ? 'The form is fully functional, but data is NOT saved to any database. On submit, a file with the entered data is downloaded.'
          : 'El formulario es completamente funcional, pero los datos NO se guardan en ninguna base de datos. Al enviar, se descarga un archivo con la información diligenciada.') +
        '</div>' +
        '<button aria-label="cerrar" style="background:none;border:none;color:var(--color-accent,#20A7C9);' +
        'font-size:1.05rem;cursor:pointer;line-height:1;margin-left:auto;padding:0" ' +
        'onclick="this.parentNode.remove()">✕</button>';
      document.body.appendChild(b);
    };
    if (document.body) crear();
    else document.addEventListener('DOMContentLoaded', crear);
  }
})();
