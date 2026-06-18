'use strict';
/**
 * state-natur.js — Estado global del formulario de Persona Natural.
 *
 * Los campos de secciones compartidas (financiera, bancaria, pep,
 * actividades, documentos) se leen directamente desde window.formData
 * porque comparten los mismos controles HTML.
 * Solo los datos exclusivos de la persona natural se almacenan aquí.
 *
 * Depende de: state.js (cargado antes de este archivo)
 */

/** Datos básicos de la persona natural (sección 1) */
window.formDataNatur = {
  basica: {
    // ─── GN_TERCE ────────────────────────────────────────────────
    NOM_TERC: null,   // Primer nombre
    SEG_NOMB: null,   // Segundo nombre (opcional)
    APE_TERC: null,   // Primer apellido
    SEG_APEL: null,   // Segundo apellido (opcional)
    // ─── GN_NATUR ───────────────────────────────────────────────
    MAIL_SARL:    null,
    COD_NACIO:    null,
    OTR_NACIO:    null,   // texto libre cuando nacionalidad = 'OTRO'
    COD_CIIU:     null,
    OTR_CIIU:     null,   // texto libre cuando CIIU = 'OTRO'
    FEC_EXPE:     null,
    COD_PAIS_EXP: '1',
    COD_DEPT_EXP: null,
    COD_MPIO_EXP: null,
  }
};

/**
 * Modo activo del formulario.
 * 'J' = Persona Jurídica  (valor por defecto)
 * 'N' = Persona Natural
 */
window.modoPersona = 'J';
