'use strict';

/**
 * borrador-servidor.js — Guardado de borradores en el servidor (GN_BORRADOR).
 *
 * Complementa el guardado local (localStorage) con persistencia en servidor.
 * El TOKEN_DRAFT se almacena en localStorage para vincular sesiones del mismo
 * usuario en distintas recargas o dispositivos.
 *
 * API pública:
 *   guardarBorradorServidor()  → POST /api/borrador (crea o actualiza)
 *   cargarBorradorServidor()   → GET  /api/borrador?token=…&numIden=…
 *   eliminarBorradorServidor() → DELETE /api/borrador?token=…
 */

const BORRADOR_TOKEN_KEY = 'sarlaft_draft_token';

/** Obtiene el token del borrador guardado en localStorage (puede ser null). */
function getBorradorToken() {
  try { return localStorage.getItem(BORRADOR_TOKEN_KEY) || null; }
  catch (_) { return null; }
}

/** Persiste el token del borrador en localStorage. */
function _setBorradorToken(token) {
  try { localStorage.setItem(BORRADOR_TOKEN_KEY, token); }
  catch (_) {}
}

/** Elimina el token del borrador de localStorage. */
function _clearBorradorToken() {
  try { localStorage.removeItem(BORRADOR_TOKEN_KEY); }
  catch (_) {}
}

/**
 * Guarda el estado actual del formulario en el servidor.
 * Actualiza el token local si el servidor devuelve uno nuevo.
 * @returns {Promise<{ok: boolean, fechaGuardado?: string, codigoEdicion?: string|null}>}
 *   codigoEdicion viene presente solo la primera vez que el borrador recibe
 *   un número de documento (debe mostrarse al usuario para poder reanudarlo).
 */
async function guardarBorradorServidor() {
  try {
    const tipTerc    = (formData?.basica?.TIP_TERC === 'N') ? 'N' : 'E';
    const numIdenTxt = String(formData?.basica?.NUM_IDEN || '').trim() || null;

    const datos = { ...(formData || {}) };
    if (window.formDataNatur) datos._natur = window.formDataNatur;
    const datosJson = JSON.stringify(datos);

    const body = {
      tokenDraft:  getBorradorToken(),
      tipTerc,
      numIdenTxt,
      datosJson,
      gmailVerif:  sessionStorage.getItem('SAGRILAFT_gmail') || null,
    };

    const resp = await fetch('/api/borrador', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });

    if (!resp.ok) return { ok: false };
    const data = await resp.json();
    if (data.tokenDraft) _setBorradorToken(data.tokenDraft);
    return { ok: true, fechaGuardado: data.fechaGuardado, codigoEdicion: data.codigoEdicion || null };
  } catch (_) {
    return { ok: false };
  }
}

/**
 * Intenta cargar un borrador desde el servidor.
 * Busca primero por token, luego por numIden (si hay uno en la URL).
 * @returns {Promise<{encontrado: boolean, datos?: object, fechaGuardado?: string}>}
 */
async function cargarBorradorServidor() {
  try {
    const token    = getBorradorToken();
    const urlParams = new URLSearchParams(window.location.search);
    const numIden  = urlParams.get('numIden') || '';

    if (!token && !numIden) return { encontrado: false };

    const qs = token ? `token=${encodeURIComponent(token)}` : `numIden=${encodeURIComponent(numIden)}`;
    const resp = await fetch(`/api/borrador?${qs}`);
    if (!resp.ok) return { encontrado: false };

    const data = await resp.json();
    if (!data.encontrado) return { encontrado: false };

    if (data.tokenDraft) _setBorradorToken(data.tokenDraft);
    const parsed = JSON.parse(data.datosJson);
    return { encontrado: true, datos: parsed, fechaGuardado: data.fechaGuardado };
  } catch (_) {
    return { encontrado: false };
  }
}

/**
 * Elimina el borrador del servidor y limpia el token local.
 */
async function eliminarBorradorServidor() {
  const token = getBorradorToken();
  _clearBorradorToken();
  if (!token) return;
  try {
    await fetch(`/api/borrador?token=${encodeURIComponent(token)}`, { method: 'DELETE' });
  } catch (_) {}
}
