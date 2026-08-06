import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { descargarLibroXlsx } from './xlsxExport';
import AgendaGoogleCalendar from './modules/google-calendar/AgendaGoogleCalendar';
import { auth } from './firebase';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  diagnosticarFirestoreRest,
  guardarDocumentoRest,
  crearDocumentoSiNoExisteRest,
  actualizarDocumentoConVersionRest,
  listarColeccionRest,
  obtenerDocumentoRest,
  eliminarDocumentoRest,
  inicializarPrimerAdministradorRest,
  activarSeguridadAdministradorRest,
} from './firestoreRest';

const APP_VERSION = 'Fase 6C.1 Web · Protección contra sobrescritura';
const BUILD_ID = '2026-08-05-06C01';
const FECHA_MIGRACION_FACTURACION_JULIO_ISO = '2026-07-01T05:00:00.000Z';
const FECHA_MIGRACION_FACTURACION_JULIO_MS = Date.parse(FECHA_MIGRACION_FACTURACION_JULIO_ISO);
const PERIODO_MIGRACION_FACTURACION_JULIO = '2026-07';


const rolesSigv = {
  administrador: {
    id: 'administrador',
    label: 'Administrador',
    descripcion: 'Puede ver todo, crear, editar, consultar, eliminar con precaución, editar configuración y administrar usuarios.',
  },
  asesor: {
    id: 'asesor',
    label: 'Asesor',
    descripcion: 'Puede crear asesorías, editar asesorías y cambiar estados del proceso. No puede modificar tarifas ni configuración general.',
  },
};

function claveUsuarioSigv(email = '') {
  return String(email || '').trim().toLowerCase();
}

function normalizarRolSigv(rol = '') {
  const limpio = normalizar(String(rol || ''));
  if (limpio === 'administrador' || limpio === 'admin') return 'administrador';
  if (limpio === 'asesor' || limpio === 'asesora') return 'asesor';
  return '';
}

function normalizarUsuarioSigv(data = {}, fallbackEmail = '') {
  const email = claveUsuarioSigv(data.email || fallbackEmail || data.id || '');
  const rol = normalizarRolSigv(data.rol || data.role || '');
  return {
    ...data,
    id: data.id || email,
    email,
    nombre: String(data.nombre || data.name || email || 'Usuario SIGV').trim(),
    rol,
    activo: data.activo === true,
    provisional: false,
    creadoEnFase4A: data.creadoEnFase4A !== false,
    updatedAtMs: Number(data.updatedAtMs) || 0,
  };
}

function perfilSinAcceso(user, motivo = 'sinPerfil') {
  const email = claveUsuarioSigv(user?.email || '');
  return {
    id: email,
    email,
    nombre: user?.displayName || email || 'Usuario SIGV',
    rol: '',
    activo: false,
    motivoBloqueo: motivo,
  };
}

function perfilAdministradorAutenticado(user) {
  const email = claveUsuarioSigv(user?.email || '');
  return normalizarUsuarioSigv({
    id: email,
    email,
    nombre: user?.displayName || email || 'Administrador SIGV',
    rol: 'administrador',
    activo: true,
    creadoEnFase5A: true,
  }, email);
}

function normalizarSeguridad(data = {}) {
  return {
    primerAdministradorConfigurado: data?.primerAdministradorConfigurado === true,
    primerAdministradorEmail: claveUsuarioSigv(data?.primerAdministradorEmail || ''),
    inicializacionCerrada: data?.inicializacionCerrada === true,
    versionSeguridad: String(data?.versionSeguridad || ''),
    updatedAtIso: String(data?.updatedAtIso || ''),
  };
}

function esAdministradorActivo(usuario = {}) {
  return usuario?.activo === true && normalizarRolSigv(usuario?.rol) === 'administrador';
}

function hayAdministradorActivo(usuarios = []) {
  return usuarios.some(esAdministradorActivo);
}

function hayAdministradorActivoGuardado(usuarios = []) {
  return usuarios.some(esAdministradorActivo);
}

function ordenarUsuariosSigv(usuarios = []) {
  return [...usuarios].sort((a, b) => String(a.nombre || a.email).localeCompare(String(b.nombre || b.email), 'es'));
}

function permisosDesdePerfil(perfil) {
  const rol = normalizarRolSigv(perfil?.rol);
  const activo = perfil?.activo === true;
  const esAdministrador = activo && rol === 'administrador';
  const esAsesor = activo && rol === 'asesor';
  return {
    activo: esAdministrador || esAsesor,
    rol,
    esAdministrador,
    esAsesor,
    puedeVerTodo: esAdministrador,
    puedeCrearCasos: esAdministrador || esAsesor,
    puedeEditarCasos: esAdministrador || esAsesor,
    puedeCambiarEstado: esAdministrador || esAsesor,
    puedeEliminarCasos: esAdministrador,
    puedeCambiarFechaCreacion: esAdministrador,
    puedeCorregirFacturacion: esAdministrador,
    puedeVerAgendaGoogle: esAdministrador,
    puedeEditarConfiguracion: esAdministrador,
    puedeAgregarAsesoras: esAdministrador,
  };
}

function puedeVerVista(vista, permisos) {
  if (!permisos?.activo) return false;
  if (vista === 'configuracion') return permisos.puedeEditarConfiguracion;
  if (vista === 'agendaGoogle') return permisos.puedeVerAgendaGoogle;
  if (vista === 'nuevoCaso') return permisos.puedeCrearCasos;
  return ['dashboard', 'casos', 'detalleCaso', 'plantillas', 'estadoApp'].includes(vista);
}

function conTiempoLimite(promesa, ms, mensaje) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(mensaje)), ms);
  });
  return Promise.race([promesa, timeout]).finally(() => clearTimeout(timer));
}

const tarifasBase = {
  afiliado: { label: 'Afiliado', primeraVez: 150000, renovacion: 150000, actualizacion: 75000, globalEntry: null },
  noAfiliado: { label: 'No afiliado', primeraVez: 190000, renovacion: 190000, actualizacion: 95000, globalEntry: null },
  premiumAfiliado: { label: 'Paquete Premium Afiliado', primeraVez: 210000, renovacion: 210000, actualizacion: null, globalEntry: null },
  premiumNoAfiliado: { label: 'Paquete Premium No Afiliado', primeraVez: 250000, renovacion: 250000, actualizacion: null, globalEntry: null },
  servicioAdicional: { label: 'Servicio adicional', primeraVez: null, renovacion: null, actualizacion: null, globalEntry: 100000 },
};

const costosBase = {
  envioDocumentacionBogota: 155000,
  fedexDomicilio: 68000,
  fedexAltoPrado: 56000,
  derechosConsularesUsd: 185,
};

const asesorasBase = ['Milena', 'Ximena', 'Uldis'];

const configuracionBase = {
  tarifas: tarifasBase,
  costos: costosBase,
  asesoras: asesorasBase,
  googleCalendar: { clientId: '', calendarId: 'primary' },
};

function crearFacturacion(tipoTramite = 'primeraVez') {
  return {
    nombre: '',
    cedulaNit: '',
    telefono: '',
    direccion: '',
    ciudad: '',
    nombreEmpresaAfiliada: '',
    correo: '',
    tipoTramite,
    medioPago: '',
    estadoFactura: 'porFacturar',
    fechaFacturacionIso: '',
    fechaFacturacionMs: 0,
    periodoFacturacion: '',
    facturadoPor: '',
    fechaFacturacionInferida: false,
    origenFechaFacturacion: '',
    valorFacturado: 0,
    cantidadVisasFacturadas: 0,
    valor: 0,
  };
}

function crearIdIntegrante() {
  return `integrante-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function crearIntegrante(numero = 1, base = {}) {
  const tipoCliente = base.tipoClienteKey || base.tipoCliente || 'afiliado';
  const tipoSolicitud = base.tipoSolicitudKey || base.tipoSolicitud || 'primeraVez';
  const documentosBase = base.documentosObj || base.documentos || {};
  const documentos = Object.fromEntries(documentosRequeridos(tipoSolicitud).map(id => [id, !!documentosBase[id]]));
  return {
    id: base.id || crearIdIntegrante(),
    nombre: base.nombre || '',
    telefono: base.telefono || '',
    email: base.email || '',
    tipoCliente,
    tipoSolicitud,
    tipoClienteKey: tipoCliente,
    tipoSolicitudKey: tipoSolicitud,
    fedex: base.fedex || '',
    documentos,
    documentosObj: documentos,
  };
}

function normalizarAjustesPrecio(ajustes = {}) {
  if (!ajustes || typeof ajustes !== 'object' || Array.isArray(ajustes)) return {};
  return Object.fromEntries(Object.entries(ajustes).flatMap(([integranteId, valor]) => {
    const numero = Number(valor);
    if (!integranteId || !Number.isFinite(numero) || numero < 0) return [];
    return [[integranteId, Math.round(numero)]];
  }));
}

function precioManualIntegrante(ajustes = {}, integranteId = '') {
  const normalizados = normalizarAjustesPrecio(ajustes);
  return Object.prototype.hasOwnProperty.call(normalizados, integranteId) ? normalizados[integranteId] : null;
}

function ajustesPrecioParaIntegrantes(ajustes = {}, integrantes = []) {
  const ids = new Set(normalizarIntegrantes({ integrantes }).map(integrante => integrante.id));
  return Object.fromEntries(Object.entries(normalizarAjustesPrecio(ajustes)).filter(([integranteId]) => ids.has(integranteId)));
}

function normalizarIntegrantes(data = {}) {
  const listaBase = Array.isArray(data.integrantes) && data.integrantes.length
    ? data.integrantes
    : [{
        id: data.integranteId,
        nombre: data.nombre,
        telefono: data.telefono,
        email: data.email,
        tipoCliente: data.tipoClienteKey || data.tipoCliente,
        tipoSolicitud: data.tipoSolicitudKey || data.tipoSolicitud,
        fedex: data.fedex,
        documentos: data.documentosObj || data.documentos,
      }];

  const normalizados = listaBase.map((integrante, indice) => crearIntegrante(indice + 1, integrante));
  return normalizados.length ? normalizados : [crearIntegrante(1)];
}

function tipoClienteEsAfiliado(tipoClienteKey = '') {
  return tipoClienteKey === 'afiliado' || tipoClienteKey === 'premiumAfiliado';
}

function hayIntegranteAfiliado(integrantes = []) {
  const lista = Array.isArray(integrantes) ? integrantes : normalizarIntegrantes(integrantes);
  return lista.some(integrante => tipoClienteEsAfiliado(integrante.tipoCliente || integrante.tipoClienteKey));
}

function facturacionSegunAfiliacion(facturacion = {}, integrantes = []) {
  return hayIntegranteAfiliado(integrantes)
    ? facturacion
    : { ...facturacion, nombreEmpresaAfiliada: '' };
}

function serializarIntegrante(integrante, indice = 0) {
  const normalizado = crearIntegrante(indice + 1, integrante);
  return {
    id: normalizado.id,
    nombre: normalizado.nombre,
    telefono: normalizado.telefono,
    email: normalizado.email,
    tipoCliente: normalizado.tipoCliente,
    tipoSolicitud: normalizado.tipoSolicitud,
    fedex: normalizado.fedex,
    documentos: { ...normalizado.documentos },
  };
}

function primerIntegrante(data = {}) {
  return normalizarIntegrantes(data)[0] || crearIntegrante(1);
}

function ajustarCantidadIntegrantes(listaActual = [], cantidad = 1) {
  const cantidadNormalizada = Math.max(1, Math.min(30, Number(cantidad) || 1));
  const actuales = normalizarIntegrantes({ integrantes: listaActual });
  const nuevos = [...actuales];
  const tipoClienteReferencia = actuales[0]?.tipoCliente || actuales[0]?.tipoClienteKey || 'afiliado';
  while (nuevos.length < cantidadNormalizada) {
    nuevos.push(crearIntegrante(nuevos.length + 1, {
      tipoCliente: tipoClienteReferencia,
      tipoClienteKey: tipoClienteReferencia,
    }));
  }
  return nuevos.slice(0, cantidadNormalizada).map((integrante, indice) => crearIntegrante(indice + 1, integrante));
}

function textoClienteCaso(caso = {}) {
  const integrantes = normalizarIntegrantes(caso);
  const principal = integrantes[0];
  if (integrantes.length <= 1) return principal.nombre || caso.nombre || 'Sin nombre';
  return `${principal.nombre || 'Grupo familiar'} + ${integrantes.length - 1} integrante${integrantes.length - 1 === 1 ? '' : 's'}`;
}

function textoSolicitudesCaso(caso = {}) {
  const tipos = [...new Set(normalizarIntegrantes(caso).map(i => i.tipoSolicitud))];
  if (tipos.length <= 1) return textoSolicitud(tipos[0] || caso.tipoSolicitudKey || caso.tipoSolicitud || 'primeraVez');
  return 'Varios trámites';
}

function textoClientesCaso(caso = {}, config = configuracionBase) {
  const configuracion = normalizarConfiguracion(config);
  const tipos = [...new Set(normalizarIntegrantes(caso).map(i => i.tipoCliente))];
  if (tipos.length <= 1) return configuracion.tarifas[tipos[0]]?.label || caso.tipoCliente || '';
  return 'Varios tipos de cliente';
}

const tiposSolicitud = [
  { id: 'primeraVez', label: 'Primera vez' },
  { id: 'renovacion', label: 'Renovación' },
  { id: 'actualizacion', label: 'Actualización' },
  { id: 'globalEntry', label: 'Global Entry' },
];

const documentosCatalogo = {
  foto: { label: 'Foto' },
  pasaporte: { label: 'Pasaporte vigente' },
  ds160: { label: 'Formulario DS-160 previamente diligenciado' },
  pagoAsesoria: { label: 'Soporte de pago de la asesoría' },
  visaAnterior: { label: 'Visa anterior / información de la visa previa' },
  autorizacionEnvio: { label: 'Autorización para envío de documentación' },
  soporteActualizacion: { label: 'Soporte o datos que se van a actualizar' },
  cuentaTtp: { label: 'Cuenta TTP / PASSID para Global Entry' },
};

const documentosPorTipo = {
  primeraVez: ['foto', 'pasaporte', 'ds160', 'pagoAsesoria'],
  renovacion: ['foto', 'pasaporte', 'ds160', 'pagoAsesoria', 'visaAnterior', 'autorizacionEnvio'],
  actualizacion: ['foto', 'pasaporte', 'ds160', 'pagoAsesoria', 'soporteActualizacion'],
  globalEntry: ['pasaporte', 'pagoAsesoria', 'cuentaTtp'],
};

const estadosProceso = [
  'Pendiente Documentación',
  'Pendiente de pago Asesoría',
  'Pendiente de pago Derechos consulares',
  'Pendiente Agendamiento de Asesoría',
  'Asesoría Agendada',
  'Pendiente Facturación',
  'Pendiente Cita embajada',
  'Finalizado',
];

const plantillas = [
  {
    id: 'docsPendientes',
    titulo: 'Solicitud de documentos pendientes',
    asunto: 'Documentos pendientes para continuar con tu asesoría de visa',
    cuerpo: `Buenas tardes, {{cliente}}.

Para poder avanzar con tu asesoría de visa, aún tenemos pendiente recibir la siguiente documentación:

{{documentosPendientes}}

Una vez recibamos estos documentos completos, podremos continuar con la programación de tu asesoría.

Cordialmente,
{{asesor}}
Área de Visas - AmCham Atlántico y Magdalena`,
  },
  {
    id: 'listoAgendar',
    titulo: 'Asesoría lista para agendar',
    asunto: 'Tu asesoría se encuentra lista para agendar',
    cuerpo: `Buenas tardes, {{cliente}}.

Te confirmamos que ya contamos con los documentos requeridos para tu asesoría. El siguiente paso es coordinar la fecha y hora con el equipo de visas.

Quedamos atentos para continuar con la programación.

Cordialmente,
{{asesor}}
Área de Visas - AmCham Atlántico y Magdalena`,
  },
  {
    id: 'confirmacionAsesoria',
    titulo: 'Confirmación de asesoría agendada',
    asunto: 'Confirmación de asesoría de visa',
    cuerpo: `Buenas tardes, {{cliente}}.

Te confirmamos que tu asesoría de visa ha sido programada para la fecha indicada por el equipo. Te recomendamos tener a la mano tu pasaporte y la información relacionada con tu viaje, estudios, trabajo y antecedentes de visas anteriores, si aplica.

Cordialmente,
{{asesor}}
Área de Visas - AmCham Atlántico y Magdalena`,
  },
  {
    id: 'seguimientoPago',
    titulo: 'Seguimiento soporte de pago',
    asunto: 'Soporte de pago pendiente - Asesoría de visa',
    cuerpo: `Buenas tardes, {{cliente}}.

Para continuar con el proceso, agradecemos enviarnos el soporte de pago de la asesoría. Este documento es necesario para dejar tu asesoría habilitada y avanzar con la revisión correspondiente.

Cordialmente,
{{asesor}}
Área de Visas - AmCham Atlántico y Magdalena`,
  },
];

function crearDocumentos(tipoSolicitud) {
  return Object.fromEntries((documentosPorTipo[tipoSolicitud] || []).map(id => [id, false]));
}

function documentosRequeridos(tipoSolicitud) {
  return documentosPorTipo[tipoSolicitud] || documentosPorTipo.primeraVez;
}

function normalizarNumero(valor, fallback = null) {
  if (valor === undefined) return fallback;
  if (valor === '' || valor === null) return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : fallback;
}

function normalizarConfiguracion(config = {}) {
  const tarifasGuardadas = config.tarifas || {};
  const tarifas = Object.fromEntries(Object.entries(tarifasBase).map(([id, tarifa]) => {
    const guardada = tarifasGuardadas[id] || {};
    return [id, {
      ...tarifa,
      ...guardada,
      label: guardada.label || tarifa.label,
      primeraVez: normalizarNumero(guardada.primeraVez, tarifa.primeraVez),
      renovacion: normalizarNumero(guardada.renovacion, tarifa.renovacion),
      actualizacion: normalizarNumero(guardada.actualizacion, tarifa.actualizacion),
      globalEntry: normalizarNumero(guardada.globalEntry, tarifa.globalEntry),
    }];
  }));

  const costos = {
    ...costosBase,
    ...(config.costos || {}),
    envioDocumentacionBogota: normalizarNumero(config.costos?.envioDocumentacionBogota, costosBase.envioDocumentacionBogota),
    fedexDomicilio: normalizarNumero(config.costos?.fedexDomicilio, costosBase.fedexDomicilio),
    fedexAltoPrado: normalizarNumero(config.costos?.fedexAltoPrado, costosBase.fedexAltoPrado),
    derechosConsularesUsd: normalizarNumero(config.costos?.derechosConsularesUsd, costosBase.derechosConsularesUsd),
  };

  const asesoras = Array.isArray(config.asesoras)
    ? config.asesoras.map(a => String(a || '').trim()).filter(Boolean)
    : asesorasBase;

  const googleCalendar = {
    clientId: String(config.googleCalendar?.clientId || '').trim(),
    calendarId: String(config.googleCalendar?.calendarId || 'primary').trim() || 'primary',
  };

  return { tarifas, costos, asesoras: asesoras.length ? asesoras : asesorasBase, googleCalendar };
}

function inicialFormulario() {
  const integrantes = [crearIntegrante(1)];
  return {
    asesor: '',
    cantidad: 1,
    integrantes,
    observacion: '',
    seguimiento: '',
    fechaAsesoria: '',
    horaAsesoria: '',
    facturacion: crearFacturacion('primeraVez'),
    fechaCitaEmbajada: '',
    estadoManual: '',
    ajustesPrecio: {},
    aplicarDescuentoCantidad: true,
  };
}

const ZONA_HORARIA_COLOMBIA = 'America/Bogota';

function fechaColombia(fecha = new Date()) {
  return fecha.toLocaleString('es-CO', {
    timeZone: ZONA_HORARIA_COLOMBIA,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function partesFechaColombia(fecha = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA_COLOMBIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(fecha);
  const valores = Object.fromEntries(partes.map(parte => [parte.type, parte.value]));
  const year = Number(valores.year);
  const month = Number(valores.month);
  const day = Number(valores.day);
  return { year, month, day, clave: `${valores.year}-${valores.month}-${valores.day}` };
}

function claveFechaDesdeValor(valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  if (typeof valor === 'number' && Number.isFinite(valor)) return partesFechaColombia(new Date(valor)).clave;
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) return partesFechaColombia(valor).clave;

  const texto = String(valor).trim();
  const isoSimple = texto.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|$)/);
  if (isoSimple) {
    const fecha = new Date(texto);
    if (!Number.isNaN(fecha.getTime()) && texto.includes('T')) return partesFechaColombia(fecha).clave;
    return `${isoSimple[1]}-${isoSimple[2]}-${isoSimple[3]}`;
  }

  const formatoColombia = texto.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
  if (formatoColombia) {
    const [, dia, mes, year] = formatoColombia;
    return `${year}-${String(Number(mes)).padStart(2, '0')}-${String(Number(dia)).padStart(2, '0')}`;
  }

  const fecha = new Date(texto);
  return Number.isNaN(fecha.getTime()) ? '' : partesFechaColombia(fecha).clave;
}

function claveCreacionCaso(caso = {}) {
  const directa = claveFechaDesdeValor(caso.createdAtIso) || claveFechaDesdeValor(caso.createdAtMs);
  if (directa) return directa;
  const eventoCreacion = (caso.historial || []).find(item => normalizar(item.tipo) === 'creacion');
  return claveFechaEvento(eventoCreacion);
}

function fechaCreacionDesdeClave(clave = '') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clave)) return null;
  const [year, month, day] = clave.split('-').map(Number);
  const fecha = new Date(`${clave}T12:00:00-05:00`);
  if (Number.isNaN(fecha.getTime())) return null;
  if (fecha.getFullYear() !== year || fecha.getMonth() + 1 !== month || fecha.getDate() !== day) return null;
  return fecha;
}

function claveFechaEvento(item = {}) {
  return claveFechaDesdeValor(item.fechaIso) || claveFechaDesdeValor(item.fechaMs) || claveFechaDesdeValor(item.fecha);
}

function fechaLargaDesdeClave(clave = '') {
  const [year, month, day] = clave.split('-').map(Number);
  if (!year || !month || !day) return 'Fecha seleccionada';
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: ZONA_HORARIA_COLOMBIA,
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function fechaEventoLegible(item = {}) {
  if (item.fecha) return item.fecha;
  const fecha = new Date(item.fechaIso || item.fechaMs || '');
  return Number.isNaN(fecha.getTime()) ? 'Hora no disponible' : fechaColombia(fecha);
}

function marcaTiempoEvento(item = {}) {
  const directa = Number(item.fechaMs) || Date.parse(item.fechaIso || '');
  if (Number.isFinite(directa) && directa > 0) return directa;
  const texto = String(item.fecha || '');
  const coincidencia = texto.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4}),?\s*(\d{1,2}):(\d{2})\s*(a\.?\s*m\.?|p\.?\s*m\.?)?/i);
  if (!coincidencia) return 0;
  let [, dia, mes, year, hora, minuto, periodo] = coincidencia;
  let horas = Number(hora);
  if (periodo) {
    const pm = normalizar(periodo).startsWith('p');
    if (pm && horas < 12) horas += 12;
    if (!pm && horas === 12) horas = 0;
  }
  return Date.UTC(Number(year), Number(mes) - 1, Number(dia), horas + 5, Number(minuto));
}

function moneda(valor) {
  if (valor === null || valor === undefined) return 'No aplica';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor);
}

function describirCambiosPrecio(casoAnterior = {}, casoNuevo = {}, config = configuracionBase) {
  const anteriores = normalizarAjustesPrecio(casoAnterior.ajustesPrecio);
  const nuevos = normalizarAjustesPrecio(casoNuevo.ajustesPrecio);
  const integrantes = normalizarIntegrantes(casoNuevo);
  const cambios = [];

  for (const integrante of integrantes) {
    const anterior = precioManualIntegrante(anteriores, integrante.id);
    const nuevo = precioManualIntegrante(nuevos, integrante.id);
    if (anterior === nuevo) continue;

    const nombre = integrante.nombre || `Integrante ${integrantes.indexOf(integrante) + 1}`;
    const tarifaConfigurada = normalizarConfiguracion(config).tarifas[integrante.tipoCliente]?.[integrante.tipoSolicitud];
    if (nuevo === null) {
      cambios.push(`${nombre}: se restauró la tarifa configurada (${moneda(tarifaConfigurada)}).`);
    } else if (anterior === null) {
      cambios.push(`${nombre}: precio personalizado establecido en ${moneda(nuevo)}.`);
    } else {
      cambios.push(`${nombre}: precio personalizado cambió de ${moneda(anterior)} a ${moneda(nuevo)}.`);
    }
  }

  return cambios.join(' ');
}

function describirCambioFacturacion(casoAnterior = {}, casoNuevo = {}) {
  const anterior = casoAnterior.facturacion?.estadoFactura === 'facturada' ? 'facturada' : 'porFacturar';
  const nuevo = casoNuevo.facturacion?.estadoFactura === 'facturada' ? 'facturada' : 'porFacturar';
  if (anterior === nuevo) return '';
  return nuevo === 'facturada'
    ? 'La asesoría fue marcada como facturada.'
    : 'La asesoría fue marcada nuevamente como por facturar.';
}

function facturacionConFecha(facturacionNueva = {}, facturacionAnterior = {}, data = {}, config = configuracionBase, valorOverride = null, cantidadVisas = 1, ahora = new Date(), facturadoPor = '') {
  const normalizada = normalizarFacturacion(facturacionNueva, data, config, valorOverride);
  const estadoAnterior = facturacionAnterior?.estadoFactura === 'facturada' ? 'facturada' : 'porFacturar';

  if (normalizada.estadoFactura !== 'facturada') {
    return {
      ...normalizada,
      fechaFacturacionIso: '',
      fechaFacturacionMs: 0,
      periodoFacturacion: '',
      facturadoPor: '',
      fechaFacturacionInferida: false,
      origenFechaFacturacion: '',
      valorFacturado: 0,
      cantidadVisasFacturadas: 0,
    };
  }

  const fechaIsoExistente = String(facturacionAnterior?.fechaFacturacionIso || facturacionNueva?.fechaFacturacionIso || '');
  const fechaMsExistente = Number(facturacionAnterior?.fechaFacturacionMs || facturacionNueva?.fechaFacturacionMs) || 0;
  const periodoExistente = String(facturacionAnterior?.periodoFacturacion || facturacionNueva?.periodoFacturacion || '');
  const periodoDesdeFecha = claveMesDesdeClaveFecha(
    claveFechaDesdeValor(fechaIsoExistente) || claveFechaDesdeValor(fechaMsExistente)
  );

  if (estadoAnterior === 'facturada') {
    return {
      ...normalizada,
      fechaFacturacionIso: fechaIsoExistente,
      fechaFacturacionMs: fechaMsExistente,
      periodoFacturacion: /^\d{4}-\d{2}$/.test(periodoExistente) ? periodoExistente : periodoDesdeFecha,
      facturadoPor: String(facturacionAnterior?.facturadoPor || facturacionNueva?.facturadoPor || facturadoPor || ''),
      fechaFacturacionInferida: facturacionAnterior?.fechaFacturacionInferida === true || facturacionNueva?.fechaFacturacionInferida === true,
      origenFechaFacturacion: String(facturacionAnterior?.origenFechaFacturacion || facturacionNueva?.origenFechaFacturacion || ''),
      valorFacturado: Number(facturacionAnterior?.valorFacturado) > 0
        ? Number(facturacionAnterior.valorFacturado)
        : Number(facturacionNueva?.valorFacturado) > 0
          ? Number(facturacionNueva.valorFacturado)
          : Number(valorOverride) || 0,
      cantidadVisasFacturadas: Number(facturacionAnterior?.cantidadVisasFacturadas) > 0
        ? Number(facturacionAnterior.cantidadVisasFacturadas)
        : Number(facturacionNueva?.cantidadVisasFacturadas) > 0
          ? Number(facturacionNueva.cantidadVisasFacturadas)
          : Number(cantidadVisas) || 1,
    };
  }

  const partesFactura = partesFechaColombia(ahora);
  return {
    ...normalizada,
    fechaFacturacionIso: ahora.toISOString(),
    fechaFacturacionMs: ahora.getTime(),
    periodoFacturacion: `${partesFactura.year}-${String(partesFactura.month).padStart(2, '0')}`,
    facturadoPor: String(facturadoPor || ''),
    fechaFacturacionInferida: false,
    origenFechaFacturacion: 'Registro automático al marcar la asesoría como facturada.',
    valorFacturado: Number(valorOverride) || 0,
    cantidadVisasFacturadas: Number(cantidadVisas) || 1,
  };
}

function eventoFacturacionCaso(caso = {}) {
  return [...(caso.historial || [])].reverse().find(item => {
    const texto = normalizar(item.texto || '');
    return texto.includes('fue marcada como facturada');
  }) || null;
}

function claveFacturacionCaso(caso = {}) {
  if (caso.facturacion?.estadoFactura !== 'facturada') return '';
  const directa = claveFechaDesdeValor(caso.facturacion?.fechaFacturacionIso)
    || claveFechaDesdeValor(caso.facturacion?.fechaFacturacionMs);
  if (directa) return directa;
  return claveFechaEvento(eventoFacturacionCaso(caso));
}

function mesFacturacionCaso(caso = {}) {
  if (caso.facturacion?.estadoFactura !== 'facturada') return '';
  const periodo = String(caso.facturacion?.periodoFacturacion || '');
  if (/^\d{4}-\d{2}$/.test(periodo)) return periodo;
  return claveMesDesdeClaveFecha(claveFacturacionCaso(caso));
}

function completarFechaFacturacionHistorica(caso = {}, facturacion = {}) {
  if (facturacion.estadoFactura !== 'facturada' || facturacion.fechaFacturacionIso || facturacion.fechaFacturacionMs) return facturacion;
  const eventoHistorico = eventoFacturacionCaso(caso);
  if (!eventoHistorico) return facturacion;
  const fechaMs = Number(eventoHistorico.fechaMs) || marcaTiempoEvento(eventoHistorico) || 0;
  const fechaIso = String(eventoHistorico.fechaIso || (fechaMs ? new Date(fechaMs).toISOString() : ''));
  return {
    ...facturacion,
    fechaFacturacionIso: fechaIso,
    fechaFacturacionMs: fechaMs,
    periodoFacturacion: claveMesDesdeClaveFecha(claveFechaDesdeValor(fechaIso) || claveFechaDesdeValor(fechaMs)),
    fechaFacturacionInferida: true,
    origenFechaFacturacion: 'Fecha recuperada del historial de la asesoría.',
  };
}

function fechaFacturacionLegible(facturacion = {}) {
  const clave = claveFechaDesdeValor(facturacion.fechaFacturacionIso)
    || claveFechaDesdeValor(facturacion.fechaFacturacionMs);
  return clave ? fechaLargaDesdeClave(clave) : '';
}

function auditoriaFacturacionCompleta(caso = {}) {
  if (caso.facturacion?.estadoFactura !== 'facturada') return true;
  const factura = caso.facturacion || {};
  const tieneFecha = !!(claveFechaDesdeValor(factura.fechaFacturacionIso)
    || claveFechaDesdeValor(factura.fechaFacturacionMs));
  return tieneFecha
    && /^\d{4}-\d{2}$/.test(String(factura.periodoFacturacion || ''))
    && String(factura.facturadoPor || '').trim().length > 0
    && Number(factura.valorFacturado) >= 0
    && Number(factura.cantidadVisasFacturadas) > 0;
}

function facturacionAutomaticaReal(caso = {}) {
  const factura = caso.facturacion || {};
  const origen = normalizar(factura.origenFechaFacturacion || '');
  return factura.estadoFactura === 'facturada'
    && factura.fechaFacturacionInferida !== true
    && origen.includes('registro automatico al marcar la asesoria como facturada')
    && !!(claveFechaDesdeValor(factura.fechaFacturacionIso) || claveFechaDesdeValor(factura.fechaFacturacionMs));
}

function requiereReconciliacionFacturacionJulio(caso = {}) {
  if (caso.facturacion?.estadoFactura !== 'facturada') return false;
  if (facturacionAutomaticaReal(caso)) return false;
  if (caso.facturacion?.migracionJulio2026Completada === true) return false;

  const mesCreacion = claveMesDesdeClaveFecha(claveCreacionCaso(caso));
  if (mesCreacion !== PERIODO_MIGRACION_FACTURACION_JULIO) return false;

  const mesFactura = mesFacturacionCaso(caso);
  const cantidadActual = cantidadVisasCaso(caso);
  const cantidadRegistrada = Number(caso.facturacion?.cantidadVisasFacturadas) || 0;
  return mesFactura !== PERIODO_MIGRACION_FACTURACION_JULIO
    || cantidadRegistrada !== cantidadActual
    || !auditoriaFacturacionCompleta(caso);
}

function requiereMigracionFacturacionJulio(caso = {}) {
  return caso.facturacion?.estadoFactura === 'facturada'
    && (!auditoriaFacturacionCompleta(caso) || requiereReconciliacionFacturacionJulio(caso));
}

function prepararMigracionFacturacionJulio(caso = {}, actor = '') {
  const facturaAnterior = caso.facturacion || {};
  const claveFechaExistente = claveFechaDesdeValor(facturaAnterior.fechaFacturacionIso)
    || claveFechaDesdeValor(facturaAnterior.fechaFacturacionMs);
  const forzarPrimeroJulio = requiereReconciliacionFacturacionJulio(caso);
  const asignarPrimeroJulio = !claveFechaExistente || forzarPrimeroJulio;
  const fechaIso = asignarPrimeroJulio
    ? FECHA_MIGRACION_FACTURACION_JULIO_ISO
    : String(facturaAnterior.fechaFacturacionIso || new Date(Number(facturaAnterior.fechaFacturacionMs)).toISOString());
  const fechaMs = asignarPrimeroJulio
    ? FECHA_MIGRACION_FACTURACION_JULIO_MS
    : Number(facturaAnterior.fechaFacturacionMs) || Date.parse(fechaIso);
  const periodo = asignarPrimeroJulio
    ? PERIODO_MIGRACION_FACTURACION_JULIO
    : /^\d{4}-\d{2}$/.test(String(facturaAnterior.periodoFacturacion || ''))
      ? String(facturaAnterior.periodoFacturacion)
      : claveMesDesdeClaveFecha(claveFechaDesdeValor(fechaIso) || claveFechaDesdeValor(fechaMs));
  const cantidadVisas = asignarPrimeroJulio
    ? cantidadVisasCaso(caso)
    : cantidadVisasFacturadasCaso(caso);
  const valorFacturado = valorFacturadoCaso(caso);
  const textoMigracion = asignarPrimeroJulio
    ? `Reconciliación de julio de 2026: se asignó el 1 de julio de 2026 como fecha contable a ${cantidadVisas} visa${cantidadVisas === 1 ? '' : 's'} histórica${cantidadVisas === 1 ? '' : 's'} marcada${cantidadVisas === 1 ? '' : 's'} como facturada${cantidadVisas === 1 ? '' : 's'}.`
    : 'Se completaron los datos técnicos de auditoría de una facturación histórica, conservando su fecha registrada.';
  return {
    caso: {
      ...caso,
      facturacion: {
        ...facturaAnterior,
        estadoFactura: 'facturada',
        fechaFacturacionIso: fechaIso,
        fechaFacturacionMs: fechaMs,
        periodoFacturacion: periodo,
        facturadoPor: String(facturaAnterior.facturadoPor || (asignarPrimeroJulio ? actor : 'Registro histórico SIGV') || 'Migración inicial SIGV'),
        fechaFacturacionInferida: facturaAnterior.fechaFacturacionInferida === true || asignarPrimeroJulio,
        origenFechaFacturacion: asignarPrimeroJulio
          ? 'Reconciliación inicial SIGV: facturación histórica asignada al 1 de julio de 2026.'
          : String(facturaAnterior.origenFechaFacturacion || 'Auditoría histórica completada conservando la fecha previamente registrada.'),
        valorFacturado,
        cantidadVisasFacturadas: cantidadVisas,
        migracionJulio2026Completada: true,
      },
      actualizadoPor: String(actor || 'Migración inicial SIGV'),
      updatedAtMs: Date.now(),
      historial: [...(caso.historial || []), evento('Migración', textoMigracion, 'Sistema SIGV')],
    },
    asignarPrimeroJulio,
    cantidadVisas,
  };
}

async function migrarFacturacionInicialJulio(casos = [], actor = '') {
  const candidatos = casos.filter(requiereMigracionFacturacionJulio);
  if (!candidatos.length) {
    return { casos, asesoriasMigradas: 0, visasMigradas: 0, errores: 0 };
  }

  const reemplazos = new Map();
  let visasMigradas = 0;
  let errores = 0;

  for (const caso of candidatos) {
    const preparada = prepararMigracionFacturacionJulio(caso, actor);
    const migrado = preparada.caso;
    try {
      const ahoraIso = new Date().toISOString();
      const guardado = await actualizarDocumentoConVersionRest('casos', migrado.id, { ...migrado, updatedAtIso: ahoraIso }, caso._firestoreUpdateTime);
      reemplazos.set(migrado.id, guardado);
      if (preparada.asignarPrimeroJulio) visasMigradas += preparada.cantidadVisas;
    } catch (error) {
      errores += 1;
      console.error(`No se pudo migrar la auditoría de facturación de ${caso.id}:`, error);
    }
  }

  return {
    casos: casos.map(caso => reemplazos.get(caso.id) || caso),
    asesoriasMigradas: reemplazos.size,
    visasMigradas,
    errores,
  };
}

function valorEstimadoCaso(caso = {}) {
  const valorGuardado = Number(caso.valorEstimado);
  return valorGuardado >= 0 && caso.valorEstimado !== undefined && caso.valorEstimado !== null
    ? valorGuardado
    : Number(caso.total) || 0;
}

function cantidadVisasEstimadasCaso(caso = {}) {
  const cantidadGuardada = Number(caso.cantidadVisasEstimadas);
  return cantidadGuardada > 0 ? cantidadGuardada : cantidadVisasCaso(caso);
}

function valorFacturadoCaso(caso = {}) {
  const valorGuardado = Number(caso.facturacion?.valorFacturado);
  return valorGuardado > 0 ? valorGuardado : Number(caso.total) || 0;
}

function cantidadVisasCaso(caso = {}) {
  return normalizarIntegrantes(caso).length || Number(caso.cantidad) || 1;
}

function cantidadVisasFacturadasCaso(caso = {}) {
  const cantidadGuardada = Number(caso.facturacion?.cantidadVisasFacturadas);
  return cantidadGuardada > 0 ? cantidadGuardada : cantidadVisasCaso(caso);
}

function claveMesDesdeClaveFecha(claveFecha = '') {
  return /^\d{4}-\d{2}-\d{2}$/.test(claveFecha) ? claveFecha.slice(0, 7) : '';
}

function ultimoDiaMes(year, month) {
  const dia = new Date(Date.UTC(year, month, 0, 12)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function limitesDesdeMes(mes = '') {
  if (!/^\d{4}-\d{2}$/.test(mes)) return { fechaDesde: '', fechaHasta: '' };
  const [year, month] = mes.split('-').map(Number);
  return {
    fechaDesde: `${mes}-01`,
    fechaHasta: ultimoDiaMes(year, month),
  };
}

function fechaDentroPeriodo(clave = '', fechaDesde = '', fechaHasta = '') {
  if (!clave) return false;
  return (!fechaDesde || clave >= fechaDesde) && (!fechaHasta || clave <= fechaHasta);
}

function etiquetaFechaCorta(clave = '') {
  const [year, month, day] = String(clave).split('-').map(Number);
  if (!year || !month || !day) return '';
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: ZONA_HORARIA_COLOMBIA,
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function etiquetaPeriodoDashboard(modoFecha, mesFiltro, fechaDesde, fechaHasta) {
  if (modoFecha === 'mes' && /^\d{4}-\d{2}$/.test(mesFiltro)) {
    return etiquetaMes(Number(mesFiltro.slice(0, 4)), Number(mesFiltro.slice(5, 7)));
  }
  if (fechaDesde && fechaHasta) return `${etiquetaFechaCorta(fechaDesde)} al ${etiquetaFechaCorta(fechaHasta)}`;
  if (fechaDesde) return `Desde ${etiquetaFechaCorta(fechaDesde)}`;
  if (fechaHasta) return `Hasta ${etiquetaFechaCorta(fechaHasta)}`;
  return 'Todas las fechas';
}

function tipoClienteEsPremium(tipoCliente = '') {
  const clave = normalizar(tipoCliente).replace(/[^a-z0-9]/g, '');
  return ['premiumafiliado', 'premiumnoafiliado', 'paquetepremiumafiliado', 'paquetepremiumnoafiliado'].includes(clave);
}

function casoPremiumPendiente(caso = {}) {
  const tipos = normalizarIntegrantes(caso).map(integrante => integrante.tipoCliente || integrante.tipoClienteKey);
  tipos.push(caso.tipoClienteKey, caso.tipoCliente);
  const esPremium = tipos.some(tipoClienteEsPremium);
  const estado = normalizar(caso.estadoManual || caso.estado || '');
  return esPremium && !estado.includes('finalizado');
}

function resumenFinancieroPeriodo(casos = [], fechaDesde = '', fechaHasta = '') {
  const resumen = {
    estimadoGenerado: 0,
    facturadoTotal: 0,
    facturadoMismoMes: 0,
    facturadoMesesAnteriores: 0,
    visasMesesAnteriores: 0,
    casosMesesAnteriores: [],
    facturadoOrigenNoIdentificado: 0,
    pendienteGenerado: 0,
    visasGeneradas: 0,
    visasFacturadas: 0,
    visasPendientes: 0,
    facturadasSinFecha: 0,
  };

  for (const caso of casos) {
    const fechaCreacion = claveCreacionCaso(caso);
    const creacionEnPeriodo = fechaDentroPeriodo(fechaCreacion, fechaDesde, fechaHasta);
    const cantidadVisas = cantidadVisasEstimadasCaso(caso);
    const valorActual = valorEstimadoCaso(caso);
    const esFacturada = caso.facturacion?.estadoFactura === 'facturada';

    if (creacionEnPeriodo) {
      resumen.estimadoGenerado += valorActual;
      resumen.visasGeneradas += cantidadVisas;
      if (!esFacturada) {
        resumen.pendienteGenerado += valorActual;
        resumen.visasPendientes += cantidadVisas;
      }
    }

    if (!esFacturada) continue;
    const fechaFactura = claveFacturacionCaso(caso);
    if (!fechaFactura) {
      resumen.facturadasSinFecha += 1;
      continue;
    }
    if (!fechaDentroPeriodo(fechaFactura, fechaDesde, fechaHasta)) continue;

    const valorFacturado = valorFacturadoCaso(caso);
    resumen.facturadoTotal += valorFacturado;
    resumen.visasFacturadas += cantidadVisasFacturadasCaso(caso);

    if (creacionEnPeriodo) resumen.facturadoMismoMes += valorFacturado;
    else if (fechaCreacion && fechaDesde && fechaCreacion < fechaDesde) {
      const cantidadFacturada = cantidadVisasFacturadasCaso(caso);
      resumen.facturadoMesesAnteriores += valorFacturado;
      resumen.visasMesesAnteriores += cantidadFacturada;
      resumen.casosMesesAnteriores.push({
        id: caso.id,
        nombre: textoClienteCaso(caso),
        fechaCreacion,
        fechaFactura,
        valorFacturado,
        cantidadVisas: cantidadFacturada,
      });
    }
    else resumen.facturadoOrigenNoIdentificado += valorFacturado;
  }

  return resumen;
}

function resumenFinancieroMes(casos = [], year, month) {
  const limites = limitesDesdeMes(claveMes(year, month));
  return resumenFinancieroPeriodo(casos, limites.fechaDesde, limites.fechaHasta);
}

function etiquetaMes(year, month) {
  return new Intl.DateTimeFormat('es-CO', {
    month: 'long',
    year: 'numeric',
    timeZone: ZONA_HORARIA_COLOMBIA,
  }).format(new Date(Date.UTC(year, month - 1, 1, 12)));
}

function claveMes(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function normalizar(texto = '') {
  return String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function normalizarEstadoProceso(estado = '') {
  const limpio = String(estado || '').trim();
  const equivalencias = {
    'Pendiente de documentos': 'Pendiente Documentación',
    'Listo para agendar asesoría': 'Pendiente Agendamiento de Asesoría',
    'Asesoría agendada': 'Asesoría Agendada',
    'DS-160 en revisión': 'Pendiente Documentación',
    'Pendiente firma / aprobación del cliente': 'Pendiente Documentación',
    'Enviado a cliente': 'Pendiente Facturación',
  };
  if (estadosProceso.includes(limpio)) return limpio;
  return equivalencias[limpio] || '';
}

function porcentajeDescuentoPorCantidad(cantidad = 1) {
  const totalIntegrantes = Number(cantidad) || 1;
  if (totalIntegrantes >= 5) return 0.15;
  if (totalIntegrantes >= 3) return 0.10;
  return 0;
}

function textoDescuentoPorCantidad(cantidad = 1) {
  const porcentaje = porcentajeDescuentoPorCantidad(cantidad);
  if (!porcentaje) return 'No aplica';
  return `${Math.round(porcentaje * 100)}% por ${cantidad} integrantes`;
}

function descuentoCantidadActivo(data = {}) {
  return data.aplicarDescuentoCantidad !== false;
}

function describirCambioDescuento(casoAnterior = {}, casoNuevo = {}) {
  const anterior = descuentoCantidadActivo(casoAnterior);
  const nuevo = descuentoCantidadActivo(casoNuevo);
  if (anterior === nuevo) return '';
  return nuevo
    ? 'Se activó el descuento automático por cantidad.'
    : 'Se desactivó el descuento automático por cantidad para esta asesoría.';
}

function estadoAutomaticoProceso(requeridos, data = {}) {
  const detalles = data.detalleIntegrantes || normalizarIntegrantes(data).map((integrante, indice) => {
    const tipoSolicitud = integrante.tipoSolicitudKey || integrante.tipoSolicitud;
    const requeridosIntegrante = documentosRequeridos(tipoSolicitud);
    const docs = integrante.documentosObj || integrante.documentos || {};
    const faltantes = requeridosIntegrante.filter(id => !docs[id]).map(id => ({ id, integrante: indice + 1 }));
    return { requeridos: requeridosIntegrante, faltantes };
  });

  const totalRequeridos = detalles.reduce((acc, detalle) => acc + detalle.requeridos.length, 0);
  const faltantes = detalles.flatMap(detalle => detalle.faltantes || []);

  if (totalRequeridos > 0 && faltantes.length === 0) return 'Pendiente Agendamiento de Asesoría';
  if (faltantes.length > 0 && faltantes.every(item => item.id === 'pagoAsesoria')) return 'Pendiente de pago Asesoría';
  return 'Pendiente Documentación';
}

function calcularIntegrante(integrante, config = configuracionBase, indice = 0, ajustesPrecio = {}) {
  const configuracion = normalizarConfiguracion(config);
  const tipoCliente = integrante.tipoClienteKey || integrante.tipoCliente || 'afiliado';
  const tipoSolicitud = integrante.tipoSolicitudKey || integrante.tipoSolicitud || 'primeraVez';
  const tarifaConfigurada = configuracion.tarifas[tipoCliente]?.[tipoSolicitud];
  const precioManual = precioManualIntegrante(ajustesPrecio, integrante.id);
  const tarifa = precioManual !== null ? precioManual : tarifaConfigurada;
  const requeridos = documentosRequeridos(tipoSolicitud);
  const docs = integrante.documentosObj || integrante.documentos || {};
  const completos = requeridos.filter(id => docs[id]).length;
  const faltantes = requeridos.filter(id => !docs[id]).map(id => ({ id, integrante: indice + 1, nombre: integrante.nombre || `Integrante ${indice + 1}` }));
  const fedex = tipoSolicitud === 'primeraVez' && integrante.fedex ? Number(integrante.fedex) : 0;
  const valorInformativoEnvioBogota = tipoSolicitud === 'renovacion' ? configuracion.costos.envioDocumentacionBogota : 0;
  const requiereDerechos = tipoSolicitud === 'primeraVez' || tipoSolicitud === 'renovacion';
  return {
    ...integrante,
    numero: indice + 1,
    tipoCliente,
    tipoSolicitud,
    tipoClienteKey: tipoCliente,
    tipoSolicitudKey: tipoSolicitud,
    tarifa,
    tarifaConfigurada,
    precioManual,
    precioPersonalizado: precioManual !== null,
    requeridos,
    completos,
    faltantes,
    documentosCompletos: completos === requeridos.length,
    fedex,
    valorInformativoEnvioBogota,
    requiereDerechos,
  };
}

function calcularCaso(data, config = configuracionBase) {
  const configuracion = normalizarConfiguracion(config);
  const integrantes = normalizarIntegrantes(data);
  const ajustesPrecio = normalizarAjustesPrecio(data.ajustesPrecio);
  const detalleIntegrantes = integrantes.map((integrante, indice) => calcularIntegrante(integrante, configuracion, indice, ajustesPrecio));
  const subtotalAsesoria = detalleIntegrantes.reduce((acc, detalle) => acc + (Number(detalle.tarifa) || 0), 0);
  const aplicarDescuentoCantidad = descuentoCantidadActivo(data);
  const porcentajeDescuento = aplicarDescuentoCantidad ? porcentajeDescuentoPorCantidad(detalleIntegrantes.length) : 0;
  const valorDescuento = Math.round(subtotalAsesoria * porcentajeDescuento);
  const totalPesos = Math.max(0, subtotalAsesoria - valorDescuento);
  const valorInformativoEnvioBogota = detalleIntegrantes.reduce((acc, detalle) => acc + (Number(detalle.valorInformativoEnvioBogota) || 0), 0);
  const fedex = detalleIntegrantes.reduce((acc, detalle) => acc + (Number(detalle.fedex) || 0), 0);
  const requiereDerechos = detalleIntegrantes.some(detalle => detalle.requiereDerechos);
  const requeridos = detalleIntegrantes.flatMap(detalle => detalle.requeridos.map(id => `${detalle.numero}-${id}`));
  const completos = detalleIntegrantes.reduce((acc, detalle) => acc + detalle.completos, 0);
  const documentosCompletos = requeridos.length > 0 && completos === requeridos.length;
  const estadoManualNormalizado = normalizarEstadoProceso(data.estadoManual);
  const estado = estadoManualNormalizado || estadoAutomaticoProceso(requeridos, { detalleIntegrantes });
  return {
    tarifa: subtotalAsesoria,
    subtotalAsesoria,
    aplicarDescuentoCantidad,
    porcentajeDescuento,
    valorDescuento,
    descuentoDescripcion: aplicarDescuentoCantidad ? textoDescuentoPorCantidad(detalleIntegrantes.length) : 'Desactivado manualmente',
    valorInformativoEnvioBogota,
    adicionalRenovacion: valorInformativoEnvioBogota,
    requiereDerechos,
    fedex,
    totalPesos,
    requeridos,
    completos,
    documentosCompletos,
    estado,
    derechosConsularesUsd: configuracion.costos.derechosConsularesUsd,
    detalleIntegrantes,
    cantidad: detalleIntegrantes.length,
  };
}

function calcularValorFacturacion(facturacion = {}, tipoClienteKey = 'afiliado', config = configuracionBase) {
  const configuracion = normalizarConfiguracion(config);
  const tipoTramite = facturacion.tipoTramite || 'primeraVez';
  const valor = configuracion.tarifas[tipoClienteKey]?.[tipoTramite];
  return valor === null || valor === undefined ? null : Number(valor);
}

function normalizarFacturacion(facturacion = {}, data = {}, config = configuracionBase, valorOverride = null) {
  const tipoTramite = facturacion.tipoTramite || data.tipoSolicitudKey || data.tipoSolicitud || 'primeraVez';
  const tipoClienteKey = data.tipoClienteKey || data.tipoCliente || 'afiliado';
  const valorCalculado = valorOverride !== null && valorOverride !== undefined
    ? Number(valorOverride)
    : calcularValorFacturacion({ tipoTramite }, tipoClienteKey, config);
  return {
    nombre: facturacion.nombre || '',
    cedulaNit: facturacion.cedulaNit || '',
    telefono: facturacion.telefono || '',
    direccion: facturacion.direccion || '',
    ciudad: facturacion.ciudad || '',
    nombreEmpresaAfiliada: data.requiereEmpresaAfiliada === false ? '' : (facturacion.nombreEmpresaAfiliada || ''),
    correo: facturacion.correo || '',
    tipoTramite,
    medioPago: facturacion.medioPago || '',
    estadoFactura: facturacion.estadoFactura === 'facturada' ? 'facturada' : 'porFacturar',
    fechaFacturacionIso: facturacion.estadoFactura === 'facturada' ? String(facturacion.fechaFacturacionIso || '') : '',
    fechaFacturacionMs: facturacion.estadoFactura === 'facturada' ? (Number(facturacion.fechaFacturacionMs) || 0) : 0,
    periodoFacturacion: facturacion.estadoFactura === 'facturada' ? String(facturacion.periodoFacturacion || '') : '',
    facturadoPor: facturacion.estadoFactura === 'facturada' ? String(facturacion.facturadoPor || '') : '',
    fechaFacturacionInferida: facturacion.estadoFactura === 'facturada' && facturacion.fechaFacturacionInferida === true,
    origenFechaFacturacion: facturacion.estadoFactura === 'facturada' ? String(facturacion.origenFechaFacturacion || '') : '',
    valorFacturado: facturacion.estadoFactura === 'facturada' ? (Number(facturacion.valorFacturado) || 0) : 0,
    cantidadVisasFacturadas: facturacion.estadoFactura === 'facturada' ? (Number(facturacion.cantidadVisasFacturadas) || 0) : 0,
    migracionJulio2026Completada: facturacion.estadoFactura === 'facturada' && facturacion.migracionJulio2026Completada === true,
    valor: valorCalculado || 0,
  };
}

function generarTextoFacturacion(facturacion = {}, tipoClienteKey = 'afiliado', tipoSolicitudKey = 'primeraVez', config = configuracionBase, valorOverride = null, cantidadIntegrantes = 1) {
  const datos = normalizarFacturacion(facturacion, { tipoClienteKey, tipoSolicitudKey }, config, valorOverride);
  const valor = valorOverride !== null && valorOverride !== undefined ? Number(valorOverride) : calcularValorFacturacion(datos, tipoClienteKey, config);
  const lineas = [
    'DATOS DE FACTURACIÓN',
    `Nombre: ${datos.nombre || 'Pendiente'}`,
    `Cédula o NIT: ${datos.cedulaNit || 'Pendiente'}`,
    `Teléfono: ${datos.telefono || 'Pendiente'}`,
    `Dirección: ${datos.direccion || 'Pendiente'}`,
    `Ciudad: ${datos.ciudad || 'Pendiente'}`,
    ...(datos.nombreEmpresaAfiliada ? [`Nombre de la empresa afiliada: ${datos.nombreEmpresaAfiliada}`] : []),
    `Correo: ${datos.correo || 'Pendiente'}`,
    `Tipo de trámite: ${textoSolicitud(datos.tipoTramite)}`,
    `Medio de pago: ${datos.medioPago || 'Pendiente'}`,
    `Estado de facturación: ${datos.estadoFactura === 'facturada' ? 'Facturada' : 'Por facturar'}`,
    ...(datos.estadoFactura === 'facturada' && (datos.fechaFacturacionIso || datos.fechaFacturacionMs)
      ? [`Fecha de facturación: ${fechaColombia(new Date(datos.fechaFacturacionIso || datos.fechaFacturacionMs))}`]
      : []),
    `Valor: ${valor === null || valor === undefined ? 'No aplica' : moneda(valor)}`,
  ];
  if (Number(cantidadIntegrantes) > 1) lineas.splice(1, 0, `Cantidad de integrantes: ${cantidadIntegrantes}`);
  return lineas.join('\n');
}

function textoSolicitud(id) {
  return tiposSolicitud.find(t => t.id === id)?.label || id;
}

function indiceALetras(indice = 0) {
  let n = Math.max(0, Number(indice) || 0);
  let letras = '';
  do {
    letras = String.fromCharCode(65 + (n % 26)) + letras;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letras;
}

function letrasAIndice(letras = 'A') {
  const limpio = String(letras || 'A').toUpperCase().replace(/[^A-Z]/g, '') || 'A';
  let indice = 0;
  for (const letra of limpio) indice = indice * 26 + (letra.charCodeAt(0) - 64);
  return Math.max(0, indice - 1);
}

function secuenciaDesdeIdCaso(id = '') {
  const limpio = String(id || '').trim().toUpperCase();
  const nuevoFormato = limpio.match(/^([A-Z]+)(\d{1,4})$/);
  if (nuevoFormato) {
    const grupo = letrasAIndice(nuevoFormato[1]);
    const numero = Number(nuevoFormato[2]);
    if (numero >= 1 && numero <= 9999) return grupo * 9999 + numero;
  }

  const formatoAnterior = limpio.match(/^CAS-\d{4}-(\d{1,4})$/);
  if (formatoAnterior) {
    const numero = Number(formatoAnterior[1]);
    if (numero >= 1 && numero <= 9999) return numero;
  }

  const soloNumero = limpio.match(/^(\d{1,4})$/);
  if (soloNumero) {
    const numero = Number(soloNumero[1]);
    if (numero >= 1 && numero <= 9999) return numero;
  }

  return 0;
}

function formatearIdCaso(secuencia = 1) {
  const segura = Math.max(1, Number(secuencia) || 1);
  const grupo = Math.floor((segura - 1) / 9999);
  const numero = ((segura - 1) % 9999) + 1;
  const prefijo = indiceALetras(grupo);
  const numeroTexto = String(numero).padStart(4, '0');
  return `${prefijo}${numeroTexto}`;
}

function generarId(casos) {
  const consecutivos = casos.map(c => secuenciaDesdeIdCaso(c.id)).filter(n => n > 0);
  const siguiente = consecutivos.length ? Math.max(...consecutivos) + 1 : 1;
  return formatearIdCaso(siguiente);
}

function evento(tipo, texto, asesor = 'Sistema') {
  const ahora = new Date();
  return {
    id: `${ahora.getTime()}-${Math.random().toString(16).slice(2)}`,
    fecha: fechaColombia(ahora),
    fechaIso: ahora.toISOString(),
    fechaMs: ahora.getTime(),
    tipo,
    texto,
    asesor,
  };
}

const casosIniciales = [
  {
    id: 'A0001', asesor: 'Milena', nombre: 'María Gómez', telefono: '3001234567', email: 'maria@email.com',
    tipoClienteKey: 'afiliado', tipoSolicitudKey: 'renovacion', tipoCliente: 'Afiliado', tipoSolicitud: 'Renovación',
    fedex: '', total: 305000, estado: 'Pendiente Agendamiento de Asesoría', documentos: '6/6',
    documentosObj: { foto: true, pasaporte: true, ds160: true, pagoAsesoria: true, visaAnterior: true, autorizacionEnvio: true },
    observacion: 'Pago validado. Pendiente agendamiento de asesoría.', seguimiento: 'Pendiente asignar horario de asesoría.',
    fechaAsesoria: '', horaAsesoria: '', facturacion: { nombre: 'María Gómez', cedulaNit: '', telefono: '3001234567', direccion: '', correo: 'maria@email.com', tipoTramite: 'renovacion', medioPago: 'Transferencia', valor: 150000 }, fechaCitaEmbajada: '', estadoManual: '',
    historial: [
      evento('Creación', 'Asesoría creada con documentos completos para renovación.', 'Milena'),
      evento('Seguimiento', 'Pendiente asignar horario de asesoría.', 'Milena'),
    ],
  },
  {
    id: 'A0002', asesor: 'Ximena', nombre: 'Carlos Pérez', telefono: '3159876543', email: 'carlos@email.com',
    tipoClienteKey: 'noAfiliado', tipoSolicitudKey: 'primeraVez', tipoCliente: 'No afiliado', tipoSolicitud: 'Primera vez',
    fedex: '', total: 190000, estado: 'Pendiente Documentación', documentos: '2/4',
    documentosObj: { foto: true, pasaporte: true, ds160: false, pagoAsesoria: false },
    observacion: 'Falta DS-160 y soporte de pago.', seguimiento: 'Cliente enviará documentos pendientes.',
    fechaAsesoria: '', horaAsesoria: '', facturacion: { nombre: 'Carlos Pérez', cedulaNit: '', telefono: '3159876543', direccion: '', correo: 'carlos@email.com', tipoTramite: 'primeraVez', medioPago: '', valor: 190000 }, fechaCitaEmbajada: '', estadoManual: '',
    historial: [evento('Creación', 'Asesoría creada. Falta DS-160 y soporte de pago.', 'Ximena')],
  },
];

function prepararCasoGuardado(caso, config = configuracionBase) {
  const configuracion = normalizarConfiguracion(config);
  const integrantes = normalizarIntegrantes(caso);
  const calc = calcularCaso({
    integrantes,
    ajustesPrecio: caso.ajustesPrecio,
    aplicarDescuentoCantidad: descuentoCantidadActivo(caso),
    estadoManual: caso.estadoManual,
  }, configuracion);
  const principal = integrantes[0] || crearIntegrante(1);
  const facturacionNormalizada = completarFechaFacturacionHistorica(
    caso,
    normalizarFacturacion(caso.facturacion, { tipoClienteKey: principal.tipoCliente, tipoSolicitudKey: principal.tipoSolicitud, requiereEmpresaAfiliada: hayIntegranteAfiliado(integrantes) }, configuracion, calc.totalPesos),
  );
  const valorEstimadoGuardado = caso.valorEstimado !== undefined && caso.valorEstimado !== null
    ? Number(caso.valorEstimado) || 0
    : Number(caso.total) || calc.totalPesos;
  const cantidadVisasEstimadasGuardada = Number(caso.cantidadVisasEstimadas) > 0
    ? Number(caso.cantidadVisasEstimadas)
    : Number(caso.cantidad) || integrantes.length;
  return {
    ...caso,
    cantidad: integrantes.length,
    integrantes: integrantes.map(serializarIntegrante),
    ajustesPrecio: normalizarAjustesPrecio(caso.ajustesPrecio),
    aplicarDescuentoCantidad: descuentoCantidadActivo(caso),
    subtotalAsesoria: calc.subtotalAsesoria,
    porcentajeDescuento: calc.porcentajeDescuento,
    valorDescuento: calc.valorDescuento,
    valorEstimado: valorEstimadoGuardado,
    cantidadVisasEstimadas: cantidadVisasEstimadasGuardada,
    asesor: caso.asesor || '',
    nombre: principal.nombre,
    telefono: principal.telefono,
    email: principal.email,
    tipoClienteKey: principal.tipoCliente,
    tipoSolicitudKey: principal.tipoSolicitud,
    tipoCliente: configuracion.tarifas[principal.tipoCliente]?.label || caso.tipoCliente,
    tipoSolicitud: textoSolicitud(principal.tipoSolicitud),
    fedex: principal.fedex || '',
    documentosObj: { ...principal.documentos },
    estadoManual: normalizarEstadoProceso(caso.estadoManual),
    total: calc.totalPesos,
    estado: calc.estado,
    documentos: `${calc.completos}/${calc.requeridos.length}`,
    facturacion: facturacionNormalizada,
    fechaCitaEmbajada: caso.fechaCitaEmbajada || '',
  };
}

function App() {
  const [logueado, setLogueado] = useState(false);
  const [usuarioAuth, setUsuarioAuth] = useState(null);
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [vista, setVista] = useState('dashboard');
  const [form, setForm] = useState(inicialFormulario);
  const [casoAbiertoId, setCasoAbiertoId] = useState(null);
  const [config, setConfigState] = useState(() => normalizarConfiguracion(configuracionBase));
  const [casos, setCasos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorConexion, setErrorConexion] = useState('');
  const [diagnostico, setDiagnostico] = useState('');
  const [perfil, setPerfil] = useState(null);
  const [usuariosSigv, setUsuariosSigv] = useState([]);
  const [seguridad, setSeguridad] = useState(() => normalizarSeguridad());
  const [requiereInicializacion, setRequiereInicializacion] = useState(false);
  const [inicializandoSeguridad, setInicializandoSeguridad] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [migracionFacturacion, setMigracionFacturacion] = useState({ estado: 'pendiente', asesoriasMigradas: 0, visasMigradas: 0, errores: 0 });

  useEffect(() => {
    if (!menuAbierto) return undefined;
    const cerrarConEscape = event => {
      if (event.key === 'Escape') setMenuAbierto(false);
    };
    window.addEventListener('keydown', cerrarConEscape);
    return () => window.removeEventListener('keydown', cerrarConEscape);
  }, [menuAbierto]);

  useEffect(() => {
    const cancelar = onAuthStateChanged(auth, user => {
      setUsuarioAuth(user);
      setLogueado(!!user);
      setCargando(!!user);
      if (!user) {
        setCasos([]);
        setUsuariosSigv([]);
        setPerfil(null);
        setSeguridad(normalizarSeguridad());
        setRequiereInicializacion(false);
        setConfigState(normalizarConfiguracion(configuracionBase));
        setMigracionFacturacion({ estado: 'pendiente', asesoriasMigradas: 0, visasMigradas: 0, errores: 0 });
      }
    });
    return cancelar;
  }, []);

  useEffect(() => {
    if (!usuarioAuth) return undefined;
    let activo = true;

    async function cargarDesdeFirestore() {
      setCargando(true);
      setErrorConexion('');
      setDiagnostico('');
      setRequiereInicializacion(false);
      setUsuariosSigv([]);
      try {
        const emailPerfil = claveUsuarioSigv(usuarioAuth.email);
        const [seguridadRemota, perfilRemoto] = await Promise.all([
          conTiempoLimite(obtenerDocumentoRest('configuracion', 'seguridad'), 18000, 'No respondió la configuración de seguridad de Firestore.'),
          conTiempoLimite(obtenerDocumentoRest('usuariosSigv', emailPerfil), 18000, 'No respondió el perfil de usuario SIGV.'),
        ]);

        if (!activo) return;

        let seguridadActual = normalizarSeguridad(seguridadRemota || {});
        setSeguridad(seguridadActual);

        if (!perfilRemoto) {
          setPerfil(null);
          setCasos([]);
          setConfigState(normalizarConfiguracion(configuracionBase));
          if (!seguridadActual.primerAdministradorConfigurado) {
            setRequiereInicializacion(true);
          } else {
            setPerfil(perfilSinAcceso(usuarioAuth, 'sinPerfil'));
          }
          return;
        }

        const perfilActual = normalizarUsuarioSigv(perfilRemoto, emailPerfil);
        setPerfil(perfilActual);

        if (!perfilActual.activo || !normalizarRolSigv(perfilActual.rol)) {
          setCasos([]);
          setConfigState(normalizarConfiguracion(configuracionBase));
          return;
        }

        if (perfilActual.rol === 'administrador' && !seguridadActual.primerAdministradorConfigurado) {
          try {
            const seguridadCreada = await conTiempoLimite(
              activarSeguridadAdministradorRest(emailPerfil),
              20000,
              'No respondió la activación de seguridad en Firestore.'
            );
            seguridadActual = normalizarSeguridad(seguridadCreada || {});
            setSeguridad(seguridadActual);
          } catch (errorSeguridad) {
            console.error('No se pudo cerrar automáticamente la inicialización de seguridad:', errorSeguridad);
            setErrorConexion(`Tu perfil de Administrador fue validado, pero falta activar el cierre de seguridad. Detalle: ${errorSeguridad.message || 'error desconocido'}.`);
          }
        }

        const esAdmin = perfilActual.rol === 'administrador';
        const [configRemota, casosRemotos, usuariosRemotos] = await Promise.all([
          conTiempoLimite(obtenerDocumentoRest('configuracion', 'general'), 18000, 'No respondió la configuración de Firestore.'),
          conTiempoLimite(listarColeccionRest('casos'), 18000, 'No respondió la colección de asesorías de Firestore.'),
          esAdmin
            ? conTiempoLimite(listarColeccionRest('usuariosSigv'), 18000, 'No respondió la colección de usuarios SIGV.')
            : Promise.resolve([]),
        ]);

        if (!activo) return;

        const configLimpia = normalizarConfiguracion(configRemota || configuracionBase);
        setConfigState(configLimpia);
        localStorage.setItem('sigv_configuracion_fase5_backup', JSON.stringify(configLimpia));

        let lista = casosRemotos
          .map(item => prepararCasoGuardado(item, configLimpia))
          .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));

        if (esAdmin) {
          setMigracionFacturacion({ estado: 'revisando', asesoriasMigradas: 0, visasMigradas: 0, errores: 0 });
          const resultadoMigracion = await migrarFacturacionInicialJulio(lista, emailPerfil);
          lista = resultadoMigracion.casos;
          setMigracionFacturacion({
            estado: resultadoMigracion.errores > 0 ? 'parcial' : resultadoMigracion.asesoriasMigradas > 0 ? 'completada' : 'sinPendientes',
            asesoriasMigradas: resultadoMigracion.asesoriasMigradas,
            visasMigradas: resultadoMigracion.visasMigradas,
            errores: resultadoMigracion.errores,
          });
        } else {
          setMigracionFacturacion({ estado: 'soloAdministrador', asesoriasMigradas: 0, visasMigradas: 0, errores: 0 });
        }

        setCasos(lista);
        localStorage.setItem('sigv_casos_fase5_backup', JSON.stringify(lista));

        if (esAdmin) {
          setUsuariosSigv(ordenarUsuariosSigv(
            usuariosRemotos.map(item => normalizarUsuarioSigv(item, item.email || item.id))
          ));
        }
      } catch (error) {
        if (!activo) return;
        console.error('Error cargando Firestore por REST:', error);
        setPerfil(null);
        setCasos([]);
        setUsuariosSigv([]);
        setConfigState(normalizarConfiguracion(configuracionBase));
        setErrorConexion(`No se pudo validar de forma segura el perfil y la información en Firestore. No se concedieron permisos provisionales. Detalle: ${error.message || error.code || 'error desconocido'}.`);
      } finally {
        if (activo) setCargando(false);
      }
    }

    cargarDesdeFirestore();

    return () => {
      activo = false;
    };
  }, [usuarioAuth]);

  useEffect(() => {
    setCasos(prev => prev.map(c => prepararCasoGuardado(c, config)));
  }, [config]);

  const permisos = useMemo(() => permisosDesdePerfil(perfil), [perfil]);

  useEffect(() => {
    if (!perfil || puedeVerVista(vista, permisos)) return;
    setVista('dashboard');
    setCasoAbiertoId(null);
  }, [perfil, permisos, vista]);

  const calculo = useMemo(() => calcularCaso(form, config), [form, config]);
  const casoAbierto = casos.find(c => c.id === casoAbiertoId);

  async function iniciarSesion(e) {
    e?.preventDefault?.();
    if (!usuario.trim() || !clave.trim()) {
      alert('Debes ingresar correo y contraseña.');
      return;
    }
    try {
      setGuardando(true);
      await signInWithEmailAndPassword(auth, usuario.trim(), clave);
    } catch (error) {
      console.error('Error de login:', error);
      alert('No se pudo iniciar sesión. Verifica que el usuario exista en Firebase Authentication y que la contraseña sea correcta.');
    } finally {
      setGuardando(false);
    }
  }

  async function cerrarSesion() {
    await signOut(auth);
    setVista('dashboard');
    setCasoAbiertoId(null);
  }

  async function inicializarSeguridadInicial() {
    const email = claveUsuarioSigv(usuarioAuth?.email);
    if (!email) {
      alert('No se pudo identificar el correo autenticado.');
      return;
    }
    const confirma = window.confirm(`Este correo quedará registrado como primer Administrador de SIGV:\n\n${email}\n\nDespués de confirmar, los usuarios sin perfil ya no podrán ingresar.`);
    if (!confirma) return;

    try {
      setInicializandoSeguridad(true);
      const resultado = await conTiempoLimite(
        inicializarPrimerAdministradorRest({
          email,
          nombre: usuarioAuth?.displayName || email,
        }),
        25000,
        'Firestore no respondió al configurar el primer Administrador.'
      );
      setPerfil(normalizarUsuarioSigv(resultado.usuario, email));
      setSeguridad(normalizarSeguridad(resultado.seguridad));
      setRequiereInicializacion(false);
      window.location.reload();
    } catch (error) {
      console.error('Error inicializando seguridad SIGV:', error);
      alert(`No se pudo configurar el primer Administrador. Es posible que otro usuario ya haya completado la inicialización. Detalle: ${error.message || 'error desconocido'}.`);
    } finally {
      setInicializandoSeguridad(false);
    }
  }

  async function activarSeguridadManual() {
    if (!permisos.esAdministrador) {
      alert('Solo un Administrador activo puede activar la seguridad.');
      return false;
    }
    try {
      setGuardando(true);
      const seguridadCreada = await conTiempoLimite(
        activarSeguridadAdministradorRest(usuarioAuth?.email),
        20000,
        'Firestore no respondió al activar la seguridad.'
      );
      setSeguridad(normalizarSeguridad(seguridadCreada));
      setErrorConexion('');
      alert('Seguridad activada. La inicialización del primer Administrador quedó cerrada.');
      return true;
    } catch (error) {
      console.error('Error activando seguridad:', error);
      alert(`No se pudo activar la seguridad. Detalle: ${error.message || 'error desconocido'}.`);
      return false;
    } finally {
      setGuardando(false);
    }
  }

  async function ejecutarDiagnosticoFirestore() {
    try {
      setDiagnostico('Ejecutando prueba de conexión con Firestore...');
      const resultado = await diagnosticarFirestoreRest();
      setDiagnostico(`Conexión Firestore OK por REST. Tiempo aproximado: ${resultado.ms} ms.`);
      setErrorConexion('');
    } catch (error) {
      console.error('Diagnóstico Firestore:', error);
      setDiagnostico(`Diagnóstico Firestore falló: ${error.message || error.code || 'error desconocido'}.`);
    }
  }

  function validarFormulario() {
    if (!form.asesor.trim()) return 'Debes ingresar el nombre del asesor.';
    const integrantes = normalizarIntegrantes(form);
    if (!integrantes.length) return 'Debes registrar al menos un integrante.';
    for (const [indice, integrante] of integrantes.entries()) {
      const numero = indice + 1;
      if (!integrante.nombre.trim()) return `Debes ingresar el nombre completo del integrante ${numero}.`;
      if (!integrante.telefono.trim()) return `Debes ingresar el teléfono del integrante ${numero}.`;
      const tarifa = config.tarifas[integrante.tipoCliente]?.[integrante.tipoSolicitud];
      if (tarifa === null || tarifa === undefined) return `La combinación seleccionada para el integrante ${numero} no aplica. Cambia el tipo de cliente o solicitud.`;
    }
    return '';
  }

  async function guardarCaso(e) {
    e.preventDefault();
    if (!permisos.puedeCrearCasos) {
      alert('Tu rol no permite crear asesorías.');
      return;
    }
    const error = validarFormulario();
    if (error) {
      alert(error);
      return;
    }
    const integrantes = normalizarIntegrantes(form);
    const principal = integrantes[0];
    let id = generarId(casos);
    const creadoPor = usuarioAuth?.email || 'Sistema';
    const nuevo = {
      id,
      asesor: form.asesor.trim(),
      cantidad: integrantes.length,
      integrantes: integrantes.map(serializarIntegrante),
      ajustesPrecio: normalizarAjustesPrecio(form.ajustesPrecio),
      aplicarDescuentoCantidad: descuentoCantidadActivo(form),
      nombre: principal.nombre.trim(),
      telefono: principal.telefono.trim(),
      email: principal.email.trim(),
      tipoClienteKey: principal.tipoCliente,
      tipoSolicitudKey: principal.tipoSolicitud,
      tipoCliente: config.tarifas[principal.tipoCliente].label,
      tipoSolicitud: textoSolicitud(principal.tipoSolicitud),
      fedex: principal.fedex,
      total: calculo.totalPesos,
      valorEstimado: calculo.totalPesos,
      cantidadVisasEstimadas: integrantes.length,
      subtotalAsesoria: calculo.subtotalAsesoria,
      porcentajeDescuento: calculo.porcentajeDescuento,
      valorDescuento: calculo.valorDescuento,
      estado: calculo.estado,
      documentos: `${calculo.completos}/${calculo.requeridos.length}`,
      documentosObj: { ...principal.documentos },
      observacion: form.observacion,
      seguimiento: form.seguimiento || 'Asesoría creada. Pendiente seguimiento.',
      fechaAsesoria: form.fechaAsesoria,
      horaAsesoria: form.horaAsesoria,
      facturacion: facturacionConFecha(form.facturacion, {}, { tipoClienteKey: principal.tipoCliente, tipoSolicitudKey: principal.tipoSolicitud, requiereEmpresaAfiliada: hayIntegranteAfiliado(integrantes) }, config, calculo.totalPesos, integrantes.length, new Date(), creadoPor),
      fechaCitaEmbajada: form.fechaCitaEmbajada,
      estadoManual: form.estadoManual,
      creadoPor,
      actualizadoPor: creadoPor,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      historial: [
        evento('Creación', `Asesoría creada por ${form.asesor.trim()}. Integrantes: ${integrantes.length}. Documentos recibidos: ${calculo.completos}/${calculo.requeridos.length}. Descuento por cantidad: ${descuentoCantidadActivo(form) ? 'activado' : 'desactivado'}.`, form.asesor.trim()),
      ],
    };

    try {
      setGuardando(true);
      let guardado = null;
      for (let intento = 1; intento <= 5; intento += 1) {
        const ahoraCreacion = new Date();
        const candidato = {
          ...nuevo,
          id,
          createdAtMs: ahoraCreacion.getTime(),
          updatedAtMs: ahoraCreacion.getTime(),
          createdAtIso: ahoraCreacion.toISOString(),
          updatedAtIso: ahoraCreacion.toISOString(),
        };
        try {
          guardado = await conTiempoLimite(
            crearDocumentoSiNoExisteRest('casos', id, candidato),
            20000,
            'Firestore no respondió al crear la asesoría en 20 segundos.',
          );
          break;
        } catch (errorCreacion) {
          if (![409, 412].includes(errorCreacion?.status) || intento === 5) throw errorCreacion;
          const casosServidor = await listarColeccionRest('casos');
          id = generarId(casosServidor);
        }
      }
      if (!guardado) throw new Error('No fue posible reservar un consecutivo único para la asesoría.');
      setCasos(prev => [guardado, ...prev.filter(c => c.id !== guardado.id)]);
      setForm(inicialFormulario());
      setCasoAbiertoId(guardado.id);
      setVista('detalleCaso');
    } catch (error) {
      console.error('Error guardando caso:', error);
      alert(`No se pudo guardar la asesoría en Firestore. Detalle: ${error.message || error.code || 'error desconocido'}. Revisa la conexión, las reglas de seguridad y que Firestore Database esté activo.`);
    } finally {
      setGuardando(false);
    }
  }

  function abrirCaso(id) {
    if (!puedeVerVista('detalleCaso', permisos)) {
      alert('Tu rol no permite abrir asesorías.');
      return;
    }
    setCasoAbiertoId(id);
    setVista('detalleCaso');
  }

  async function actualizarCaso(casoActualizado, motivo = 'Asesoría actualizada desde detalle.') {
    if (!permisos.puedeEditarCasos) {
      alert('Tu rol no permite editar asesorías.');
      return;
    }
    const integrantes = normalizarIntegrantes(casoActualizado);
    const principal = integrantes[0] || crearIntegrante(1);
    const calc = calcularCaso({
      integrantes,
      ajustesPrecio: casoActualizado.ajustesPrecio,
      aplicarDescuentoCantidad: descuentoCantidadActivo(casoActualizado),
      estadoManual: casoActualizado.estadoManual,
    }, config);
    const actualizadoPor = usuarioAuth?.email || 'Sistema';
    const casoAnteriorGuardado = casos.find(item => item.id === casoActualizado.id) || {};
    const ahoraActualizacion = new Date();
    const estabaFacturada = casoAnteriorGuardado.facturacion?.estadoFactura === 'facturada';
    const seguiraFacturada = casoActualizado.facturacion?.estadoFactura === 'facturada';
    const conservarEstimadoHistorico = estabaFacturada && seguiraFacturada;
    const valorEstimado = conservarEstimadoHistorico
      ? valorEstimadoCaso(casoAnteriorGuardado)
      : calc.totalPesos;
    const cantidadVisasEstimadas = conservarEstimadoHistorico
      ? cantidadVisasEstimadasCaso(casoAnteriorGuardado)
      : integrantes.length;
    const actualizado = {
      ...casoActualizado,
      cantidad: integrantes.length,
      integrantes: integrantes.map(serializarIntegrante),
      ajustesPrecio: normalizarAjustesPrecio(casoActualizado.ajustesPrecio),
      aplicarDescuentoCantidad: descuentoCantidadActivo(casoActualizado),
      nombre: principal.nombre,
      telefono: principal.telefono,
      email: principal.email,
      tipoClienteKey: principal.tipoCliente,
      tipoSolicitudKey: principal.tipoSolicitud,
      tipoCliente: config.tarifas[principal.tipoCliente]?.label || casoActualizado.tipoCliente,
      tipoSolicitud: textoSolicitud(principal.tipoSolicitud),
      fedex: principal.fedex || '',
      documentosObj: { ...principal.documentos },
      total: calc.totalPesos,
      valorEstimado,
      cantidadVisasEstimadas,
      subtotalAsesoria: calc.subtotalAsesoria,
      porcentajeDescuento: calc.porcentajeDescuento,
      valorDescuento: calc.valorDescuento,
      estado: calc.estado,
      documentos: `${calc.completos}/${calc.requeridos.length}`,
      facturacion: facturacionConFecha(casoActualizado.facturacion, casoAnteriorGuardado.facturacion, { tipoClienteKey: principal.tipoCliente, tipoSolicitudKey: principal.tipoSolicitud, requiereEmpresaAfiliada: hayIntegranteAfiliado(integrantes) }, config, calc.totalPesos, integrantes.length, ahoraActualizacion, actualizadoPor),
      fechaCitaEmbajada: casoActualizado.fechaCitaEmbajada || '',
      actualizadoPor,
      updatedAtMs: Date.now(),
      historial: [...(casoActualizado.historial || []), evento('Actualización', motivo, casoActualizado.asesor || 'Sistema')],
    };

    try {
      setGuardando(true);
      const guardado = await conTiempoLimite(actualizarDocumentoConVersionRest('casos', actualizado.id, {
        ...actualizado,
        updatedAtIso: new Date().toISOString(),
      }, casoAnteriorGuardado._firestoreUpdateTime), 20000, 'Firestore no respondió al actualizar la asesoría en 20 segundos.');
      setCasos(prev => prev.map(c => c.id === actualizado.id ? guardado : c));
      setCasoAbiertoId(actualizado.id);
    } catch (error) {
      console.error('Error actualizando caso:', error);
      alert([409, 412].includes(error?.status)
        ? 'Otra persona modificó esta asesoría mientras la tenías abierta. Tus cambios no sobrescribieron la información nueva. Recarga la página, revisa el registro actualizado e inténtalo nuevamente.'
        : `No se pudo actualizar la asesoría en Firestore. Detalle: ${error.message || error.code || 'error desconocido'}.`);
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarFechaCreacionCaso(casoId, fechaNuevaClave) {
    if (!permisos.puedeCambiarFechaCreacion) {
      alert('Solo un Administrador activo puede cambiar la fecha de creación.');
      return false;
    }
    const casoAnterior = casos.find(item => item.id === casoId);
    if (!casoAnterior) {
      alert('No se encontró la asesoría que deseas actualizar.');
      return false;
    }
    const fechaNueva = fechaCreacionDesdeClave(fechaNuevaClave);
    const hoy = claveFechaDesdeValor(new Date());
    if (!fechaNueva) {
      alert('Selecciona una fecha de creación válida.');
      return false;
    }
    if (fechaNuevaClave > hoy) {
      alert('La fecha de creación no puede estar en el futuro.');
      return false;
    }
    const fechaAnteriorClave = claveCreacionCaso(casoAnterior);
    if (fechaNuevaClave === fechaAnteriorClave) {
      alert('La fecha seleccionada es igual a la fecha de creación actual.');
      return false;
    }
    const usuarioCambio = usuarioAuth?.email || perfil?.email || 'Administrador SIGV';
    const confirma = window.confirm(`Vas a cambiar la fecha de creación de ${casoId}.\n\nFecha anterior: ${fechaLargaDesdeClave(fechaAnteriorClave)}\nFecha nueva: ${fechaLargaDesdeClave(fechaNuevaClave)}\n\nEste cambio afectará filtros, Dashboard, calendario, métricas y exportaciones. ¿Deseas confirmar?`);
    if (!confirma) return false;

    const movimiento = {
      ...evento('Cambio de fecha de creación', `Fecha anterior: ${fechaAnteriorClave || 'no disponible'}. Fecha nueva: ${fechaNuevaClave}. Cambio realizado por ${usuarioCambio}.`, usuarioCambio),
      fechaAnterior: fechaAnteriorClave || '',
      fechaNueva: fechaNuevaClave,
      usuarioCambio,
    };
    const actualizado = {
      ...casoAnterior,
      createdAtIso: fechaNueva.toISOString(),
      createdAtMs: fechaNueva.getTime(),
      actualizadoPor: usuarioCambio,
      updatedAtIso: new Date().toISOString(),
      updatedAtMs: Date.now(),
      historial: [...(casoAnterior.historial || []), movimiento],
    };

    try {
      setGuardando(true);
      const guardado = await conTiempoLimite(actualizarDocumentoConVersionRest('casos', casoId, actualizado, casoAnterior._firestoreUpdateTime), 20000, 'Firestore no respondió al cambiar la fecha de creación en 20 segundos.');
      setCasos(prev => prev.map(item => item.id === casoId ? guardado : item));
      setCasoAbiertoId(casoId);
      return true;
    } catch (error) {
      console.error('Error cambiando fecha de creación:', error);
      alert([409, 412].includes(error?.status) ? 'Otra persona modificó esta asesoría. La fecha no fue sobrescrita; recarga y revisa la información actual.' : `No se pudo cambiar la fecha de creación en Firestore. Detalle: ${error.message || error.code || 'error desconocido'}.`);
      return false;
    } finally {
      setGuardando(false);
    }
  }

  async function corregirFacturacionRegistrada(casoId, { valorFacturadoNuevo, tipoTramiteNuevo, fechaFacturacionNueva }) {
    if (!permisos.puedeCorregirFacturacion) {
      alert('Solo un Administrador activo puede corregir una facturación registrada.');
      return false;
    }
    const casoAnterior = casos.find(item => item.id === casoId);
    if (!casoAnterior || casoAnterior.facturacion?.estadoFactura !== 'facturada') {
      alert('La asesoría no tiene una facturación registrada que pueda corregirse.');
      return false;
    }
    const valorNuevo = Number(valorFacturadoNuevo);
    if (!Number.isFinite(valorNuevo) || valorNuevo <= 0) {
      alert('Ingresa un valor facturado válido mayor que cero.');
      return false;
    }
    if (!tiposSolicitud.some(item => item.id === tipoTramiteNuevo)) {
      alert('Selecciona un tipo de trámite válido.');
      return false;
    }
    const fechaNueva = fechaCreacionDesdeClave(fechaFacturacionNueva);
    if (!fechaNueva) {
      alert('Selecciona una fecha de facturación válida.');
      return false;
    }
    if (fechaFacturacionNueva > claveFechaDesdeValor(new Date())) {
      alert('La fecha de facturación no puede estar en el futuro.');
      return false;
    }
    const valorAnterior = valorFacturadoCaso(casoAnterior);
    const tipoAnterior = casoAnterior.facturacion?.tipoTramite || casoAnterior.tipoSolicitudKey || 'primeraVez';
    const fechaAnterior = claveFacturacionCaso(casoAnterior);
    if (valorNuevo === valorAnterior && tipoTramiteNuevo === tipoAnterior && fechaFacturacionNueva === fechaAnterior) {
      alert('No hay cambios para guardar en la facturación registrada.');
      return false;
    }
    const usuarioCambio = usuarioAuth?.email || perfil?.email || 'Administrador SIGV';
    const confirma = window.confirm(`Vas a corregir una facturación histórica de ${casoId}.\n\nValor anterior: ${moneda(valorAnterior)}\nValor nuevo: ${moneda(valorNuevo)}\nTipo anterior: ${textoSolicitud(tipoAnterior)}\nTipo nuevo: ${textoSolicitud(tipoTramiteNuevo)}\nFecha anterior: ${fechaAnterior || 'no disponible'}\nFecha nueva: ${fechaFacturacionNueva}\n\nEste cambio afectará las métricas del periodo correspondiente. ¿Deseas confirmar?`);
    if (!confirma) return false;

    const movimiento = {
      ...evento('Corrección de facturación', `Valor facturado anterior: ${moneda(valorAnterior)}. Valor facturado nuevo: ${moneda(valorNuevo)}. Tipo de trámite anterior: ${textoSolicitud(tipoAnterior)}. Tipo nuevo: ${textoSolicitud(tipoTramiteNuevo)}. Fecha de facturación anterior: ${fechaAnterior || 'no disponible'}. Fecha nueva: ${fechaFacturacionNueva}. Corrección realizada por ${usuarioCambio}.`, usuarioCambio),
      valorFacturadoAnterior: valorAnterior,
      valorFacturadoNuevo: valorNuevo,
      tipoTramiteAnterior: tipoAnterior,
      tipoTramiteNuevo,
      fechaFacturacionAnterior: fechaAnterior || '',
      fechaFacturacionNueva,
      usuarioCambio,
    };
    const actualizado = {
      ...casoAnterior,
      facturacion: {
        ...casoAnterior.facturacion,
        valorFacturado: valorNuevo,
        tipoTramite: tipoTramiteNuevo,
        fechaFacturacionIso: fechaNueva.toISOString(),
        fechaFacturacionMs: fechaNueva.getTime(),
        periodoFacturacion: fechaFacturacionNueva.slice(0, 7),
        fechaFacturacionInferida: false,
        origenFechaFacturacion: 'Fecha corregida por Administrador con registro de auditoría.',
        corregidoPor: usuarioCambio,
        corregidoAtIso: new Date().toISOString(),
        corregidoAtMs: Date.now(),
      },
      actualizadoPor: usuarioCambio,
      updatedAtIso: new Date().toISOString(),
      updatedAtMs: Date.now(),
      historial: [...(casoAnterior.historial || []), movimiento],
    };

    try {
      setGuardando(true);
      const guardado = await conTiempoLimite(actualizarDocumentoConVersionRest('casos', casoId, actualizado, casoAnterior._firestoreUpdateTime), 20000, 'Firestore no respondió al corregir la facturación en 20 segundos.');
      setCasos(prev => prev.map(item => item.id === casoId ? guardado : item));
      setCasoAbiertoId(casoId);
      return true;
    } catch (error) {
      console.error('Error corrigiendo facturación registrada:', error);
      alert([409, 412].includes(error?.status) ? 'Otra persona modificó esta asesoría. La corrección no sobrescribió esos cambios; recarga y revisa la información actual.' : `No se pudo corregir la facturación en Firestore. Detalle: ${error.message || error.code || 'error desconocido'}.`);
      return false;
    } finally {
      setGuardando(false);
    }
  }

  async function guardarConfigFirestore(nuevaConfig) {
    if (!permisos.puedeEditarConfiguracion) {
      alert('Solo el Administrador puede editar la configuración general.');
      return;
    }
    const limpia = normalizarConfiguracion(nuevaConfig);
    try {
      setGuardando(true);
      await conTiempoLimite(guardarDocumentoRest('configuracion', 'general', {
        ...limpia,
        updatedAtIso: new Date().toISOString(),
        updatedAtMs: Date.now(),
        actualizadoPor: usuarioAuth?.email || 'Sistema',
      }), 20000, 'Firestore no respondió al guardar la configuración en 20 segundos.');
      setConfigState(limpia);
      localStorage.setItem('sigv_configuracion_fase5_backup', JSON.stringify(limpia));
    } catch (error) {
      console.error('Error guardando configuración:', error);
      alert(`No se pudo guardar la configuración en Firestore. Detalle: ${error.message || error.code || 'error desconocido'}.`);
      throw error;
    } finally {
      setGuardando(false);
    }
  }


  async function guardarUsuarioSigv(usuarioEditado) {
    if (!permisos.puedeEditarConfiguracion) {
      alert('Solo el Administrador puede administrar usuarios y roles.');
      return false;
    }
    const email = claveUsuarioSigv(usuarioEditado.email);
    if (!email || !email.includes('@')) {
      alert('Debes ingresar un correo válido para el usuario.');
      return false;
    }
    const administradorPrincipal = claveUsuarioSigv(seguridad?.primerAdministradorEmail);
    if (email === administradorPrincipal && (normalizarRolSigv(usuarioEditado.rol) !== 'administrador' || usuarioEditado.activo !== true)) {
      alert('El Administrador principal protegido no puede quedar inactivo ni cambiarse a Asesor.');
      return false;
    }

    const usuarioLimpio = normalizarUsuarioSigv({
      ...usuarioEditado,
      id: email,
      email,
      rol: normalizarRolSigv(usuarioEditado.rol),
      updatedAtIso: new Date().toISOString(),
      updatedAtMs: Date.now(),
      actualizadoPor: usuarioAuth?.email || 'Sistema',
      creadoEnFase5A: true,
      provisional: false,
    }, email);

    const listaProyectada = [
      ...usuariosSigv.filter(u => claveUsuarioSigv(u.email) !== email),
      usuarioLimpio,
    ];
    if (!hayAdministradorActivoGuardado(listaProyectada)) {
      alert('No se puede guardar este cambio: SIGV debe conservar siempre al menos un Administrador activo guardado en Firestore.');
      return false;
    }

    try {
      setGuardando(true);
      await conTiempoLimite(guardarDocumentoRest('usuariosSigv', email, usuarioLimpio), 20000, 'Firestore no respondió al guardar el usuario en 20 segundos.');
      setUsuariosSigv(prev => {
        const sinDuplicado = prev.filter(u => claveUsuarioSigv(u.email) !== email);
        return ordenarUsuariosSigv([...sinDuplicado, usuarioLimpio]);
      });
      if (claveUsuarioSigv(usuarioAuth?.email) === email) setPerfil(usuarioLimpio);
      return true;
    } catch (error) {
      console.error('Error guardando usuario SIGV:', error);
      alert(`No se pudo guardar el usuario/rol en Firestore. Detalle: ${error.message || error.code || 'error desconocido'}.`);
      return false;
    } finally {
      setGuardando(false);
    }
  }

  async function reiniciarRolesSigv() {
    if (!permisos.puedeEditarConfiguracion) {
      alert('Solo el Administrador puede reiniciar roles.');
      return;
    }
    const emailActual = claveUsuarioSigv(usuarioAuth?.email);
    if (!emailActual) {
      alert('No se pudo identificar el correo del usuario autenticado.');
      return;
    }
    const confirma = window.confirm('Esta acción restablecerá los roles: tu usuario y el Administrador principal protegido conservarán rol Administrador; los demás usuarios quedarán como Asesor activo. ¿Deseas continuar?');
    if (!confirma) return;

    const base = usuariosSigv.length ? usuariosSigv : [perfilAdministradorAutenticado(usuarioAuth)];
    const sinDuplicados = new Map(base.map(u => [claveUsuarioSigv(u.email), u]));
    if (!sinDuplicados.has(emailActual)) {
      sinDuplicados.set(emailActual, perfilAdministradorAutenticado(usuarioAuth));
    }

    const ahoraIso = new Date().toISOString();
    const ahoraMs = Date.now();
    const reiniciados = Array.from(sinDuplicados.values()).map(usuario => {
      const email = claveUsuarioSigv(usuario.email);
      return normalizarUsuarioSigv({
        ...usuario,
        id: email,
        email,
        rol: email === emailActual || email === claveUsuarioSigv(seguridad?.primerAdministradorEmail) ? 'administrador' : 'asesor',
        activo: true,
        provisional: false,
        reiniciadoEnFase5A: true,
        updatedAtIso: ahoraIso,
        updatedAtMs: ahoraMs,
        actualizadoPor: emailActual,
      }, email);
    });

    if (!hayAdministradorActivo(reiniciados)) {
      alert('No se pudo reiniciar roles porque no quedó ningún Administrador activo.');
      return;
    }

    try {
      setGuardando(true);
      await Promise.all(reiniciados.map(usuario => conTiempoLimite(
        guardarDocumentoRest('usuariosSigv', usuario.email, usuario),
        20000,
        `Firestore no respondió al reiniciar el usuario ${usuario.email}.`
      )));
      const ordenados = ordenarUsuariosSigv(reiniciados);
      setUsuariosSigv(ordenados);
      const perfilNuevo = ordenados.find(u => claveUsuarioSigv(u.email) === emailActual) || perfilAdministradorAutenticado(usuarioAuth);
      setPerfil(perfilNuevo);
      alert('Roles reiniciados correctamente. Tu usuario y el Administrador principal protegido conservaron acceso de Administrador; los demás usuarios quedaron como Asesor activo.');
    } catch (error) {
      console.error('Error reiniciando roles SIGV:', error);
      alert(`No se pudieron reiniciar los roles en Firestore. Detalle: ${error.message || error.code || 'error desconocido'}.`);
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarCaso(id) {
    if (!permisos.puedeEliminarCasos) {
      alert('Solo el Administrador puede eliminar asesorías.');
      return;
    }
    const caso = casos.find(c => c.id === id);
    if (!caso) return;
    const confirma = window.confirm(`Vas a eliminar la asesoría ${caso.id} de ${textoClienteCaso(caso)}. Esta acción debe usarse solo para correcciones excepcionales. ¿Deseas continuar?`);
    if (!confirma) return;
    const clave = window.prompt('Para confirmar la eliminación escribe exactamente: ELIMINAR');
    if (clave !== 'ELIMINAR') {
      alert('La asesoría no fue eliminada porque no se escribió la confirmación exacta.');
      return;
    }
    try {
      setGuardando(true);
      await conTiempoLimite(eliminarDocumentoRest('casos', id), 20000, 'Firestore no respondió al eliminar la asesoría en 20 segundos.');
      setCasos(prev => prev.filter(c => c.id !== id));
      setCasoAbiertoId(null);
      setVista('casos');
      alert('Asesoría eliminada correctamente.');
    } catch (error) {
      console.error('Error eliminando asesoría:', error);
      alert(`No se pudo eliminar la asesoría en Firestore. Detalle: ${error.message || error.code || 'error desconocido'}. Revisa que las reglas permitan eliminar asesorías.`);
    } finally {
      setGuardando(false);
    }
  }

  if (!logueado) {
    return <Login usuario={usuario} clave={clave} setUsuario={setUsuario} setClave={setClave} onLogin={iniciarSesion} guardando={guardando} />;
  }

  if (cargando && !perfil && !requiereInicializacion) {
    return <PantallaCargaSegura email={usuarioAuth?.email} />;
  }

  if (requiereInicializacion) {
    return <InicializacionSeguridad email={usuarioAuth?.email} onInitialize={inicializarSeguridadInicial} onLogout={cerrarSesion} guardando={inicializandoSeguridad} />;
  }

  if (!cargando && !perfil) {
    return <ErrorConexionSegura mensaje={errorConexion} onRetry={() => window.location.reload()} onLogout={cerrarSesion} />;
  }

  if (perfil && !permisos.activo) {
    return <AccesoBloqueado perfil={perfil} onLogout={cerrarSesion} />;
  }

  const titulo = vista === 'nuevoCaso' ? 'Nueva asesoría de visa'
    : vista === 'casos' ? 'Asesorías registradas'
    : vista === 'detalleCaso' ? 'Detalle y seguimiento de la asesoría'
    : vista === 'plantillas' ? 'Plantillas y respuestas rápidas'
    : vista === 'agendaGoogle' ? 'Agenda Google Calendar'
    : vista === 'configuracion' ? 'Configuración'
    : vista === 'estadoApp' ? 'Estado de la app'
    : 'Dashboard';

  function navegarA(nuevaVista) {
    setVista(nuevaVista);
    setMenuAbierto(false);
    if (nuevaVista !== 'detalleCaso') setCasoAbiertoId(null);
  }

  return <div className={`app ${menuAbierto ? 'menu-open' : ''}`}>
    <button
      type="button"
      className={`sidebar-backdrop ${menuAbierto ? 'visible' : ''}`}
      aria-label="Cerrar menú de navegación"
      onClick={() => setMenuAbierto(false)}
    />

    <aside className={`sidebar-drawer ${menuAbierto ? 'open' : ''}`} aria-hidden={!menuAbierto}>
      <div className="sidebar-heading">
        <div className="logo">SIGV</div>
        <button type="button" className="sidebar-close" onClick={() => setMenuAbierto(false)} aria-label="Cerrar menú">×</button>
      </div>
      <button className={vista === 'dashboard' ? 'active' : ''} onClick={() => navegarA('dashboard')}>Dashboard</button>
      <button className={vista === 'nuevoCaso' ? 'active' : ''} onClick={() => navegarA('nuevoCaso')}>Nueva asesoría</button>
      <button className={vista === 'casos' || vista === 'detalleCaso' ? 'active' : ''} onClick={() => navegarA('casos')}>Asesorías</button>
      <button className={vista === 'plantillas' ? 'active' : ''} onClick={() => navegarA('plantillas')}>Plantillas</button>
      {permisos.puedeVerAgendaGoogle && <button className={vista === 'agendaGoogle' ? 'active' : ''} onClick={() => navegarA('agendaGoogle')}>Agenda Google</button>}
      {permisos.puedeEditarConfiguracion && <button className={vista === 'configuracion' ? 'active' : ''} onClick={() => navegarA('configuracion')}>Configuración</button>}
      <button className={vista === 'estadoApp' ? 'active' : ''} onClick={() => navegarA('estadoApp')}>Estado de la app{errorConexion ? <span className="nav-alert-dot" title="Hay una novedad técnica" /> : null}</button>
      <button onClick={cerrarSesion}>Cerrar sesión</button>
    </aside>

    <main className="content">
      <header>
        <div className="header-left">
          <button type="button" className="menu-button" onClick={() => setMenuAbierto(true)} aria-expanded={menuAbierto}>☰ Menú</button>
          <div>
            <h1>{titulo}</h1>
            <p>Sistema Integral de Gestión de Visas · AmCham Atlántico y Magdalena</p>
          </div>
        </div>
        {guardando && <span className="save-indicator">Guardando...</span>}
      </header>
      {cargando && <div className="empty">Cargando información...</div>}

      {!cargando && vista === 'dashboard' && <Dashboard casos={casos} onOpen={abrirCaso} />}

      {!cargando && vista === 'nuevoCaso' && permisos.puedeCrearCasos && <NuevoCaso form={form} setForm={setForm} calculo={calculo} guardarCaso={guardarCaso} config={config} guardando={guardando} permisos={permisos} />}

      {!cargando && vista === 'casos' && <Casos casos={casos} onOpen={abrirCaso} config={config} />}

      {!cargando && vista === 'detalleCaso' && casoAbierto && <DetalleCaso caso={casoAbierto} onBack={() => navegarA('casos')} onSave={actualizarCaso} onChangeCreationDate={cambiarFechaCreacionCaso} onCorrectInvoice={corregirFacturacionRegistrada} onDelete={eliminarCaso} config={config} guardando={guardando} permisos={permisos} />}

      {!cargando && vista === 'detalleCaso' && !casoAbierto && <div className="empty">La asesoría seleccionada aún se está cargando o no existe.</div>}

      {!cargando && vista === 'plantillas' && <Plantillas casos={casos} onOpen={abrirCaso} />}

      {!cargando && vista === 'agendaGoogle' && permisos.puedeVerAgendaGoogle && <AgendaGoogleCalendar config={config.googleCalendar} />}

      {!cargando && vista === 'configuracion' && permisos.puedeEditarConfiguracion && <Configuracion config={config} setConfig={guardarConfigFirestore} usuariosSigv={usuariosSigv} onSaveUsuario={guardarUsuarioSigv} onResetRoles={reiniciarRolesSigv} guardando={guardando} perfilActual={perfil} seguridad={seguridad} onActivateSecurity={activarSeguridadManual} />}

      {!cargando && vista === 'estadoApp' && <EstadoApp perfil={perfil} usuarioAuth={usuarioAuth} permisos={permisos} seguridad={seguridad} diagnostico={diagnostico} errorConexion={errorConexion} guardando={guardando} onTest={ejecutarDiagnosticoFirestore} migracionFacturacion={migracionFacturacion} />}
    </main>
  </div>;
}


function EstadoApp({ perfil, usuarioAuth, permisos, seguridad, diagnostico, errorConexion, guardando, onTest, migracionFacturacion }) {
  const seguridadActiva = seguridad?.primerAdministradorConfigurado === true;
  const nombreUsuario = perfil?.nombre || usuarioAuth?.displayName || usuarioAuth?.email || 'Usuario SIGV';
  const correoUsuario = usuarioAuth?.email || perfil?.email || '';
  const rolUsuario = rolesSigv[permisos?.rol]?.label || 'Sin rol asignado';

  return <div className="app-status-page">
    <section className="panel app-status-intro">
      <div>
        <h2>Estado de la app</h2>
        <p>Información de funcionamiento y soporte de SIGV. Estos datos se concentran aquí para mantener limpias las demás pantallas.</p>
      </div>
      <span className={errorConexion ? 'pill warn' : 'pill ok'}>{errorConexion ? 'Revisar estado' : 'Funcionamiento normal'}</span>
    </section>

    <div className="app-status-grid">
      <section className="panel status-card">
        <span className="status-label">Versión instalada</span>
        <strong>{APP_VERSION}</strong>
        <small>Compilación {BUILD_ID}</small>
      </section>

      <section className="panel status-card">
        <span className="status-label">Conexión de datos</span>
        <strong>Firebase conectado</strong>
        <small>La sesión está autenticada y SIGV pudo cargar la información.</small>
      </section>

      <section className="panel status-card">
        <span className="status-label">Seguridad</span>
        <strong>{seguridadActiva ? 'Seguridad activa' : 'Seguridad pendiente'}</strong>
        <small>{seguridadActiva ? 'La inicialización del primer Administrador está cerrada.' : 'La configuración inicial todavía requiere revisión.'}</small>
      </section>

      <section className="panel status-card">
        <span className="status-label">Sesión actual</span>
        <strong>{nombreUsuario}</strong>
        <small>{correoUsuario}</small>
        <span className="status-role">Rol: {rolUsuario}</span>
      </section>

      <section className="panel status-card">
        <span className="status-label">Corrección inicial de facturación</span>
        <strong>{migracionFacturacion?.estado === 'revisando'
          ? 'Revisando registros…'
          : migracionFacturacion?.estado === 'completada'
            ? 'Migración completada'
            : migracionFacturacion?.estado === 'parcial'
              ? 'Migración con novedades'
              : migracionFacturacion?.estado === 'soloAdministrador'
                ? 'Revisión reservada al Administrador'
                : 'Sin registros pendientes'}</strong>
        <small>{migracionFacturacion?.estado === 'completada' || migracionFacturacion?.estado === 'parcial'
          ? `${migracionFacturacion.asesoriasMigradas} asesoría${migracionFacturacion.asesoriasMigradas === 1 ? '' : 's'} con auditoría completada. ${migracionFacturacion.visasMigradas} visa${migracionFacturacion.visasMigradas === 1 ? '' : 's'} históricas fueron reconciliadas con el 1 de julio de 2026.${migracionFacturacion.errores ? ` ${migracionFacturacion.errores} registro${migracionFacturacion.errores === 1 ? '' : 's'} requiere${migracionFacturacion.errores === 1 ? '' : 'n'} revisión.` : ''}`
          : 'La reconciliación actúa sobre facturadas históricas creadas en julio que no estén incluidas correctamente en el periodo o cuya cantidad registrada no coincida.'}</small>
      </section>
    </div>

    <section className="panel app-diagnostic-panel">
      <div className="section-title">
        <div>
          <h2>Comprobación de Firestore</h2>
          <p>Úsala únicamente cuando necesites verificar la conexión o compartir un diagnóstico con soporte.</p>
        </div>
        <button className="mini-button" type="button" onClick={onTest} disabled={guardando}>Probar Firestore</button>
      </div>
      {diagnostico ? <div className="alert-box diagnostic">{diagnostico}</div> : <div className="empty compact-empty">Aún no se ha ejecutado una prueba durante esta sesión.</div>}
      {errorConexion && <div className="alert-box">{errorConexion}</div>}
    </section>
  </div>;
}

function Login({ usuario, clave, setUsuario, setClave, onLogin, guardando = false }) {
  return <div className="login-page">
    <form className="login-card" onSubmit={onLogin}>
      <div className="brand">SIGV</div>
      <h1>Sistema Integral de Gestión de Visas</h1>
      <p>AmCham Atlántico y Magdalena</p>
      <label>Correo electrónico
        <input type="email" value={usuario} onChange={e => setUsuario(e.target.value)} placeholder="usuario@empresa.com" autoComplete="email" />
      </label>
      <label>Contraseña
        <input type="password" value={clave} onChange={e => setClave(e.target.value)} autoComplete="current-password" />
      </label>
      <button type="submit" disabled={guardando}>{guardando ? 'Ingresando...' : 'Ingresar con Firebase'}</button>
      <small>El usuario debe estar creado en Firebase Authentication con proveedor Email/Password.</small>
    </form>
  </div>;
}


function PantallaCargaSegura({ email = '' }) {
  return <div className="login-page">
    <section className="login-card">
      <div className="brand">SIGV</div>
      <h1>Validando acceso</h1>
      <p>Estamos verificando en Firestore el perfil y los permisos de {email || 'este usuario'}.</p>
      <small>No se habilitarán permisos hasta completar esta validación.</small>
    </section>
  </div>;
}

function InicializacionSeguridad({ email = '', onInitialize, onLogout, guardando = false }) {
  return <div className="login-page">
    <section className="login-card security-card">
      <div className="brand">SIGV</div>
      <h1>Configurar primer Administrador</h1>
      <p>La instalación todavía no tiene cerrado el proceso de seguridad. El correo autenticado quedará registrado como Administrador principal:</p>
      <strong className="security-email">{email}</strong>
      <div className="alert-box diagnostic">Realiza este paso únicamente con la cuenta que administrará usuarios, configuración y eliminación de asesorías.</div>
      <button type="button" onClick={onInitialize} disabled={guardando}>{guardando ? 'Configurando...' : 'Configurar y cerrar inicialización'}</button>
      <button type="button" className="secondary" onClick={onLogout} disabled={guardando}>Cerrar sesión</button>
    </section>
  </div>;
}

function ErrorConexionSegura({ mensaje = '', onRetry, onLogout }) {
  return <div className="login-page">
    <section className="login-card security-card">
      <div className="brand">SIGV</div>
      <h1>Acceso no validado</h1>
      <p>SIGV no pudo confirmar el perfil en Firestore. Por seguridad no se concedieron permisos temporales.</p>
      {mensaje && <div className="alert-box">{mensaje}</div>}
      <button type="button" onClick={onRetry}>Reintentar</button>
      <button type="button" className="secondary" onClick={onLogout}>Cerrar sesión</button>
    </section>
  </div>;
}

function AccesoBloqueado({ perfil, onLogout }) {
  const sinPerfil = perfil?.motivoBloqueo === 'sinPerfil';
  const rolInvalido = !sinPerfil && perfil?.activo === true && !normalizarRolSigv(perfil?.rol);
  return <div className="login-page">
    <section className="login-card security-card">
      <div className="brand">SIGV</div>
      <h1>{sinPerfil ? 'Usuario sin autorización' : rolInvalido ? 'Rol no válido' : 'Acceso inactivo'}</h1>
      <p>{sinPerfil
        ? `El correo ${perfil?.email} existe en Firebase Authentication, pero no tiene un perfil autorizado en usuariosSigv.`
        : rolInvalido
          ? `El usuario ${perfil?.email} no tiene un rol válido. Solicita a un Administrador que asigne Administrador o Asesor.`
          : `El usuario ${perfil?.email} existe en SIGV, pero está marcado como inactivo. Solicita a un Administrador que active nuevamente el acceso.`}</p>
      <button type="button" onClick={onLogout}>Cerrar sesión</button>
    </section>
  </div>;
}

function Dashboard({ casos, onOpen }) {
  const hoy = partesFechaColombia(new Date());
  const mesActual = claveMes(hoy.year, hoy.month);
  const [modoFecha, setModoFecha] = useState('mes');
  const [mesFiltro, setMesFiltro] = useState(mesActual);
  const [fechaDesde, setFechaDesde] = useState(`${mesActual}-01`);
  const [fechaHasta, setFechaHasta] = useState(ultimoDiaMes(hoy.year, hoy.month));
  const [mesCalendario, setMesCalendario] = useState({ year: hoy.year, month: hoy.month });

  const rangoInvalido = modoFecha === 'rango' && fechaDesde && fechaHasta && fechaDesde > fechaHasta;
  const mesInvalido = modoFecha === 'mes' && !/^\d{4}-\d{2}$/.test(mesFiltro);
  const filtroInvalido = rangoInvalido || mesInvalido;
  const limitesPeriodo = useMemo(() => {
    if (filtroInvalido) return { fechaDesde: '', fechaHasta: '' };
    return modoFecha === 'mes'
      ? limitesDesdeMes(mesFiltro)
      : { fechaDesde, fechaHasta };
  }, [modoFecha, mesFiltro, fechaDesde, fechaHasta, filtroInvalido]);

  const casosPeriodo = useMemo(() => {
    if (filtroInvalido) return [];
    return casos.filter(caso => fechaDentroPeriodo(
      claveCreacionCaso(caso),
      limitesPeriodo.fechaDesde,
      limitesPeriodo.fechaHasta,
    ));
  }, [casos, limitesPeriodo.fechaDesde, limitesPeriodo.fechaHasta, filtroInvalido]);

  const pendientes = casosPeriodo.filter(c => normalizar(c.estado).includes('pendiente')).length;
  const listos = casosPeriodo.filter(c => normalizar(c.estado).includes('pendiente agendamiento')).length;
  const agendados = casosPeriodo.filter(c => normalizar(c.estado).includes('asesoria agendada')).length;
  const premiumPendientes = casosPeriodo.filter(casoPremiumPendiente).length;
  const visas = casosPeriodo.reduce((acc, caso) => {
    const esFacturada = caso.facturacion?.estadoFactura === 'facturada';
    const cantidad = esFacturada ? cantidadVisasFacturadasCaso(caso) : cantidadVisasCaso(caso);
    acc.total += cantidad;
    if (esFacturada) acc.facturadas += cantidad;
    else acc.porFacturar += cantidad;
    return acc;
  }, { total: 0, facturadas: 0, porFacturar: 0 });
  const recientes = casosPeriodo.slice(0, 5);
  const financiero = useMemo(
    () => filtroInvalido
      ? resumenFinancieroPeriodo([], '', '')
      : resumenFinancieroPeriodo(casos, limitesPeriodo.fechaDesde, limitesPeriodo.fechaHasta),
    [casos, limitesPeriodo.fechaDesde, limitesPeriodo.fechaHasta, filtroInvalido],
  );
  const etiquetaPeriodo = filtroInvalido
    ? 'Periodo no válido'
    : etiquetaPeriodoDashboard(modoFecha, mesFiltro, fechaDesde, fechaHasta);

  useEffect(() => {
    const mesReferencia = modoFecha === 'mes' ? mesFiltro : (fechaDesde || fechaHasta || mesActual).slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(mesReferencia)) return;
    setMesCalendario({
      year: Number(mesReferencia.slice(0, 4)),
      month: Number(mesReferencia.slice(5, 7)),
    });
  }, [modoFecha, mesFiltro, fechaDesde, fechaHasta, mesActual]);

  function moverMes(valor, delta) {
    const fecha = new Date(valor.year, valor.month - 1 + delta, 1);
    return { year: fecha.getFullYear(), month: fecha.getMonth() + 1 };
  }

  function cambiarMesDashboard(delta) {
    if (modoFecha === 'mes') {
      const actual = /^\d{4}-\d{2}$/.test(mesFiltro) ? mesFiltro : mesActual;
      const [year, month] = actual.split('-').map(Number);
      const siguiente = moverMes({ year, month }, delta);
      setMesFiltro(claveMes(siguiente.year, siguiente.month));
      return;
    }

    const siguiente = moverMes(mesCalendario, delta);
    const claveSiguiente = claveMes(siguiente.year, siguiente.month);
    const mesMinimo = fechaDesde ? fechaDesde.slice(0, 7) : '';
    const mesMaximo = fechaHasta ? fechaHasta.slice(0, 7) : '';
    if ((mesMinimo && claveSiguiente < mesMinimo) || (mesMaximo && claveSiguiente > mesMaximo)) return;
    setMesCalendario(siguiente);
  }

  function irPeriodoActual() {
    if (modoFecha === 'mes') {
      setMesFiltro(mesActual);
      return;
    }
    setFechaDesde(`${mesActual}-01`);
    setFechaHasta(ultimoDiaMes(hoy.year, hoy.month));
  }

  const claveMesCalendario = claveMes(mesCalendario.year, mesCalendario.month);
  const deshabilitarAnterior = modoFecha === 'rango' && !!fechaDesde && claveMesCalendario <= fechaDesde.slice(0, 7);
  const deshabilitarSiguiente = modoFecha === 'rango' && !!fechaHasta && claveMesCalendario >= fechaHasta.slice(0, 7);

  return <>
    <FiltroPeriodoDashboard
      modoFecha={modoFecha}
      setModoFecha={setModoFecha}
      mesFiltro={mesFiltro}
      setMesFiltro={setMesFiltro}
      fechaDesde={fechaDesde}
      setFechaDesde={setFechaDesde}
      fechaHasta={fechaHasta}
      setFechaHasta={setFechaHasta}
      onCurrent={irPeriodoActual}
      etiquetaPeriodo={etiquetaPeriodo}
      totalAsesorias={casosPeriodo.length}
      filtroInvalido={filtroInvalido}
    />

    <section className="grid cards dashboard-operational-cards">
      <Card title="Asesorías registradas" value={casosPeriodo.length} />
      <VisasCard total={visas.total} porFacturar={visas.porFacturar} facturadas={visas.facturadas} subtitulo="Periodo seleccionado" />
      <Card title="Pendientes" value={pendientes} />
      <Card title="Pendientes agendamiento" value={listos} />
      <Card title="Asesorías agendadas" value={agendados} />
      <Card title="Pendiente Paquete Premium" value={premiumPendientes} />
    </section>

    <ResumenFacturacionMensual resumen={financiero} etiquetaPeriodo={etiquetaPeriodo} onOpen={onOpen} />

    <CalendarioAsesorias
      casos={casosPeriodo}
      onOpen={onOpen}
      mesVisible={mesCalendario}
      fechaDesde={limitesPeriodo.fechaDesde}
      fechaHasta={limitesPeriodo.fechaHasta}
      etiquetaPeriodo={etiquetaPeriodo}
      onPrevious={() => cambiarMesDashboard(-1)}
      onNext={() => cambiarMesDashboard(1)}
      previousDisabled={deshabilitarAnterior}
      nextDisabled={deshabilitarSiguiente}
    />

    <section className="panel mt">
      <div className="section-title">
        <h2>Asesorías recientes del periodo</h2>
        <span>{etiquetaPeriodo}</span>
      </div>
      <CaseTable casos={recientes} onOpen={onOpen} compacto />
    </section>
  </>;
}

function FiltroPeriodoDashboard({
  modoFecha,
  setModoFecha,
  mesFiltro,
  setMesFiltro,
  fechaDesde,
  setFechaDesde,
  fechaHasta,
  setFechaHasta,
  onCurrent,
  etiquetaPeriodo,
  totalAsesorias,
  filtroInvalido,
}) {
  return <section className="panel dashboard-period-panel">
    <div className="dashboard-period-header">
      <div>
        <h2>Periodo del Dashboard</h2>
        <p>El periodo seleccionado controla las tarjetas operativas, Total de visas, facturación, calendario y asesorías recientes.</p>
      </div>
      <button type="button" className="secondary fit date-quick-button" onClick={onCurrent}>Periodo actual</button>
    </div>

    <div className="date-filter-modes" role="group" aria-label="Tipo de periodo del Dashboard">
      <button type="button" className={modoFecha === 'mes' ? 'active' : ''} onClick={() => setModoFecha('mes')}>Mes completo</button>
      <button type="button" className={modoFecha === 'rango' ? 'active' : ''} onClick={() => setModoFecha('rango')}>Rango de fechas</button>
    </div>

    {modoFecha === 'mes' && <div className="date-filter-fields month-mode">
      <label>Mes a consultar
        <input type="month" value={mesFiltro} onChange={e => setMesFiltro(e.target.value)} />
      </label>
    </div>}

    {modoFecha === 'rango' && <div className="date-filter-fields">
      <label>Fecha inicial
        <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
      </label>
      <label>Fecha final
        <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
      </label>
    </div>}

    <div className={`date-filter-summary${filtroInvalido ? ' invalid' : ''}`}>
      <strong>{filtroInvalido ? 'El rango seleccionado no es válido' : etiquetaPeriodo}</strong>
      <span>{filtroInvalido ? 'La fecha inicial no puede ser posterior a la fecha final.' : `${totalAsesorias} asesoría${totalAsesorias === 1 ? '' : 's'} registrada${totalAsesorias === 1 ? '' : 's'} por fecha de creación.`}</span>
    </div>
  </section>;
}

function ResumenFacturacionMensual({ resumen, etiquetaPeriodo, onOpen }) {
  return <section className="panel mt monthly-finance-panel">
    <div className="monthly-finance-header">
      <div>
        <h2>Facturación del periodo AmCham</h2>
        <p>El valor generado usa la fecha de creación; el valor facturado usa la fecha real en que la asesoría fue marcada como facturada.</p>
      </div>
      <strong className="finance-period-label">{etiquetaPeriodo}</strong>
    </div>

    <div className="monthly-finance-grid">
      <article className="finance-metric-card">
        <span>Valor estimado generado</span>
        <strong>{moneda(resumen.estimadoGenerado)}</strong>
        <small>{resumen.visasGeneradas} visa{resumen.visasGeneradas === 1 ? '' : 's'} creada{resumen.visasGeneradas === 1 ? '' : 's'} en el periodo</small>
      </article>

      <article className="finance-metric-card featured">
        <span>Valor facturado</span>
        <strong>{moneda(resumen.facturadoTotal)}</strong>
        <small>{resumen.visasFacturadas} visa{resumen.visasFacturadas === 1 ? '' : 's'} marcada{resumen.visasFacturadas === 1 ? '' : 's'} como facturada{resumen.visasFacturadas === 1 ? '' : 's'} durante el periodo</small>
        <div className="finance-breakdown">
          <div><span>Generado y facturado en el periodo</span><b>{moneda(resumen.facturadoMismoMes)}</b></div>
          <div><span>Proveniente de fechas anteriores</span><b>{moneda(resumen.facturadoMesesAnteriores)}</b></div>
          {resumen.facturadoOrigenNoIdentificado > 0 && <div><span>Origen fuera del periodo o sin fecha</span><b>{moneda(resumen.facturadoOrigenNoIdentificado)}</b></div>}
        </div>
      </article>

      <article className="finance-metric-card pending">
        <span>Pendiente actual por facturar</span>
        <strong>{moneda(resumen.pendienteGenerado)}</strong>
        <small>{resumen.visasPendientes} visa{resumen.visasPendientes === 1 ? '' : 's'} creada{resumen.visasPendientes === 1 ? '' : 's'} en el periodo que todavía no se ha{resumen.visasPendientes === 1 ? '' : 'n'} facturado</small>
      </article>
    </div>

    {resumen.casosMesesAnteriores.length > 0 && <details className="prior-period-invoices">
      <summary>
        <span>Ver asesorías provenientes de fechas anteriores</span>
        <strong>{resumen.casosMesesAnteriores.length} asesoría{resumen.casosMesesAnteriores.length === 1 ? '' : 's'} · {resumen.visasMesesAnteriores} visa{resumen.visasMesesAnteriores === 1 ? '' : 's'}</strong>
      </summary>
      <div className="prior-period-invoice-list">
        {resumen.casosMesesAnteriores.map(item => <article key={item.id} className="prior-period-invoice-item">
          <div>
            <strong>{item.id} · {item.nombre}</strong>
            <small>Creada: {etiquetaFechaCorta(item.fechaCreacion)} · Facturada: {etiquetaFechaCorta(item.fechaFactura)} · {item.cantidadVisas} visa{item.cantidadVisas === 1 ? '' : 's'}</small>
          </div>
          <b>{moneda(item.valorFacturado)}</b>
          <button type="button" className="small-btn" onClick={() => onOpen?.(item.id)}>Abrir</button>
        </article>)}
      </div>
    </details>}

    <div className="monthly-finance-note">
      <strong>Criterio del reporte:</strong> las tarjetas operativas se filtran por fecha de creación. En facturación, los valores generados se asignan por fecha de creación y los valores facturados por la fecha real de facturación. Los indicadores son independientes y no deben sumarse entre sí.
    </div>
    {resumen.facturadasSinFecha > 0 && <div className="monthly-finance-warning">
      {resumen.facturadasSinFecha} asesoría{resumen.facturadasSinFecha === 1 ? '' : 's'} antigua{resumen.facturadasSinFecha === 1 ? '' : 's'} aparece{resumen.facturadasSinFecha === 1 ? '' : 'n'} como facturada{resumen.facturadasSinFecha === 1 ? '' : 's'}, pero no tiene{resumen.facturadasSinFecha === 1 ? '' : 'n'} fecha de facturación identificable y no se incluye{resumen.facturadasSinFecha === 1 ? '' : 'n'} en el valor facturado del periodo.
    </div>}
  </section>;
}

function CalendarioAsesorias({
  casos,
  onOpen,
  mesVisible,
  fechaDesde = '',
  fechaHasta = '',
  etiquetaPeriodo = '',
  onPrevious,
  onNext,
  previousDisabled = false,
  nextDisabled = false,
}) {
  const hoy = partesFechaColombia(new Date());
  const [diaSeleccionado, setDiaSeleccionado] = useState('');

  useEffect(() => {
    setDiaSeleccionado('');
  }, [mesVisible.year, mesVisible.month, fechaDesde, fechaHasta]);

  const asesoriasPorDia = useMemo(() => {
    const mapa = new Map();
    for (const caso of casos) {
      const clave = claveCreacionCaso(caso);
      if (!clave || !fechaDentroPeriodo(clave, fechaDesde, fechaHasta)) continue;
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave).push(caso);
    }
    for (const lista of mapa.values()) lista.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
    return mapa;
  }, [casos, fechaDesde, fechaHasta]);

  const actividadPorDia = useMemo(() => {
    const mapa = new Map();
    for (const caso of casos) {
      for (const item of caso.historial || []) {
        const clave = claveFechaEvento(item);
        if (!clave || !fechaDentroPeriodo(clave, fechaDesde, fechaHasta)) continue;
        if (!mapa.has(clave)) mapa.set(clave, []);
        mapa.get(clave).push({ caso, item });
      }
    }
    for (const lista of mapa.values()) lista.sort((a, b) => marcaTiempoEvento(b.item) - marcaTiempoEvento(a.item));
    return mapa;
  }, [casos, fechaDesde, fechaHasta]);

  const primerDia = new Date(mesVisible.year, mesVisible.month - 1, 1);
  const totalDias = new Date(mesVisible.year, mesVisible.month, 0).getDate();
  const espaciosIniciales = (primerDia.getDay() + 6) % 7;
  const celdas = Array.from({ length: espaciosIniciales + totalDias }, (_, indice) => {
    if (indice < espaciosIniciales) return null;
    const day = indice - espaciosIniciales + 1;
    const clave = `${mesVisible.year}-${String(mesVisible.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { day, clave };
  });
  while (celdas.length % 7) celdas.push(null);

  const tituloMes = etiquetaMes(mesVisible.year, mesVisible.month);
  const creadasSeleccionadas = diaSeleccionado ? asesoriasPorDia.get(diaSeleccionado) || [] : [];
  const actividadSeleccionada = diaSeleccionado ? actividadPorDia.get(diaSeleccionado) || [] : [];

  return <section className="panel mt calendar-panel">
    <div className="calendar-header">
      <div>
        <h2>Calendario de asesorías del periodo</h2>
        <p>{tituloMes}. Se muestran únicamente las fechas incluidas en {etiquetaPeriodo || 'el periodo seleccionado'}.</p>
      </div>
      <div className="calendar-navigation">
        <button type="button" className="calendar-nav-button" onClick={onPrevious} disabled={previousDisabled} aria-label="Mes anterior">‹</button>
        <strong>{tituloMes}</strong>
        <button type="button" className="calendar-nav-button" onClick={onNext} disabled={nextDisabled} aria-label="Mes siguiente">›</button>
      </div>
    </div>

    <div className="calendar-weekdays" aria-hidden="true">
      {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(dia => <span key={dia}>{dia}</span>)}
    </div>
    <div className="calendar-grid">
      {celdas.map((celda, indice) => {
        if (!celda) return <div className="calendar-cell empty-day" key={`empty-${indice}`} />;
        const dentroPeriodo = fechaDentroPeriodo(celda.clave, fechaDesde, fechaHasta);
        const cantidad = dentroPeriodo ? (asesoriasPorDia.get(celda.clave) || []).length : 0;
        const esHoy = celda.clave === hoy.clave;
        const seleccionado = celda.clave === diaSeleccionado;
        return <button
          type="button"
          key={celda.clave}
          className={`calendar-cell${esHoy ? ' today' : ''}${seleccionado ? ' selected' : ''}${!dentroPeriodo ? ' outside-period' : ''}`}
          onClick={() => dentroPeriodo && setDiaSeleccionado(celda.clave)}
          disabled={!dentroPeriodo}
          aria-label={`${celda.day} de ${tituloMes}. ${dentroPeriodo ? `${cantidad} asesorías creadas.` : 'Fuera del periodo seleccionado.'}`}
        >
          <span className="calendar-day-number">{celda.day}</span>
          {cantidad > 0 && <span className="calendar-created-count">{cantidad} creada{cantidad === 1 ? '' : 's'}</span>}
        </button>;
      })}
    </div>

    <div className="calendar-day-detail">
      {!diaSeleccionado && <div className="empty">Selecciona un día habilitado para ver las asesorías creadas y el historial de actividad del periodo.</div>}
      {diaSeleccionado && <>
        <div className="calendar-detail-heading">
          <div>
            <h3>{fechaLargaDesdeClave(diaSeleccionado)}</h3>
            <p>{creadasSeleccionadas.length} asesoría{creadasSeleccionadas.length === 1 ? '' : 's'} creada{creadasSeleccionadas.length === 1 ? '' : 's'} · {actividadSeleccionada.length} movimiento{actividadSeleccionada.length === 1 ? '' : 's'} registrado{actividadSeleccionada.length === 1 ? '' : 's'}</p>
          </div>
        </div>

        <div className="calendar-detail-columns">
          <section className="calendar-detail-section">
            <h4>Asesorías creadas</h4>
            {!creadasSeleccionadas.length && <p className="hint">No se crearon asesorías durante este día.</p>}
            <div className="calendar-created-list">
              {creadasSeleccionadas.map(caso => <button type="button" className="calendar-case-card" key={caso.id} onClick={() => onOpen(caso.id)}>
                <strong>{caso.id} · {textoClienteCaso(caso)}</strong>
                <span>{textoSolicitudesCaso(caso)} · {caso.asesor || 'Sin asesor'}</span>
                <small>{caso.estado}</small>
              </button>)}
            </div>
          </section>

          <section className="calendar-detail-section">
            <h4>Historial y actualizaciones del día</h4>
            {!actividadSeleccionada.length && <p className="hint">No hay movimientos registrados en el historial para esta fecha.</p>}
            <div className="calendar-activity-list">
              {actividadSeleccionada.map(({ caso, item }) => <button type="button" className="calendar-activity-item" key={`${caso.id}-${item.id}`} onClick={() => onOpen(caso.id)}>
                <div>
                  <strong>{item.tipo || 'Actividad'} · {caso.id}</strong>
                  <span>{textoClienteCaso(caso)} · {item.asesor || caso.asesor || 'Sistema'}</span>
                </div>
                <small>{fechaEventoLegible(item)}</small>
                <p>{item.texto || 'Movimiento registrado en la asesoría.'}</p>
              </button>)}
            </div>
          </section>
        </div>
      </>}
    </div>
  </section>;
}

function ControlDescuentoCantidad({ activo = true, onChange, puedeEditar = false }) {
  return <div className={`discount-control ${activo ? 'active' : 'inactive'}`}>
    <div>
      <strong>Descuento por cantidad</strong>
      <p>{activo
        ? 'Se aplicará automáticamente 10% desde 3 integrantes y 15% desde 5.'
        : 'No se aplicará descuento, sin importar la cantidad de integrantes.'}</p>
    </div>
    <button
      type="button"
      className={`discount-toggle ${activo ? 'is-on' : 'is-off'}`}
      onClick={() => puedeEditar && onChange?.(!activo)}
      disabled={!puedeEditar}
      aria-pressed={activo}
      title={puedeEditar ? 'Activar o desactivar el descuento por cantidad' : 'Solo el Administrador puede modificar descuentos'}
    >
      {activo ? 'Activado' : 'Desactivado'}
    </button>
    {!puedeEditar && <small>Solo el Administrador puede modificar este control.</small>}
  </div>;
}

function NuevoCaso({ form, setForm, calculo, guardarCaso, config, guardando = false, permisos = {} }) {
  const integrantes = normalizarIntegrantes(form);
  const principal = integrantes[0] || crearIntegrante(1);

  function cambiarCantidad(valor) {
    const nuevaCantidad = Math.max(1, Math.min(30, Number(valor) || 1));
    const nuevosIntegrantes = ajustarCantidadIntegrantes(integrantes, nuevaCantidad);
    setForm(prev => ({
      ...prev,
      cantidad: nuevaCantidad,
      integrantes: nuevosIntegrantes,
      ajustesPrecio: ajustesPrecioParaIntegrantes(prev.ajustesPrecio, nuevosIntegrantes),
      facturacion: facturacionSegunAfiliacion(prev.facturacion, nuevosIntegrantes),
    }));
  }

  function actualizarIntegrantes(nuevosIntegrantes) {
    setForm(prev => ({
      ...prev,
      cantidad: nuevosIntegrantes.length,
      integrantes: nuevosIntegrantes,
      ajustesPrecio: ajustesPrecioParaIntegrantes(prev.ajustesPrecio, nuevosIntegrantes),
      facturacion: facturacionSegunAfiliacion(prev.facturacion, nuevosIntegrantes),
      estadoManual: '',
    }));
  }

  return <form className="process-layout" onSubmit={guardarCaso}>
    <section className="panel process-column">
      <h2>1. Asesor responsable</h2>
      <AsesorSelect value={form.asesor} onChange={v => setForm({ ...form, asesor: v })} asesoras={config.asesoras} />

      <h2>2. Cantidad</h2>
      <label>Cantidad de integrantes de la asesoría
        <input type="number" min="1" max="30" value={integrantes.length} onChange={e => cambiarCantidad(e.target.value)} />
      </label>
      <p className="hint">Usa este campo cuando la asesoría sea de un grupo familiar o tenga varios solicitantes. Según la cantidad, se despliegan datos, solicitud y documentos para cada integrante.</p>
      <ControlDescuentoCantidad
        activo={descuentoCantidadActivo(form)}
        onChange={aplicarDescuentoCantidad => setForm(prev => ({ ...prev, aplicarDescuentoCantidad }))}
        puedeEditar={permisos.esAdministrador}
      />

      <IntegrantesSecciones
        integrantes={integrantes}
        onChange={actualizarIntegrantes}
        config={config}
        ajustesPrecio={form.ajustesPrecio}
        onAjustesPrecioChange={ajustesPrecio => setForm(prev => ({ ...prev, ajustesPrecio }))}
        puedeEditarPrecio={permisos.esAdministrador}
      />

      <h2>5. Asesoría</h2>
      <div className="two-cols">
        <label>Fecha tentativa de asesoría
          <input type="date" value={form.fechaAsesoria} onChange={e => setForm({ ...form, fechaAsesoria: e.target.value })} />
        </label>
        <label>Hora tentativa
          <input type="time" value={form.horaAsesoria} onChange={e => setForm({ ...form, horaAsesoria: e.target.value })} />
        </label>
      </div>

      <h2>6. Facturación</h2>
      <FacturacionFields
        data={form.facturacion}
        onChange={facturacion => setForm({ ...form, facturacion })}
        tipoClienteKey={principal.tipoCliente}
        tipoSolicitudKey={principal.tipoSolicitud}
        datosCliente={{ nombre: principal.nombre, telefono: principal.telefono, correo: principal.email }}
        config={config}
        valorCaso={calculo.totalPesos}
        cantidadIntegrantes={integrantes.length}
        descuentoCantidadHabilitado={calculo.aplicarDescuentoCantidad}
        requiereEmpresaAfiliada={hayIntegranteAfiliado(integrantes)}
      />

      <h2>7. Fecha Cita embajada</h2>
      <label>Fecha Cita embajada
        <input type="date" value={form.fechaCitaEmbajada} onChange={e => setForm({ ...form, fechaCitaEmbajada: e.target.value })} />
      </label>

      <h2>Observaciones y seguimiento</h2>
      <label>Observación
        <textarea value={form.observacion} onChange={e => setForm({ ...form, observacion: e.target.value })} placeholder="Ej: pendiente soporte de pago, cliente enviará foto mañana..." />
      </label>
      <label>Seguimiento inicial
        <textarea value={form.seguimiento} onChange={e => setForm({ ...form, seguimiento: e.target.value })} placeholder="Ej: se debe llamar al cliente, confirmar documentos o validar pago..." />
      </label>

      <h2>Estado del Proceso</h2>
      <label>Estado actual
        <select value={form.estadoManual || calculo.estado} onChange={e => setForm({ ...form, estadoManual: e.target.value })}>
          {estadosProceso.map(estado => <option key={estado} value={estado}>{estado}</option>)}
        </select>
      </label>

      <button className="primary" type="submit" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar asesoría'}</button>
    </section>

    <Resumen
      calculo={calculo}
      facturacion={form.facturacion}
      tipoClienteKey={principal.tipoCliente}
      config={config}
      fechaAsesoria={form.fechaAsesoria}
      horaAsesoria={form.horaAsesoria}
      fechaCitaEmbajada={form.fechaCitaEmbajada}
      cantidadIntegrantes={integrantes.length}
      requiereEmpresaAfiliada={hayIntegranteAfiliado(integrantes)}
    />
  </form>;
}

function IntegrantesSecciones({ integrantes, onChange, config, ajustesPrecio = {}, onAjustesPrecioChange, puedeEditarPrecio = false }) {
  const lista = normalizarIntegrantes({ integrantes });
  const ajustesNormalizados = normalizarAjustesPrecio(ajustesPrecio);
  const [precioEditandoId, setPrecioEditandoId] = useState('');
  const [precioBorrador, setPrecioBorrador] = useState('');

  function abrirEditorPrecio(integrante) {
    if (!puedeEditarPrecio) return;
    const tarifaConfigurada = config.tarifas[integrante.tipoCliente]?.[integrante.tipoSolicitud];
    const precioActual = precioManualIntegrante(ajustesNormalizados, integrante.id);
    setPrecioEditandoId(integrante.id);
    setPrecioBorrador(String(precioActual !== null ? precioActual : (tarifaConfigurada ?? '')));
  }

  function aplicarPrecio(integrante) {
    const numero = Number(precioBorrador);
    if (!Number.isFinite(numero) || numero < 0) {
      alert('Ingresa un precio válido, igual o mayor a cero.');
      return;
    }
    onAjustesPrecioChange?.({ ...ajustesNormalizados, [integrante.id]: Math.round(numero) });
    setPrecioEditandoId('');
    setPrecioBorrador('');
  }

  function restaurarPrecio(integrante) {
    const nuevos = { ...ajustesNormalizados };
    delete nuevos[integrante.id];
    onAjustesPrecioChange?.(nuevos);
    setPrecioEditandoId('');
    setPrecioBorrador('');
  }

  function quitarPrecioPersonalizado(integranteId) {
    if (precioManualIntegrante(ajustesNormalizados, integranteId) === null) return;
    const nuevos = { ...ajustesNormalizados };
    delete nuevos[integranteId];
    onAjustesPrecioChange?.(nuevos);
  }

  function actualizarIntegrante(indice, cambios) {
    const nuevos = lista.map((integrante, i) => i === indice ? crearIntegrante(i + 1, { ...integrante, ...cambios }) : integrante);
    onChange(nuevos);
  }

  function cambiarTipoCliente(indice, tipoCliente) {
    const idsConCambio = lista
      .filter(integrante => integrante.tipoCliente !== tipoCliente)
      .map(integrante => integrante.id);
    const nuevosAjustes = { ...ajustesNormalizados };
    idsConCambio.forEach(integranteId => delete nuevosAjustes[integranteId]);
    if (idsConCambio.length) onAjustesPrecioChange?.(nuevosAjustes);
    const nuevos = lista.map((integrante, i) => crearIntegrante(i + 1, {
      ...integrante,
      tipoCliente,
      tipoClienteKey: tipoCliente,
    }));
    onChange(nuevos);
  }

  function cambiarSolicitud(indice, tipoSolicitud) {
    const integrante = lista[indice];
    quitarPrecioPersonalizado(integrante.id);
    const documentosActuales = integrante.documentos || {};
    const nuevosDocs = Object.fromEntries(documentosRequeridos(tipoSolicitud).map(id => [id, !!documentosActuales[id]]));
    actualizarIntegrante(indice, { tipoSolicitud, tipoSolicitudKey: tipoSolicitud, fedex: '', documentos: nuevosDocs, documentosObj: nuevosDocs });
  }

  return <>
    <h2>3. Datos del cliente y tipo de solicitud</h2>
    <p className="hint">El tipo de cliente o paquete se aplica a toda la asesoría. Al cambiarlo en cualquier integrante, SIGV actualizará automáticamente a todos los integrantes.</p>
    <div className="integrantes-stack">
      {lista.map((integrante, indice) => <div className="integrante-card" key={integrante.id}>
        <div className="integrante-title">Integrante {indice + 1} · {integrante.nombre || 'Sin nombre'}</div>
        <div className="two-cols">
          <Field required label="Nombre completo" value={integrante.nombre} onChange={v => actualizarIntegrante(indice, { nombre: v })} />
          <Field required label="Teléfono" value={integrante.telefono} onChange={v => actualizarIntegrante(indice, { telefono: v })} />
        </div>
        <Field label="Email" type="email" value={integrante.email} onChange={v => actualizarIntegrante(indice, { email: v })} />

        <div className="integrante-subsection">
          <strong>Tipo de solicitud</strong>
          <span>Selecciona la modalidad compartida de la asesoría y el trámite correspondiente a este integrante.</span>
        </div>
        <div className="two-cols">
          <label>Tipo de cliente / paquete
            <select value={integrante.tipoCliente} onChange={e => cambiarTipoCliente(indice, e.target.value)}>
              {Object.entries(config.tarifas).map(([id, t]) => <option key={id} value={id}>{t.label}</option>)}
            </select>
          </label>
          <label>Tipo de solicitud
            <select value={integrante.tipoSolicitud} onChange={e => cambiarSolicitud(indice, e.target.value)}>
              {tiposSolicitud.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </label>
        </div>
        {(() => {
          const tarifaConfigurada = config.tarifas[integrante.tipoCliente]?.[integrante.tipoSolicitud];
          const precioManual = precioManualIntegrante(ajustesNormalizados, integrante.id);
          const precioActual = precioManual !== null ? precioManual : tarifaConfigurada;
          return <div className="integrante-price-row">
            <div>
              <small>Valor de la asesoría</small>
              <strong>{precioActual === null || precioActual === undefined ? 'No aplica' : moneda(precioActual)}</strong>
              {precioManual !== null && <span>Precio personalizado</span>}
            </div>
            {puedeEditarPrecio && precioEditandoId !== integrante.id && tarifaConfigurada !== null && tarifaConfigurada !== undefined && <button type="button" className="price-edit-button" onClick={() => abrirEditorPrecio(integrante)}>✎ Editar precio</button>}
            {puedeEditarPrecio && precioEditandoId === integrante.id && <div className="price-editor">
              <label>Nuevo precio base
                <input type="number" min="0" step="1000" value={precioBorrador} onChange={e => setPrecioBorrador(e.target.value)} autoFocus />
              </label>
              <div className="price-editor-actions">
                <button type="button" className="price-apply-button" onClick={() => aplicarPrecio(integrante)}>Aplicar</button>
                <button type="button" className="price-cancel-button" onClick={() => { setPrecioEditandoId(''); setPrecioBorrador(''); }}>Cancelar</button>
                {precioManual !== null && <button type="button" className="price-reset-button" onClick={() => restaurarPrecio(integrante)}>Restaurar tarifa</button>}
              </div>
              <small>El descuento por cantidad, si aplica, se calculará sobre este nuevo precio.</small>
            </div>}
          </div>;
        })()}
        {integrante.tipoSolicitud === 'primeraVez' && <label>Valor informativo FedEx si la visa es aprobada
          <select value={integrante.fedex || ''} onChange={e => actualizarIntegrante(indice, { fedex: e.target.value })}>
            <option value="">No aplica / pendiente por definir</option>
            <option value={config.costos.fedexDomicilio}>Domicilio - {moneda(config.costos.fedexDomicilio)}</option>
            <option value={config.costos.fedexAltoPrado}>Recoger en FedEx Alto Prado - {moneda(config.costos.fedexAltoPrado)}</option>
          </select>
        </label>}
      </div>)}
    </div>

    <h2>4. Documentos recibidos</h2>
    <div className="integrantes-stack">
      {lista.map((integrante, indice) => <div className="integrante-card" key={`${integrante.id}-docs`}>
        <div className="integrante-title">Integrante {indice + 1} · {integrante.nombre || textoSolicitud(integrante.tipoSolicitud)}</div>
        <Checklist tipoSolicitud={integrante.tipoSolicitud} documentos={integrante.documentos} onChange={(id, checked) => actualizarIntegrante(indice, { documentos: { ...integrante.documentos, [id]: checked }, documentosObj: { ...integrante.documentos, [id]: checked } })} />
      </div>)}
    </div>
  </>;
}

function etiquetaSolicitudExportacion(tipo = '') {
  return tiposSolicitud.find(item => item.id === tipo)?.label || textoSolicitud(tipo);
}

function nombreArchivoExportacion(modoFecha, mesFiltro, fechaDesde, fechaHasta) {
  const hoy = partesFechaColombia(new Date()).clave;
  const periodo = modoFecha === 'mes'
    ? mesFiltro
    : modoFecha === 'rango'
      ? `${fechaDesde || 'inicio'}_a_${fechaHasta || 'fin'}`
      : 'todas_las_fechas';
  return `SIGV_Asesorias_${periodo}_${hoy}.xlsx`.replace(/[^a-zA-Z0-9_.-]/g, '_');
}

function construirHojasExportacion(casos = [], config = configuracionBase) {
  const filasAsesorias = [];
  const filasVisas = [];

  for (const caso of casos) {
    const integrantes = normalizarIntegrantes(caso);
    const calculo = calcularCaso(caso, config);
    const facturada = caso.facturacion?.estadoFactura === 'facturada';
    const fechaCreacion = claveCreacionCaso(caso);
    const fechaFacturacion = claveFacturacionCaso(caso);
    const principal = integrantes[0] || crearIntegrante(1);
    const nombresIntegrantes = integrantes.map(item => item.nombre || 'Sin nombre').join(' | ');
    const solicitudes = integrantes.map(item => etiquetaSolicitudExportacion(item.tipoSolicitud)).join(' | ');
    const tiposCliente = [...new Set(integrantes.map(item => normalizarConfiguracion(config).tarifas[item.tipoCliente]?.label || item.tipoCliente))].join(' | ');

    filasAsesorias.push([
      caso.id || '',
      fechaCreacion,
      caso.asesor || '',
      textoClienteCaso(caso),
      principal.telefono || caso.telefono || '',
      principal.email || caso.email || '',
      integrantes.length,
      nombresIntegrantes,
      solicitudes,
      tiposCliente,
      caso.estado || calculo.estado || '',
      caso.documentos || '',
      facturada ? 'Facturada' : 'Por facturar',
      fechaFacturacion,
      caso.facturacion?.nombre || '',
      caso.facturacion?.cedulaNit || '',
      caso.facturacion?.nombreEmpresaAfiliada || '',
      caso.facturacion?.ciudad || '',
      caso.facturacion?.medioPago || '',
      Number(calculo.subtotalAsesoria) || 0,
      Number(calculo.valorDescuento) || 0,
      Number(calculo.totalPesos) || 0,
      facturada ? valorFacturadoCaso(caso) : 0,
    ]);

    let descuentoAsignado = 0;
    calculo.detalleIntegrantes.forEach((detalle, indice) => {
      const tarifa = Number(detalle.tarifa) || 0;
      const esUltimo = indice === calculo.detalleIntegrantes.length - 1;
      const descuentoIndividual = esUltimo
        ? Math.max(0, Number(calculo.valorDescuento) - descuentoAsignado)
        : Math.max(0, Math.round(tarifa * calculo.porcentajeDescuento));
      descuentoAsignado += descuentoIndividual;
      const valorFinal = Math.max(0, tarifa - descuentoIndividual);
      filasVisas.push([
        caso.id || '',
        fechaCreacion,
        caso.asesor || '',
        indice + 1,
        detalle.nombre || `Integrante ${indice + 1}`,
        detalle.telefono || '',
        detalle.email || '',
        normalizarConfiguracion(config).tarifas[detalle.tipoCliente]?.label || detalle.tipoCliente,
        etiquetaSolicitudExportacion(detalle.tipoSolicitud),
        Number(detalle.tarifaConfigurada) || 0,
        detalle.precioPersonalizado ? 'Sí' : 'No',
        tarifa,
        Math.round((Number(calculo.porcentajeDescuento) || 0) * 100),
        descuentoIndividual,
        valorFinal,
        facturada ? 'Facturada' : 'Por facturar',
        fechaFacturacion,
        caso.facturacion?.nombreEmpresaAfiliada || '',
        caso.facturacion?.ciudad || '',
        caso.estado || calculo.estado || '',
      ]);
    });
  }

  return [
    {
      nombre: 'Asesorías',
      encabezados: [
        'ID', 'Fecha de creación', 'Asesor responsable', 'Cliente principal', 'Teléfono principal', 'Email principal',
        'Cantidad de visas', 'Integrantes', 'Tipos de solicitud', 'Tipo de cliente / paquete', 'Estado del proceso',
        'Documentos', 'Estado de facturación', 'Fecha de facturación', 'Nombre de facturación', 'Cédula / NIT',
        'Empresa afiliada', 'Ciudad', 'Medio de pago', 'Subtotal', 'Descuento', 'Total estimado', 'Valor facturado',
      ],
      filas: filasAsesorias,
      anchos: [14, 15, 20, 25, 17, 25, 14, 36, 28, 24, 28, 22, 18, 17, 24, 18, 28, 18, 18, 16, 16, 16, 16],
      columnasMoneda: [19, 20, 21, 22],
      columnasEntero: [6],
    },
    {
      nombre: 'Visas',
      encabezados: [
        'ID asesoría', 'Fecha de creación', 'Asesor responsable', 'N.º de visa', 'Nombre del integrante', 'Teléfono',
        'Email', 'Tipo de cliente / paquete', 'Tipo de solicitud', 'Tarifa configurada', 'Precio personalizado',
        'Precio base aplicado', 'Descuento (%)', 'Descuento individual', 'Valor final estimado',
        'Estado de facturación', 'Fecha de facturación', 'Empresa afiliada', 'Ciudad', 'Estado del proceso',
      ],
      filas: filasVisas,
      anchos: [14, 15, 20, 12, 28, 17, 25, 25, 20, 17, 18, 18, 15, 18, 18, 18, 17, 28, 18, 28],
      columnasMoneda: [9, 11, 13, 14],
      columnasEntero: [3, 12],
    },
  ];
}

function Casos({ casos, onOpen, config = configuracionBase }) {
  const hoy = partesFechaColombia(new Date());
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState('todos');
  const [solicitud, setSolicitud] = useState('todos');
  const [modoFecha, setModoFecha] = useState('todos');
  const [mesFiltro, setMesFiltro] = useState(claveMes(hoy.year, hoy.month));
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const rangoInvalido = modoFecha === 'rango' && fechaDesde && fechaHasta && fechaDesde > fechaHasta;
  const mesInvalido = modoFecha === 'mes' && !/^\d{4}-\d{2}$/.test(mesFiltro);
  const filtroFechaInvalido = rangoInvalido || mesInvalido;

  const filtrados = useMemo(() => {
    if (filtroFechaInvalido) return [];
    const q = normalizar(busqueda);
    return casos.filter(c => {
      const coincideTexto = !q || normalizar(`${c.id} ${c.asesor} ${c.nombre} ${c.telefono} ${c.email} ${normalizarIntegrantes(c).map(i => `${i.nombre} ${i.telefono} ${i.email}`).join(' ')}`).includes(q);
      const coincideEstado = estado === 'todos' || normalizar(c.estado).includes(normalizar(estado));
      const coincideSolicitud = solicitud === 'todos' || normalizarIntegrantes(c).some(i => i.tipoSolicitud === solicitud);
      const fechaCreacion = claveCreacionCaso(c);
      const coincideFecha = modoFecha === 'todos'
        || (modoFecha === 'mes' && !!fechaCreacion && fechaCreacion.startsWith(mesFiltro))
        || (modoFecha === 'rango' && !!fechaCreacion && (!fechaDesde || fechaCreacion >= fechaDesde) && (!fechaHasta || fechaCreacion <= fechaHasta));
      return coincideTexto && coincideEstado && coincideSolicitud && coincideFecha;
    });
  }, [busqueda, estado, solicitud, modoFecha, mesFiltro, fechaDesde, fechaHasta, filtroFechaInvalido, casos]);

  const descripcionFecha = modoFecha === 'mes'
    ? (mesInvalido ? 'Selecciona un mes válido' : `Mes completo: ${etiquetaMes(Number(mesFiltro.slice(0, 4)), Number(mesFiltro.slice(5, 7)))}`)
    : modoFecha === 'rango'
      ? `Rango: ${fechaDesde || 'inicio'} a ${fechaHasta || 'fin'}`
      : 'Todas las fechas de creación';

  function exportarExcel() {
    if (!filtrados.length || filtroFechaInvalido) return;
    try {
      descargarLibroXlsx({
        nombreArchivo: nombreArchivoExportacion(modoFecha, mesFiltro, fechaDesde, fechaHasta),
        hojas: construirHojasExportacion(filtrados, config),
      });
    } catch (error) {
      console.error('Error exportando Excel:', error);
      alert(`No se pudo generar el archivo de Excel. ${error.message || ''}`);
    }
  }

  return <section className="panel cases-page-panel">
    <div className="case-date-filter">
      <div className="case-date-filter-header">
        <div>
          <h2>Calendario y periodo de consulta</h2>
          <p>Selecciona asesorías por su fecha de creación. La exportación incluye exactamente los registros visibles.</p>
        </div>
        <button type="button" className="excel-export-button" onClick={exportarExcel} disabled={!filtrados.length || filtroFechaInvalido}>
          ↓ Exportar Excel ({filtrados.length})
        </button>
      </div>

      <div className="date-filter-modes" role="group" aria-label="Tipo de filtro de fecha">
        <button type="button" className={modoFecha === 'todos' ? 'active' : ''} onClick={() => setModoFecha('todos')}>Todas</button>
        <button type="button" className={modoFecha === 'mes' ? 'active' : ''} onClick={() => setModoFecha('mes')}>Mes completo</button>
        <button type="button" className={modoFecha === 'rango' ? 'active' : ''} onClick={() => setModoFecha('rango')}>Rango de fechas</button>
      </div>

      {modoFecha === 'mes' && <div className="date-filter-fields month-mode">
        <label>Mes a consultar
          <input type="month" value={mesFiltro} onChange={e => setMesFiltro(e.target.value)} />
        </label>
        <button type="button" className="secondary fit date-quick-button" onClick={() => setMesFiltro(claveMes(hoy.year, hoy.month))}>Mes actual</button>
      </div>}

      {modoFecha === 'rango' && <div className="date-filter-fields">
        <label>Fecha inicial
          <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
        </label>
        <label>Fecha final
          <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
        </label>
        <button type="button" className="secondary fit date-quick-button" onClick={() => { setFechaDesde(''); setFechaHasta(''); }}>Limpiar rango</button>
      </div>}

      <div className="date-filter-summary">
        <strong>{descripcionFecha}</strong>
        <span>El archivo contiene una hoja de asesorías y otra de visas por integrante.</span>
      </div>
      {rangoInvalido && <div className="alert-box">La fecha inicial no puede ser posterior a la fecha final.</div>}
      {mesInvalido && <div className="alert-box">Selecciona un mes válido para consultar.</div>}
    </div>

    <div className="toolbar cases-toolbar">
      <label>Buscar asesoría
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="ID, cliente, teléfono, asesor o email" />
      </label>
      <label>Estado del Proceso
        <select value={estado} onChange={e => setEstado(e.target.value)}>
          <option value="todos">Todos</option>
          {estadosProceso.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </label>
      <label>Solicitud
        <select value={solicitud} onChange={e => setSolicitud(e.target.value)}>
          <option value="todos">Todas</option>
          {tiposSolicitud.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </label>
    </div>
    <p className="hint">Mostrando {filtrados.length} de {casos.length} asesorías registradas. Filtro de fecha: {descripcionFecha.toLowerCase()}.</p>
    <CaseTable casos={filtrados} onOpen={onOpen} />
  </section>;
}

function CaseTable({ casos, onOpen, compacto = false }) {
  if (!casos.length) return <div className="empty">No hay asesorías para mostrar con los filtros seleccionados.</div>;
  return <div className="table-wrap">
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Asesor</th>
          <th>Cliente</th>
          {!compacto && <th>Teléfono</th>}
          <th>Solicitud</th>
          <th>Documentos</th>
          <th>Facturación AmCham</th>
          <th>Estado del Proceso</th>
          <th>Acción</th>
        </tr>
      </thead>
      <tbody>{casos.map(c => <tr key={c.id}>
        <td><strong>{c.id}</strong></td>
        <td>{c.asesor}</td>
        <td>{textoClienteCaso(c)}<br /><small>{normalizarIntegrantes(c).length} integrante{normalizarIntegrantes(c).length === 1 ? '' : 's'}{c.email ? ` · ${c.email}` : ''}</small></td>
        {!compacto && <td>{c.telefono}</td>}
        <td>{textoSolicitudesCaso(c)}<br /><small>{textoClientesCaso(c)}</small></td>
        <td>{c.documentos}</td>
        <td>{moneda(c.total)}</td>
        <td><span className={claseEstado(c.estado)}>{c.estado}</span></td>
        <td><button className="small-btn" onClick={() => onOpen(c.id)}>Abrir</button></td>
      </tr>)}</tbody>
    </table>
  </div>;
}

function DetalleCaso({ caso, onBack, onSave, onChangeCreationDate, onCorrectInvoice, onDelete, config, guardando = false, permisos = {} }) {
  const [edit, setEdit] = useState(() => ({ ...caso, integrantes: normalizarIntegrantes(caso).map(serializarIntegrante) }));
  const [nuevoSeguimiento, setNuevoSeguimiento] = useState('');
  const [fechaCreacionSeleccionada, setFechaCreacionSeleccionada] = useState(() => claveCreacionCaso(caso));
  const [correccionFactura, setCorreccionFactura] = useState(() => ({
    valor: valorFacturadoCaso(caso),
    tipoTramite: caso.facturacion?.tipoTramite || caso.tipoSolicitudKey || 'primeraVez',
    fechaFacturacion: claveFacturacionCaso(caso),
  }));
  useEffect(() => {
    setEdit({ ...caso, integrantes: normalizarIntegrantes(caso).map(serializarIntegrante) });
    setNuevoSeguimiento('');
    setFechaCreacionSeleccionada(claveCreacionCaso(caso));
    setCorreccionFactura({
      valor: valorFacturadoCaso(caso),
      tipoTramite: caso.facturacion?.tipoTramite || caso.tipoSolicitudKey || 'primeraVez',
      fechaFacturacion: claveFacturacionCaso(caso),
    });
  }, [caso.id, caso.updatedAtMs]);

  useEffect(() => {
    setFechaCreacionSeleccionada(claveCreacionCaso(caso));
  }, [caso.createdAtIso, caso.createdAtMs]);

  const integrantes = normalizarIntegrantes(edit);
  const principal = integrantes[0] || crearIntegrante(1);
  const calc = calcularCaso({
    integrantes,
    ajustesPrecio: edit.ajustesPrecio,
    aplicarDescuentoCantidad: descuentoCantidadActivo(edit),
    estadoManual: edit.estadoManual,
  }, config);

  function cambiarCantidad(valor) {
    const nuevaCantidad = Math.max(1, Math.min(30, Number(valor) || 1));
    const nuevosIntegrantes = ajustarCantidadIntegrantes(integrantes, nuevaCantidad);
    setEdit(prev => ({
      ...prev,
      cantidad: nuevaCantidad,
      integrantes: nuevosIntegrantes,
      ajustesPrecio: ajustesPrecioParaIntegrantes(prev.ajustesPrecio, nuevosIntegrantes),
      facturacion: facturacionSegunAfiliacion(prev.facturacion, nuevosIntegrantes),
      estadoManual: '',
    }));
  }

  function actualizarIntegrantes(nuevosIntegrantes) {
    setEdit(prev => ({
      ...prev,
      cantidad: nuevosIntegrantes.length,
      integrantes: nuevosIntegrantes,
      ajustesPrecio: ajustesPrecioParaIntegrantes(prev.ajustesPrecio, nuevosIntegrantes),
      facturacion: facturacionSegunAfiliacion(prev.facturacion, nuevosIntegrantes),
      estadoManual: '',
    }));
  }

  function guardar(motivo = 'Asesoría actualizada desde detalle.') {
    if (!permisos.puedeEditarCasos) {
      alert('Tu rol no permite guardar cambios en asesorías.');
      return;
    }
    if (!edit.asesor.trim()) {
      alert('El asesor responsable es obligatorio.');
      return;
    }
    for (const [indice, integrante] of integrantes.entries()) {
      const numero = indice + 1;
      if (!integrante.nombre.trim() || !integrante.telefono.trim()) {
        alert(`Nombre y teléfono son obligatorios para el integrante ${numero}.`);
        return;
      }
      const tarifa = config.tarifas[integrante.tipoCliente]?.[integrante.tipoSolicitud];
      if (tarifa === null || tarifa === undefined) {
        alert(`La combinación seleccionada para el integrante ${numero} no aplica. Cambia el tipo de cliente o solicitud.`);
        return;
      }
    }
    const casoNuevo = { ...edit, integrantes };
    const cambioPrecio = describirCambiosPrecio(caso, casoNuevo, config);
    const cambioFacturacion = describirCambioFacturacion(caso, casoNuevo);
    const cambioDescuento = describirCambioDescuento(caso, casoNuevo);
    const detallesCambio = [cambioPrecio, cambioFacturacion, cambioDescuento].filter(Boolean).join(' ');
    const motivoFinal = detallesCambio ? `${motivo} ${detallesCambio}` : motivo;
    onSave(casoNuevo, motivoFinal);
    alert('Asesoría actualizada.');
  }

  function agregarSeguimiento() {
    if (!permisos.puedeEditarCasos) {
      alert('Tu rol no permite agregar seguimientos.');
      return;
    }
    if (!nuevoSeguimiento.trim()) return;
    const actualizado = {
      ...edit,
      integrantes,
      seguimiento: nuevoSeguimiento.trim(),
      historial: [...(edit.historial || []), evento('Seguimiento', nuevoSeguimiento.trim(), edit.asesor || 'Asesor')],
    };
    setEdit(actualizado);
    onSave(actualizado, 'Se agregó seguimiento al historial de la asesoría.');
    setNuevoSeguimiento('');
  }

  return <div className="process-page">
    <section className="panel process-page-header">
      <button className="secondary" onClick={onBack}>← Volver a asesorías</button>
      <div className="section-title">
        <div>
          <h2>{edit.id}</h2>
          <p>{textoClienteCaso(edit)} · {integrantes.length} integrante{integrantes.length === 1 ? '' : 's'}</p>
        </div>
        <span className={claseEstado(calc.estado)}>{calc.estado}</span>
      </div>
      <div className="creation-date-control">
        <strong title="Esta fecha alimenta Dashboard, calendario, filtros, métricas y exportación Excel.">Fecha de creación</strong>
        <label title="Fecha registrada para esta asesoría">
          <input
            type="date"
            value={fechaCreacionSeleccionada}
            max={claveFechaDesdeValor(new Date())}
            onChange={e => setFechaCreacionSeleccionada(e.target.value)}
            disabled={!permisos.puedeCambiarFechaCreacion || guardando}
          />
        </label>
        {permisos.puedeCambiarFechaCreacion
          ? <button type="button" className="small-btn" disabled={guardando || !fechaCreacionSeleccionada || fechaCreacionSeleccionada === claveCreacionCaso(caso)} onClick={async () => {
            const guardado = await onChangeCreationDate?.(caso.id, fechaCreacionSeleccionada);
            if (guardado) alert('Fecha de creación actualizada y registrada en el historial.');
          }}>{guardando ? 'Guardando...' : 'Cambiar fecha'}</button>
          : <span className="hint" title="Solo un Administrador activo puede modificar esta fecha.">Solo lectura</span>}
      </div>
    </section>

    <div className="process-layout">
      <section className="panel process-column">
        <h2>1. Asesor responsable</h2>
        <AsesorSelect value={edit.asesor} onChange={v => setEdit({ ...edit, asesor: v })} asesoras={config.asesoras} />

        <h2>2. Cantidad</h2>
        <label>Cantidad de integrantes de la asesoría
          <input type="number" min="1" max="30" value={integrantes.length} onChange={e => cambiarCantidad(e.target.value)} />
        </label>
        <p className="hint">Al aumentar la cantidad se habilitan nuevos campos de datos, solicitud y documentos. Al reducirla, se eliminan los últimos integrantes del formulario.</p>
        <ControlDescuentoCantidad
          activo={descuentoCantidadActivo(edit)}
          onChange={aplicarDescuentoCantidad => setEdit(prev => ({ ...prev, aplicarDescuentoCantidad }))}
          puedeEditar={permisos.esAdministrador}
        />

        <IntegrantesSecciones
          integrantes={integrantes}
          onChange={actualizarIntegrantes}
          config={config}
          ajustesPrecio={edit.ajustesPrecio}
          onAjustesPrecioChange={ajustesPrecio => setEdit(prev => ({ ...prev, ajustesPrecio }))}
          puedeEditarPrecio={permisos.esAdministrador}
        />

        <h2>5. Asesoría</h2>
        <div className="two-cols">
          <label>Fecha tentativa de asesoría
            <input type="date" value={edit.fechaAsesoria || ''} onChange={e => setEdit({ ...edit, fechaAsesoria: e.target.value })} />
          </label>
          <label>Hora tentativa
            <input type="time" value={edit.horaAsesoria || ''} onChange={e => setEdit({ ...edit, horaAsesoria: e.target.value })} />
          </label>
        </div>

        <h2>6. Facturación</h2>
        <FacturacionFields
          data={edit.facturacion}
          onChange={facturacion => setEdit({ ...edit, facturacion })}
          tipoClienteKey={principal.tipoCliente}
          tipoSolicitudKey={principal.tipoSolicitud}
          datosCliente={{ nombre: principal.nombre, telefono: principal.telefono, correo: principal.email }}
          config={config}
          valorCaso={calc.totalPesos}
          cantidadIntegrantes={integrantes.length}
          descuentoCantidadHabilitado={calc.aplicarDescuentoCantidad}
          requiereEmpresaAfiliada={hayIntegranteAfiliado(integrantes)}
        />
        {edit.facturacion?.estadoFactura === 'facturada' && permisos.puedeCorregirFacturacion && <details className="invoice-correction-control">
          <summary>Corregir facturación registrada</summary>
          <div className="invoice-correction-content">
            <p className="hint">Uso exclusivo para corregir datos históricos confirmados. El valor, tipo y fecha anteriores quedan registrados en auditoría.</p>
            <div className="two-cols">
              <label>Valor facturado correcto
                <input type="number" min="1" step="1" value={correccionFactura.valor} onChange={e => setCorreccionFactura(prev => ({ ...prev, valor: e.target.value }))} />
              </label>
              <label>Tipo de trámite facturado
                <select value={correccionFactura.tipoTramite} onChange={e => setCorreccionFactura(prev => ({ ...prev, tipoTramite: e.target.value }))}>
                  {tiposSolicitud.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </label>
              <label>Fecha de facturación correcta
                <input type="date" max={claveFechaDesdeValor(new Date())} value={correccionFactura.fechaFacturacion} onChange={e => setCorreccionFactura(prev => ({ ...prev, fechaFacturacion: e.target.value }))} />
              </label>
            </div>
            <button type="button" className="primary fit" disabled={guardando} onClick={async () => {
              const corregido = await onCorrectInvoice?.(caso.id, { valorFacturadoNuevo: correccionFactura.valor, tipoTramiteNuevo: correccionFactura.tipoTramite, fechaFacturacionNueva: correccionFactura.fechaFacturacion });
              if (corregido) alert('Facturación corregida y registrada en el historial.');
            }}>{guardando ? 'Guardando...' : 'Confirmar corrección facturada'}</button>
          </div>
        </details>}

        <h2>7. Fecha Cita embajada</h2>
        <label>Fecha Cita embajada
          <input type="date" value={edit.fechaCitaEmbajada || ''} onChange={e => setEdit({ ...edit, fechaCitaEmbajada: e.target.value })} />
        </label>

        <h2>Observaciones y seguimiento</h2>
        <label>Observación general
          <textarea value={edit.observacion || ''} onChange={e => setEdit({ ...edit, observacion: e.target.value })} />
        </label>
        <label>Seguimiento actual
          <textarea value={edit.seguimiento || ''} onChange={e => setEdit({ ...edit, seguimiento: e.target.value })} />
        </label>

        <h2>Estado del Proceso</h2>
        <label>Estado actual
          <select value={normalizarEstadoProceso(edit.estadoManual) || calc.estado} onChange={e => setEdit({ ...edit, estadoManual: e.target.value })}>
            {estadosProceso.map(estado => <option key={estado} value={estado}>{estado}</option>)}
          </select>
        </label>

        <div className="actions-row">
          <button className="primary fit" onClick={() => guardar()} disabled={guardando || !permisos.puedeEditarCasos}>{guardando ? 'Guardando...' : 'Guardar cambios'}</button>
          {permisos.puedeEliminarCasos && <button type="button" className="danger fit" onClick={() => onDelete?.(edit.id)} disabled={guardando}>Eliminar asesoría</button>}
        </div>

        <div className="collapsible-stack">
          <details className="collapse-panel">
            <summary>
              <span>Nuevo seguimiento</span>
              <small>Agregar una nota al historial de la asesoría</small>
            </summary>
            <div className="collapse-content">
              <textarea value={nuevoSeguimiento} onChange={e => setNuevoSeguimiento(e.target.value)} placeholder="Ej: se llamó al cliente, falta soporte, asesoría reagendada..." />
              <button className="primary fit" onClick={agregarSeguimiento} disabled={!permisos.puedeEditarCasos}>Agregar al historial</button>
            </div>
          </details>
          <Historial historial={edit.historial || []} />
        </div>
      </section>

      <Resumen
        calculo={calc}
        facturacion={edit.facturacion}
        tipoClienteKey={principal.tipoCliente}
        config={config}
        fechaAsesoria={edit.fechaAsesoria}
        horaAsesoria={edit.horaAsesoria}
        fechaCitaEmbajada={edit.fechaCitaEmbajada}
        cantidadIntegrantes={integrantes.length}
        requiereEmpresaAfiliada={hayIntegranteAfiliado(integrantes)}
      />
    </div>
  </div>;
}

function Plantillas({ casos, onOpen }) {
  const [plantillaId, setPlantillaId] = useState(plantillas[0].id);
  const [casoId, setCasoId] = useState(casos[0]?.id || '');
  const [copiado, setCopiado] = useState(false);
  const plantilla = plantillas.find(p => p.id === plantillaId) || plantillas[0];
  const caso = casos.find(c => c.id === casoId) || casos[0];
  const texto = aplicarPlantilla(plantilla.cuerpo, caso);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(`Asunto: ${plantilla.asunto}\n\n${texto}`);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      alert('No se pudo copiar automáticamente. Puedes seleccionar el texto manualmente.');
    }
  }

  return <section className="panel">
    <div className="toolbar">
      <label>Plantilla
        <select value={plantillaId} onChange={e => setPlantillaId(e.target.value)}>
          {plantillas.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}
        </select>
      </label>
      <label>Asesoría relacionada
        <select value={caso?.id || ''} onChange={e => setCasoId(e.target.value)}>
          {casos.map(c => <option key={c.id} value={c.id}>{c.id} · {textoClienteCaso(c)}</option>)}
        </select>
      </label>
    </div>

    {!caso && <div className="empty">Crea una asesoría para poder personalizar plantillas.</div>}
    {caso && <>
      <div className="template-box">
        <strong>Asunto sugerido:</strong>
        <p>{plantilla.asunto}</p>
        <textarea value={texto} readOnly />
      </div>
      <div className="actions-row">
        <button className="primary fit" onClick={copiar}>{copiado ? 'Copiado' : 'Copiar plantilla'}</button>
        <button className="secondary fit" onClick={() => onOpen(caso.id)}>Abrir asesoría relacionada</button>
      </div>
    </>}
  </section>;
}

function aplicarPlantilla(cuerpo, caso) {
  if (!caso) return cuerpo;
  const integrantes = normalizarIntegrantes(caso);
  const faltantes = integrantes.flatMap((integrante, indice) => documentosRequeridos(integrante.tipoSolicitud)
    .filter(id => !integrante.documentos?.[id])
    .map(id => `- Integrante ${indice + 1} (${integrante.nombre || 'sin nombre'}): ${documentosCatalogo[id]?.label || id}`))
    .join('\n') || '- No hay documentos pendientes.';
  const cliente = integrantes.length > 1 ? `${integrantes[0]?.nombre || 'cliente'} y grupo familiar` : (integrantes[0]?.nombre || caso.nombre || 'cliente');

  return cuerpo
    .replaceAll('{{cliente}}', cliente)
    .replaceAll('{{asesor}}', caso.asesor || 'Equipo de visas')
    .replaceAll('{{documentosPendientes}}', faltantes);
}

function Historial({ historial }) {
  const total = historial.length;
  return <details className="collapse-panel">
    <summary>
      <span>Historial cronológico</span>
      <small>{total} movimiento{total === 1 ? '' : 's'} registrado{total === 1 ? '' : 's'}</small>
    </summary>
    <div className="collapse-content">
      {!historial.length && <p className="hint">Aún no hay movimientos registrados.</p>}
      <div className="timeline">
        {historial.slice().reverse().map(item => <div className="timeline-item" key={item.id}>
          <strong>{item.tipo}</strong>
          <span>{item.fecha} · {item.asesor}</span>
          <p>{item.texto}</p>
        </div>)}
      </div>
    </div>
  </details>;
}

function FacturacionFields({ data, onChange, tipoClienteKey, tipoSolicitudKey, datosCliente = {}, config, valorCaso = null, cantidadIntegrantes = 1, descuentoCantidadHabilitado = true, requiereEmpresaAfiliada = false }) {
  const [copiadoFacturacion, setCopiadoFacturacion] = useState(false);
  const valorFinal = valorCaso !== null && valorCaso !== undefined ? Number(valorCaso) : null;
  const facturacion = normalizarFacturacion(data, { tipoClienteKey, tipoSolicitudKey, requiereEmpresaAfiliada }, config, valorFinal);
  const valor = valorFinal !== null ? valorFinal : calcularValorFacturacion(facturacion, tipoClienteKey, config);

  function actualizar(campo, valorCampo) {
    onChange(normalizarFacturacion({ ...facturacion, [campo]: valorCampo }, { tipoClienteKey, tipoSolicitudKey, requiereEmpresaAfiliada }, config, valorFinal));
  }

  function copiarDatosCliente() {
    onChange(normalizarFacturacion({
      ...facturacion,
      nombre: datosCliente.nombre || facturacion.nombre,
      telefono: datosCliente.telefono || facturacion.telefono,
      correo: datosCliente.correo || facturacion.correo,
      tipoTramite: tipoSolicitudKey || facturacion.tipoTramite,
    }, { tipoClienteKey, tipoSolicitudKey, requiereEmpresaAfiliada }, config, valorFinal));
  }

  async function copiarDatosFacturacion() {
    const texto = generarTextoFacturacion(facturacion, tipoClienteKey, tipoSolicitudKey, config, valor, cantidadIntegrantes);
    try {
      await navigator.clipboard.writeText(texto);
      setCopiadoFacturacion(true);
      setTimeout(() => setCopiadoFacturacion(false), 1800);
    } catch {
      alert('No se pudo copiar automáticamente. Puedes seleccionar los datos manualmente.');
    }
  }

  return <div className="facturacion-box">
    <div className="actions-row compact">
      <button type="button" className="secondary fit" onClick={copiarDatosCliente}>Copiar datos del cliente</button>
      <button type="button" className="primary fit" onClick={copiarDatosFacturacion}>{copiadoFacturacion ? 'Datos copiados' : 'Copiar datos Facturación'}</button>
      <span className="hint">{descuentoCantidadHabilitado
        ? 'El valor corresponde a la facturación AmCham. El descuento por cantidad, cuando aplica, ya está incluido.'
        : 'El valor corresponde a la facturación AmCham sin descuento por cantidad.'}</span>
    </div>
    <div className="two-cols">
      <Field label="Nombre" value={facturacion.nombre} onChange={v => actualizar('nombre', v)} />
      <Field label="Cédula o NIT" value={facturacion.cedulaNit} onChange={v => actualizar('cedulaNit', v)} />
      <Field label="Teléfono" value={facturacion.telefono} onChange={v => actualizar('telefono', v)} />
      <Field label="Dirección" value={facturacion.direccion} onChange={v => actualizar('direccion', v)} />
      <Field label="Ciudad" value={facturacion.ciudad} onChange={v => actualizar('ciudad', v)} />
      {requiereEmpresaAfiliada && <Field label="Nombre de la empresa afiliada" value={facturacion.nombreEmpresaAfiliada} onChange={v => actualizar('nombreEmpresaAfiliada', v)} />}
      <Field label="Correo" type="email" value={facturacion.correo} onChange={v => actualizar('correo', v)} />
      <label>Tipo de trámite
        <select value={facturacion.tipoTramite} onChange={e => actualizar('tipoTramite', e.target.value)}>
          {tiposSolicitud.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </label>
      <label>Medio de pago
        <select value={facturacion.medioPago} onChange={e => actualizar('medioPago', e.target.value)}>
          <option value="">Seleccionar medio de pago</option>
          <option value="Transferencia">Transferencia</option>
          <option value="Efectivo">Efectivo</option>
          <option value="Wompi">Wompi</option>
        </select>
      </label>
      <label>Estado de facturación
        <select value={facturacion.estadoFactura} onChange={e => actualizar('estadoFactura', e.target.value)}>
          <option value="porFacturar">Por facturar</option>
          <option value="facturada">Facturada</option>
        </select>
      </label>
      <label>Valor
        <input readOnly value={valor === null ? 'No aplica' : moneda(valor)} />
      </label>
    </div>
    {facturacion.estadoFactura === 'facturada' && <div className="invoice-date-note">
      <strong>Registro de facturación</strong>
      <span>
        {fechaFacturacionLegible(facturacion) || 'La fecha se registrará automáticamente al guardar.'}
        {' · '}{moneda(Number(facturacion.valorFacturado) > 0 ? facturacion.valorFacturado : valor)}
        {' · '}{Number(facturacion.cantidadVisasFacturadas) > 0 ? facturacion.cantidadVisasFacturadas : cantidadIntegrantes} visa{(Number(facturacion.cantidadVisasFacturadas) > 0 ? Number(facturacion.cantidadVisasFacturadas) : Number(cantidadIntegrantes)) === 1 ? '' : 's'}
        {facturacion.fechaFacturacionInferida ? ' · Fecha asignada por migración inicial' : ''}
      </span>
    </div>}
  </div>;
}

function Checklist({ tipoSolicitud, documentos, onChange }) {
  return <div className="checklist">
    {documentosRequeridos(tipoSolicitud).map(id => <label key={id} className="check-item">
      <input type="checkbox" checked={!!documentos?.[id]} onChange={e => onChange(id, e.target.checked)} />
      <span>{documentosCatalogo[id]?.label || id}</span>
    </label>)}
  </div>;
}

function Resumen({ calculo, facturacion, tipoClienteKey, config, fechaAsesoria, horaAsesoria, fechaCitaEmbajada, cantidadIntegrantes = 1, requiereEmpresaAfiliada = false }) {
  const facturacionNormalizada = normalizarFacturacion(facturacion, { tipoClienteKey, requiereEmpresaAfiliada }, config, calculo.totalPesos);
  const descuentoPorcentaje = Number(calculo.porcentajeDescuento) || 0;
  return <section className="panel summary process-summary">
    <h2>Resumen del Proceso</h2>
    <p className="summary-intro">Vista actualizada automáticamente con la información registrada en la asesoría.</p>

    <div className="summary-members">
      {(calculo.detalleIntegrantes || []).map(detalle => {
        const tarifaBase = Number(detalle.tarifa) || 0;
        const valorFinalIntegrante = Math.round(tarifaBase * (1 - descuentoPorcentaje));
        return <div className="summary-member-card" key={detalle.id || detalle.numero}>
          <div className="summary-member-title">Integrante {detalle.numero}</div>
          <Line label="Nombre" value={detalle.nombre || 'Pendiente'} />
          <Line label="Tipo de solicitud" value={textoSolicitud(detalle.tipoSolicitud)} />
          <Line label="Valor" value={moneda(valorFinalIntegrante)} />
          {detalle.precioPersonalizado && descuentoPorcentaje === 0 && <small>Precio personalizado aplicado.</small>}
          {descuentoPorcentaje > 0 && <small>{detalle.precioPersonalizado ? 'Precio base personalizado' : 'Tarifa base'}: {moneda(tarifaBase)} · descuento aplicado: {Math.round(descuentoPorcentaje * 100)}%</small>}
        </div>;
      })}
    </div>

    <div className="summary-grid">
      <Line label="Integrantes" value={calculo.cantidad || cantidadIntegrantes || 1} />
      <Line label="Subtotal asesoría" value={moneda(calculo.subtotalAsesoria ?? calculo.tarifa)} />
      <Line label="Descuento por cantidad" value={!calculo.aplicarDescuentoCantidad
        ? 'Desactivado para esta asesoría'
        : calculo.valorDescuento
          ? `${calculo.descuentoDescripcion} · -${moneda(calculo.valorDescuento)}`
          : 'No aplica por cantidad'} />
      <div className="total"><span>Total a facturar por AmCham</span><strong>{moneda(calculo.totalPesos)}</strong></div>
    </div>

    <div className="info-box">
      <strong>Valores informativos para el cliente</strong>
      <p>Estos valores no ingresan a AmCham y se muestran únicamente para el presupuesto del cliente.</p>
      <Line label="Envío Bogotá / Renovación" value={calculo.valorInformativoEnvioBogota ? moneda(calculo.valorInformativoEnvioBogota) : 'No aplica'} />
      <Line label="FedEx" value={calculo.fedex ? moneda(calculo.fedex) : 'No aplica / pendiente'} />
      <Line label="Derechos consulares" value={calculo.requiereDerechos ? `USD ${calculo.derechosConsularesUsd}` : 'No aplica'} />
    </div>

    <div className={claseEstado(calculo.estado)}>{calculo.estado}</div>
    <p className="hint">Documentos: {calculo.completos}/{calculo.requeridos.length}. El estado se calcula con todos los integrantes o la selección manual.</p>
    {(fechaAsesoria || horaAsesoria) && <p className="hint"><strong>Asesoría:</strong> {fechaAsesoria || 'sin fecha'} {horaAsesoria || ''}</p>}

    {facturacion && <div className="info-box muted">
      <strong>Facturación</strong>
      <Line label="Nombre" value={facturacionNormalizada.nombre || 'Pendiente'} />
      <Line label="Ciudad" value={facturacionNormalizada.ciudad || 'Pendiente'} />
      {requiereEmpresaAfiliada && <Line label="Empresa afiliada" value={facturacionNormalizada.nombreEmpresaAfiliada || 'Pendiente'} />}
      <Line label="Tipo de trámite" value={textoSolicitud(facturacionNormalizada.tipoTramite)} />
      <Line label="Medio de pago" value={facturacionNormalizada.medioPago || 'Pendiente'} />
      <Line label="Facturación" value={facturacionNormalizada.estadoFactura === 'facturada' ? 'Facturada' : 'Por facturar'} />
      {facturacionNormalizada.estadoFactura === 'facturada' && <Line label="Fecha facturación" value={fechaFacturacionLegible(facturacionNormalizada) || 'Pendiente de guardar'} />}
      {facturacionNormalizada.estadoFactura === 'facturada' && facturacionNormalizada.facturadoPor && <Line label="Registrada por" value={facturacionNormalizada.facturadoPor} />}
      {facturacionNormalizada.estadoFactura === 'facturada' && facturacionNormalizada.fechaFacturacionInferida && <Line label="Origen de la fecha" value="Migración inicial · 1 de julio de 2026" />}
      <Line label="Valor actual" value={facturacionNormalizada.valor ? moneda(facturacionNormalizada.valor) : 'No aplica'} />
      {facturacionNormalizada.estadoFactura === 'facturada' && <Line label="Valor facturado registrado" value={moneda(Number(facturacionNormalizada.valorFacturado) > 0 ? facturacionNormalizada.valorFacturado : facturacionNormalizada.valor)} />}
    </div>}
    {fechaCitaEmbajada && <p className="hint"><strong>Fecha Cita embajada:</strong> {fechaCitaEmbajada}</p>}
  </section>;
}

function AsesorSelect({ value, onChange, asesoras }) {
  const asesorasLimpias = asesoras.map(a => String(a || '').trim()).filter(Boolean);
  const existeSeleccion = value && asesorasLimpias.includes(value);
  return <label>Nombre del asesor<span className="required">Obligatorio</span>
    <select value={value} onChange={e => onChange(e.target.value)}>
      <option value="">Seleccionar asesora</option>
      {!existeSeleccion && value && <option value={value}>{value} · no está en configuración</option>}
      {asesorasLimpias.map(asesora => <option key={asesora} value={asesora}>{asesora}</option>)}
    </select>
  </label>;
}

function Field({ label, value, onChange, required = false, type = 'text' }) {
  return <label>{label}{required && <span className="required">Obligatorio</span>}<input type={type} value={value} onChange={e => onChange(e.target.value)} /></label>;
}

function Card({ title, value }) {
  return <div className="card"><span>{title}</span><strong>{value}</strong></div>;
}

function VisasCard({ total, porFacturar, facturadas, subtitulo = 'Acumulado general' }) {
  return <div className="card visas-card">
    <span>Total de visas</span>
    <strong>{total}</strong>
    <small>{subtitulo}</small>
    <div className="visas-breakdown">
      <div><span>Por facturar</span><b>{porFacturar}</b></div>
      <div><span>Facturadas</span><b>{facturadas}</b></div>
    </div>
  </div>;
}

function Line({ label, value }) {
  return <div className="line"><span>{label}</span><strong>{value}</strong></div>;
}

function claseEstado(estado = '') {
  if (estado.includes('Finalizado')) return 'pill done';
  if (estado.includes('Asesoría Agendada') || estado.includes('Cita embajada')) return 'pill info';
  if (estado.includes('Pendiente')) return 'pill warn';
  return 'pill ok';
}


function ModalNotificacion({ modal, onClose, onConfirm }) {
  if (!modal) return null;
  const esConfirmacion = modal.tipo === 'confirmacion';
  return <div className="modal-overlay" role="dialog" aria-modal="true">
    <div className="modal-card">
      <h2>{modal.titulo}</h2>
      <p>{modal.mensaje}</p>
      <div className="modal-actions">
        {esConfirmacion && <button type="button" className="secondary fit" onClick={onClose}>Cancelar</button>}
        <button type="button" className="primary fit" onClick={esConfirmacion ? onConfirm : onClose}>{modal.boton || 'Aceptar'}</button>
      </div>
    </div>
  </div>;
}


function Configuracion({ config, setConfig, usuariosSigv = [], onSaveUsuario, onResetRoles, guardando = false, perfilActual = null, seguridad = {}, onActivateSecurity }) {
  const [borrador, setBorrador] = useState(() => normalizarConfiguracion(config));
  const [nuevaAsesora, setNuevaAsesora] = useState('');
  const [usuarioRol, setUsuarioRol] = useState({ nombre: '', email: '', rol: 'asesor', activo: true });
  const [modal, setModal] = useState(null);
  const existeAdministradorActivo = hayAdministradorActivoGuardado(usuariosSigv);

  useEffect(() => {
    setBorrador(normalizarConfiguracion(config));
  }, [config]);

  function mostrarModal(titulo, mensaje, tipo = 'info', onConfirm = null) {
    setModal({ titulo, mensaje, tipo, onConfirm, boton: tipo === 'confirmacion' ? 'Confirmar' : 'Aceptar' });
  }

  function cerrarModal() {
    setModal(null);
  }

  function confirmarModal() {
    const accion = modal?.onConfirm;
    setModal(null);
    if (accion) accion();
  }

  function actualizarTarifa(tipoCliente, campo, valor) {
    setBorrador(prev => normalizarConfiguracion({
      ...prev,
      tarifas: {
        ...prev.tarifas,
        [tipoCliente]: {
          ...prev.tarifas[tipoCliente],
          [campo]: valor === '' ? null : Number(valor),
        },
      },
    }));
  }

  function actualizarCosto(campo, valor) {
    setBorrador(prev => normalizarConfiguracion({
      ...prev,
      costos: {
        ...prev.costos,
        [campo]: valor === '' ? 0 : Number(valor),
      },
    }));
  }

  function actualizarAsesora(indice, valor) {
    setBorrador(prev => {
      const asesoras = [...prev.asesoras];
      asesoras[indice] = valor;
      return { ...prev, asesoras };
    });
  }

  function agregarAsesora() {
    const nombre = nuevaAsesora.trim();
    if (!nombre) return;
    if (borrador.asesoras.some(a => normalizar(a) === normalizar(nombre))) {
      mostrarModal('Asesora duplicada', 'Esa asesora ya está registrada en la configuración.');
      return;
    }
    setBorrador(prev => normalizarConfiguracion({ ...prev, asesoras: [...prev.asesoras, nombre] }));
    setNuevaAsesora('');
  }

  function eliminarAsesora(indice) {
    if (borrador.asesoras.length === 1) {
      mostrarModal('No se puede eliminar', 'Debe quedar al menos una asesora en configuración.');
      return;
    }
    const nombre = borrador.asesoras[indice];
    mostrarModal(
      'Eliminar asesora',
      `¿Deseas eliminar a ${nombre} del listado de asesoras? Las asesorías antiguas conservarán su nombre, pero ya no aparecerá como opción para nuevos registros.`,
      'confirmacion',
      () => setBorrador(prev => normalizarConfiguracion({ ...prev, asesoras: prev.asesoras.filter((_, i) => i !== indice) }))
    );
  }

  function restaurarValoresBase() {
    mostrarModal(
      'Restaurar configuración base',
      '¿Deseas restaurar las tarifas, valores informativos y asesoras base? Recuerda que el cambio solo quedará aplicado cuando presiones Guardar.',
      'confirmacion',
      () => setBorrador(normalizarConfiguracion(configuracionBase))
    );
  }

  async function guardarConfiguracion() {
    const limpia = normalizarConfiguracion(borrador);
    try {
      await setConfig(limpia);
      mostrarModal('Configuración guardada', 'Los cambios fueron guardados correctamente en Firestore y ya se reflejan en Nueva asesoría, Asesorías y Resumen del Proceso.');
    } catch {
      mostrarModal('Error al guardar', 'No se pudo guardar la configuración en Firestore. Revisa la conexión o las reglas de seguridad.');
    }
  }

  return <div className="config-stack">
    <ModalNotificacion modal={modal} onClose={cerrarModal} onConfirm={confirmarModal} />

    <section className="panel notice-panel">
      <div>
        <h2>Configuración</h2>
        <p>Los cambios que hagas en esta sección quedan como borrador hasta presionar el botón <strong>Guardar</strong>. Esta será la única manera de aplicar modificaciones de tarifas, valores informativos o asesoras.</p>
      </div>
      <button type="button" className="primary fit" onClick={guardarConfiguracion} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
    </section>

    <section className="panel google-calendar-config">
      <div className="section-title">
        <div>
          <h2>Integración con Google Calendar</h2>
          <p>Configuración técnica para consultar eventos. El ID de cliente identifica la aplicación, no es una contraseña.</p>
        </div>
        <span className="pill ok">calendar.readonly</span>
      </div>
      <div className="two-cols">
        <label>ID de cliente OAuth 2.0
          <input value={borrador.googleCalendar?.clientId || ''} onChange={e => setBorrador(prev => normalizarConfiguracion({ ...prev, googleCalendar: { ...prev.googleCalendar, clientId: e.target.value } }))} placeholder="000000000000-xxxxxxxx.apps.googleusercontent.com" />
        </label>
        <label>ID del calendario
          <input value={borrador.googleCalendar?.calendarId || 'primary'} onChange={e => setBorrador(prev => normalizarConfiguracion({ ...prev, googleCalendar: { ...prev.googleCalendar, calendarId: e.target.value } }))} placeholder="primary" />
        </label>
      </div>
      <p className="hint">Usa <strong>primary</strong> para consultar el calendario principal de la cuenta que autoriza el acceso. En Google Cloud debes habilitar Calendar API y registrar el dominio de Vercel como origen JavaScript autorizado.</p>
    </section>

    <section className="panel security-panel">
      <div className="section-title">
        <div>
          <h2>Seguridad de acceso</h2>
          <p>Los permisos se validan en Firestore y no solamente en la interfaz.</p>
        </div>
        <span className={seguridad?.primerAdministradorConfigurado ? 'pill ok' : 'pill warn'}>{seguridad?.primerAdministradorConfigurado ? 'Protección activa' : 'Activación pendiente'}</span>
      </div>
      {seguridad?.primerAdministradorConfigurado ? <>
        <p><strong>Administrador principal protegido:</strong> {seguridad?.primerAdministradorEmail || perfilActual?.email}</p>
        <p className="hint">Los usuarios sin perfil quedan bloqueados. Solo un Administrador activo puede modificar usuarios, configuración o eliminar asesorías.</p>
      </> : <div className="actions-row compact">
        <div>
          <strong>Falta cerrar la inicialización de seguridad.</strong>
          <p className="hint">Actívala antes de publicar las reglas estrictas incluidas en este paquete.</p>
        </div>
        <button type="button" className="primary fit" onClick={onActivateSecurity} disabled={guardando}>{guardando ? 'Activando...' : 'Activar seguridad'}</button>
      </div>}
    </section>

    <section className="panel">
      <div className="section-title">
        <div>
          <h2>Usuarios y roles</h2>
          <p>Primero crea el usuario en Firebase Authentication. Luego registra aquí el mismo correo y asigna su rol operativo dentro de SIGV.</p>
        </div>
        <span className="pending-save">Fase 5A</span>
      </div>

      <div className="role-grid">
        {Object.values(rolesSigv).map(rol => <div className="role-card" key={rol.id}>
          <strong>{rol.label}</strong>
          <p>{rol.descripcion}</p>
        </div>)}
      </div>

      {!existeAdministradorActivo && <div className="alert-box diagnostic">No hay un Administrador activo guardado. Guarda tu usuario como Administrador o usa Reiniciar roles para corregir el acceso.</div>}

      <div className="actions-row compact">
        <button type="button" className="danger fit" disabled={guardando} onClick={onResetRoles}>{guardando ? 'Guardando...' : 'Reiniciar roles'}</button>
        <span className="hint">Regla de seguridad operativa: siempre debe existir al menos un Administrador activo.</span>
      </div>

      <div className="table-wrap mt-small">
        <table>
          <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Acción</th></tr></thead>
          <tbody>
            {usuariosSigv.map(usuario => <tr key={usuario.email || usuario.id}>
              <td>{usuario.nombre}</td>
              <td>{usuario.email}</td>
              <td><span className="pill info">{rolesSigv[normalizarRolSigv(usuario.rol)]?.label}</span></td>
              <td><span className={usuario.activo ? 'pill ok' : 'pill warn'}>{usuario.activo ? 'Activo' : 'Inactivo'}</span></td>
              <td><button type="button" className="small-btn" onClick={() => setUsuarioRol({ nombre: usuario.nombre, email: usuario.email, rol: normalizarRolSigv(usuario.rol), activo: usuario.activo !== false })}>Editar</button></td>
            </tr>)}
            {!usuariosSigv.length && <tr><td colSpan="5">No hay usuarios configurados todavía.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="two-cols mt-small">
        <label>Nombre
          <input value={usuarioRol.nombre} onChange={e => setUsuarioRol({ ...usuarioRol, nombre: e.target.value })} placeholder="Nombre visible" />
        </label>
        <label>Correo de acceso
          <input type="email" value={usuarioRol.email} onChange={e => setUsuarioRol({ ...usuarioRol, email: e.target.value })} placeholder="correo@empresa.com" />
        </label>
        <label>Rol
          <select value={usuarioRol.rol} onChange={e => setUsuarioRol({ ...usuarioRol, rol: e.target.value })}>
            {Object.values(rolesSigv).map(rol => <option key={rol.id} value={rol.id}>{rol.label}</option>)}
          </select>
        </label>
        <label>Estado
          <select value={usuarioRol.activo ? 'activo' : 'inactivo'} onChange={e => setUsuarioRol({ ...usuarioRol, activo: e.target.value === 'activo' })}>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>
        </label>
      </div>
      <div className="actions-row">
        <button type="button" className="primary fit" disabled={guardando} onClick={async () => {
          const guardado = await onSaveUsuario?.(usuarioRol);
          if (guardado !== false) setUsuarioRol({ nombre: '', email: '', rol: 'asesor', activo: true });
        }}>{guardando ? 'Guardando...' : 'Guardar usuario/rol'}</button>
        <button type="button" className="secondary fit" onClick={() => setUsuarioRol({ nombre: '', email: '', rol: 'asesor', activo: true })}>Limpiar</button>
      </div>
    </section>

    <section className="panel">
      <div className="section-title">
        <div>
          <h2>Tarifas de asesoría</h2>
          <p>Estos valores sí corresponden a ingresos/facturación de AmCham y alimentan el cálculo de Nueva asesoría, Asesorías y Resumen del Proceso.</p>
        </div>
        <span className="pending-save">Pendiente guardar</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Tipo cliente</th><th>Primera vez</th><th>Renovación</th><th>Actualización</th><th>Global Entry</th></tr></thead>
          <tbody>{Object.entries(borrador.tarifas).map(([id, t]) => <tr key={id}>
            <td><strong>{t.label}</strong></td>
            <td><MoneyInput value={t.primeraVez} onChange={v => actualizarTarifa(id, 'primeraVez', v)} /></td>
            <td><MoneyInput value={t.renovacion} onChange={v => actualizarTarifa(id, 'renovacion', v)} /></td>
            <td><MoneyInput value={t.actualizacion} onChange={v => actualizarTarifa(id, 'actualizacion', v)} /></td>
            <td><MoneyInput value={t.globalEntry} onChange={v => actualizarTarifa(id, 'globalEntry', v)} /></td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="hint">Deja un campo vacío cuando esa combinación no aplique.</p>
    </section>

    <section className="panel">
      <div className="section-title">
        <div>
          <h2>Valores informativos para el cliente</h2>
          <p>Estos valores no suman a la facturación de AmCham. Solo sirven para informar al cliente costos que debe pagar directamente a terceros, al consulado o al proveedor correspondiente.</p>
        </div>
      </div>
      <div className="two-cols">
        <label>Envío documentación Bogotá / Renovación
          <input type="number" min="0" value={borrador.costos.envioDocumentacionBogota} onChange={e => actualizarCosto('envioDocumentacionBogota', e.target.value)} />
        </label>
        <label>Derechos consulares en USD
          <input type="number" min="0" value={borrador.costos.derechosConsularesUsd} onChange={e => actualizarCosto('derechosConsularesUsd', e.target.value)} />
        </label>
        <label>FedEx domicilio
          <input type="number" min="0" value={borrador.costos.fedexDomicilio} onChange={e => actualizarCosto('fedexDomicilio', e.target.value)} />
        </label>
        <label>FedEx Alto Prado
          <input type="number" min="0" value={borrador.costos.fedexAltoPrado} onChange={e => actualizarCosto('fedexAltoPrado', e.target.value)} />
        </label>
      </div>
    </section>

    <section className="panel">
      <div className="section-title">
        <div>
          <h2>Asesoras</h2>
          <p>Este listado se conecta con el campo Asesor responsable en Nueva asesoría y Asesorías después de guardar la configuración.</p>
        </div>
      </div>
      <div className="advisor-list">
        {borrador.asesoras.map((asesora, indice) => <div className="advisor-row" key={`${asesora}-${indice}`}>
          <input value={asesora} onChange={e => actualizarAsesora(indice, e.target.value)} />
          <button type="button" className="danger" onClick={() => eliminarAsesora(indice)}>Eliminar</button>
        </div>)}
      </div>
      <div className="add-row">
        <input value={nuevaAsesora} onChange={e => setNuevaAsesora(e.target.value)} onKeyDown={e => e.key === 'Enter' && agregarAsesora()} placeholder="Nombre de nueva asesora" />
        <button type="button" className="primary fit" onClick={agregarAsesora}>Agregar asesora</button>
      </div>
      <p className="hint">Si eliminas una asesora, las asesorías antiguas conservan su nombre, pero ya no aparecerá como opción para nuevos registros después de guardar.</p>
    </section>

    <section className="panel actions-row">
      <button type="button" className="secondary fit" onClick={restaurarValoresBase}>Restaurar configuración base</button>
      <button type="button" className="primary fit" onClick={guardarConfiguracion} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
      <span className="hint">La configuración se guarda en Firebase Firestore. Los valores informativos no se suman a la facturación de AmCham.</span>
    </section>
  </div>;
}

function MoneyInput({ value, onChange }) {
  return <input className="money-input" type="number" min="0" value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder="No aplica" />;
}

createRoot(document.getElementById('root')).render(<App />);
