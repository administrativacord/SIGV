import { auth, firebaseConfig } from './firebase';

const PROJECT_ID = firebaseConfig.projectId;
const DATABASE_ID = '(default)';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;
const COMMIT_URL = `${BASE_URL}:commit`;

function conTimeout(promesa, ms = 15000, mensaje = 'Firestore REST no respondió a tiempo.') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(mensaje)), ms);
  });
  return Promise.race([promesa, timeout]).finally(() => clearTimeout(timer));
}

async function obtenerToken() {
  const user = auth.currentUser;
  if (!user) throw new Error('No hay usuario autenticado para consultar Firestore.');
  return user.getIdToken();
}

function codificarValor(valor) {
  if (valor === undefined) return undefined;
  if (valor === null) return { nullValue: null };
  if (typeof valor === 'string') return { stringValue: valor };
  if (typeof valor === 'boolean') return { booleanValue: valor };
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor)) return { nullValue: null };
    return Number.isInteger(valor) ? { integerValue: String(valor) } : { doubleValue: valor };
  }
  if (Array.isArray(valor)) {
    const values = valor.map(codificarValor).filter(Boolean);
    return values.length ? { arrayValue: { values } } : { arrayValue: {} };
  }
  if (valor && typeof valor === 'object') {
    return { mapValue: { fields: codificarCampos(valor) } };
  }
  return { stringValue: String(valor) };
}

function codificarCampos(objeto = {}) {
  return Object.fromEntries(
    Object.entries(objeto)
      .map(([clave, valor]) => [clave, codificarValor(valor)])
      .filter(([, valor]) => valor !== undefined)
  );
}

function decodificarValor(valor = {}) {
  if ('stringValue' in valor) return valor.stringValue;
  if ('integerValue' in valor) return Number(valor.integerValue);
  if ('doubleValue' in valor) return Number(valor.doubleValue);
  if ('booleanValue' in valor) return Boolean(valor.booleanValue);
  if ('nullValue' in valor) return null;
  if ('timestampValue' in valor) return valor.timestampValue;
  if ('arrayValue' in valor) return (valor.arrayValue.values || []).map(decodificarValor);
  if ('mapValue' in valor) return decodificarCampos(valor.mapValue.fields || {});
  return undefined;
}

function decodificarCampos(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([clave, valor]) => [clave, decodificarValor(valor)]));
}

function limpiarIdDocumento(name = '') {
  try {
    return decodeURIComponent(name.split('/').pop());
  } catch {
    return name.split('/').pop();
  }
}

function segmentoDocumento(id = '') {
  return encodeURIComponent(String(id));
}

function nombreDocumento(coleccion, documentoId) {
  return `${BASE_URL}/${coleccion}/${segmentoDocumento(documentoId)}`;
}

async function requestFirestore(url, opciones = {}, timeoutMs = 15000) {
  const token = await obtenerToken();
  const respuesta = await conTimeout(fetch(url, {
    ...opciones,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(opciones.headers || {}),
    },
  }), timeoutMs, 'Firestore REST tardó demasiado en responder.');

  if (respuesta.status === 404) return null;

  let data = null;
  try {
    data = await respuesta.json();
  } catch {
    data = null;
  }

  if (!respuesta.ok) {
    const detalle = data?.error?.message || respuesta.statusText || 'error desconocido';
    const error = new Error(`Firestore REST ${respuesta.status}: ${detalle}`);
    error.status = respuesta.status;
    throw error;
  }

  return data;
}

export async function obtenerDocumentoRest(coleccion, documentoId) {
  const data = await requestFirestore(nombreDocumento(coleccion, documentoId));
  if (!data) return null;
  return { id: limpiarIdDocumento(data.name), ...decodificarCampos(data.fields || {}) };
}

export async function listarColeccionRest(coleccion) {
  const documentos = [];
  let pageToken = '';

  do {
    const parametros = new URLSearchParams({ pageSize: '100' });
    if (pageToken) parametros.set('pageToken', pageToken);
    const data = await requestFirestore(`${BASE_URL}/${coleccion}?${parametros.toString()}`);
    if (!data) return documentos;
    if (Array.isArray(data.documents)) documentos.push(...data.documents);
    pageToken = data.nextPageToken || '';
  } while (pageToken);

  return documentos.map(doc => ({ id: limpiarIdDocumento(doc.name), ...decodificarCampos(doc.fields || {}) }));
}

export async function guardarDocumentoRest(coleccion, documentoId, datos) {
  const payload = { fields: codificarCampos(datos) };
  const data = await requestFirestore(nombreDocumento(coleccion, documentoId), {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }, 20000);
  return { id: documentoId, ...decodificarCampos(data?.fields || {}) };
}

export async function eliminarDocumentoRest(coleccion, documentoId) {
  await requestFirestore(nombreDocumento(coleccion, documentoId), {
    method: 'DELETE',
  }, 20000);
  return { id: documentoId, eliminado: true };
}

export async function inicializarPrimerAdministradorRest({ email, nombre }) {
  const correo = String(email || '').trim().toLowerCase();
  if (!correo) throw new Error('No se pudo identificar el correo autenticado.');

  const ahoraIso = new Date().toISOString();
  const ahoraMs = Date.now();
  const usuario = {
    id: correo,
    email: correo,
    nombre: String(nombre || correo).trim(),
    rol: 'administrador',
    activo: true,
    provisional: false,
    creadoEnFase5A: true,
    createdAtIso: ahoraIso,
    updatedAtIso: ahoraIso,
    updatedAtMs: ahoraMs,
    actualizadoPor: correo,
  };
  const seguridad = {
    primerAdministradorConfigurado: true,
    primerAdministradorEmail: correo,
    inicializacionCerrada: true,
    versionSeguridad: '5A.1',
    initializedAtIso: ahoraIso,
    updatedAtIso: ahoraIso,
    updatedAtMs: ahoraMs,
    actualizadoPor: correo,
  };

  const data = await requestFirestore(COMMIT_URL, {
    method: 'POST',
    body: JSON.stringify({
      writes: [
        {
          update: {
            name: nombreDocumento('usuariosSigv', correo),
            fields: codificarCampos(usuario),
          },
        },
        {
          update: {
            name: nombreDocumento('configuracion', 'seguridad'),
            fields: codificarCampos(seguridad),
          },
          currentDocument: { exists: false },
        },
      ],
    }),
  }, 25000);

  return { usuario, seguridad, commitTime: data?.commitTime || '' };
}

export async function activarSeguridadAdministradorRest(email) {
  const correo = String(email || '').trim().toLowerCase();
  if (!correo) throw new Error('No se pudo identificar el correo del Administrador.');
  const ahoraIso = new Date().toISOString();
  const seguridad = {
    primerAdministradorConfigurado: true,
    primerAdministradorEmail: correo,
    inicializacionCerrada: true,
    versionSeguridad: '5A.1',
    initializedAtIso: ahoraIso,
    updatedAtIso: ahoraIso,
    updatedAtMs: Date.now(),
    actualizadoPor: correo,
  };
  return guardarDocumentoRest('configuracion', 'seguridad', seguridad);
}

export async function diagnosticarFirestoreRest() {
  const token = await obtenerToken();
  const url = nombreDocumento('diagnosticoSigv', 'conexion');
  const inicio = Date.now();
  const respuesta = await conTimeout(fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        ok: { booleanValue: true },
        email: { stringValue: auth.currentUser?.email || '' },
        fechaIso: { stringValue: new Date().toISOString() },
      },
    }),
  }), 15000, 'La prueba REST de Firestore no respondió en 15 segundos.');

  const data = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    const detalle = data?.error?.message || respuesta.statusText || 'error desconocido';
    throw new Error(`Firestore REST ${respuesta.status}: ${detalle}`);
  }
  return { ok: true, ms: Date.now() - inicio };
}
