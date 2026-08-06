import React, { useState } from 'react';
import { listarEventosCalendar, solicitarTokenLecturaCalendar } from './googleCalendarService';
import {
  ZONA_HORARIA_CALENDAR,
  claveFechaCalendar,
  esEventoVisaGoogle,
  fechaEventoGoogle,
  fechaLargaCalendar,
  horaEventoGoogle,
  sumarDiasClave,
} from './googleCalendarUtils';
import './agendaGoogle.css';

function ResumenAgenda({ titulo, valor }) {
  return <div className="card"><span>{titulo}</span><strong>{valor}</strong></div>;
}

export default function AgendaGoogleCalendar({ config = {} }) {
  const hoy = claveFechaCalendar();
  const [fechaDesde, setFechaDesde] = useState(hoy);
  const [fechaHasta, setFechaHasta] = useState(() => sumarDiasClave(hoy, 30));
  const [eventos, setEventos] = useState([]);
  const [token, setToken] = useState('');
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState('Conecta Google Calendar para consultar la agenda del periodo.');
  const [ultimaConsulta, setUltimaConsulta] = useState('');
  const clientId = String(config.clientId || '').trim();
  const calendarId = String(config.calendarId || 'primary').trim() || 'primary';

  async function escanear() {
    if (!fechaDesde || !fechaHasta) return setMensaje('Selecciona la fecha inicial y la fecha final.');
    if (fechaDesde > fechaHasta) return setMensaje('La fecha inicial no puede ser posterior a la fecha final.');
    if ((Date.parse(`${fechaHasta}T12:00:00Z`) - Date.parse(`${fechaDesde}T12:00:00Z`)) / 86400000 > 366) {
      return setMensaje('El rango máximo permitido es de 366 días.');
    }
    try {
      setCargando(true);
      setMensaje('Consultando Google Calendar en modo de solo lectura...');
      const tokenActual = token || await solicitarTokenLecturaCalendar(clientId);
      if (!token) setToken(tokenActual);
      const encontrados = await listarEventosCalendar({
        token: tokenActual,
        calendarId,
        fechaDesde,
        fechaHastaExclusiva: sumarDiasClave(fechaHasta, 1),
        timeZone: ZONA_HORARIA_CALENDAR,
      });
      setEventos(encontrados);
      setUltimaConsulta(new Date().toLocaleString('es-CO', { timeZone: ZONA_HORARIA_CALENDAR }));
      setMensaje(`${encontrados.length} evento${encontrados.length === 1 ? '' : 's'} encontrado${encontrados.length === 1 ? '' : 's'} entre ${fechaDesde} y ${fechaHasta}.`);
    } catch (error) {
      if (error.status === 401) setToken('');
      console.error('Error consultando Google Calendar:', error);
      setMensaje(`No fue posible consultar Google Calendar: ${error.message || 'error desconocido'}`);
    } finally {
      setCargando(false);
    }
  }

  const grupos = eventos.reduce((mapa, item) => {
    const clave = fechaEventoGoogle(item) || 'sin-fecha';
    if (!mapa.has(clave)) mapa.set(clave, []);
    mapa.get(clave).push(item);
    return mapa;
  }, new Map());
  const eventosVisa = eventos.filter(esEventoVisaGoogle).length;

  return <div className="google-agenda-stack">
    <section className="panel google-agenda-filter">
      <div className="section-title"><div><h2>Escanear agenda por rango</h2><p>Consulta eventos programados desde hoy en adelante. SIGV solicita únicamente permiso de lectura y no puede modificar el calendario.</p></div><span className="pill ok">Solo lectura</span></div>
      {!clientId && <div className="alert-box diagnostic">Falta configurar el ID de cliente OAuth de Google. Regístralo en Configuración → Integración con Google Calendar.</div>}
      <div className="google-agenda-controls">
        <label>Desde<input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} /></label>
        <label>Hasta<input type="date" value={fechaHasta} min={fechaDesde} onChange={e => setFechaHasta(e.target.value)} /></label>
        <button type="button" className="primary fit" onClick={escanear} disabled={cargando || !clientId}>{cargando ? 'Escaneando...' : token ? 'Actualizar eventos' : 'Conectar y escanear'}</button>
      </div>
      <p className="hint">{mensaje}{ultimaConsulta ? ` Última consulta: ${ultimaConsulta}.` : ''}</p>
    </section>
    <section className="dashboard-operational-cards google-agenda-summary">
      <ResumenAgenda titulo="Eventos del rango" valor={eventos.length} />
      <ResumenAgenda titulo="Posibles eventos de visa" valor={eventosVisa} />
      <ResumenAgenda titulo="Requieren revisión" valor={eventos.length - eventosVisa} />
    </section>
    {[...grupos.entries()].map(([fecha, lista]) => <section className="panel google-agenda-day" key={fecha}>
      <div className="section-title"><div><h2>{fechaLargaCalendar(fecha)}</h2><p>{lista.length} evento{lista.length === 1 ? '' : 's'}</p></div></div>
      <div className="google-event-list">{lista.map(item => <article className="google-event-card" key={item.id}>
        <div className="google-event-time">{horaEventoGoogle(item)}</div>
        <div><div className="google-event-heading"><strong>{item.summary || 'Evento sin título'}</strong><span className={esEventoVisaGoogle(item) ? 'pill info' : 'pill warn'}>{esEventoVisaGoogle(item) ? 'Posible visa' : 'Revisar'}</span></div>
          {item.location && <p><strong>Ubicación:</strong> {item.location}</p>}
          {item.description && <p className="google-event-description">{item.description}</p>}
          <small>Organiza: {item.organizer?.displayName || item.organizer?.email || 'No disponible'}{item.attendees?.length ? ` · ${item.attendees.length} invitado${item.attendees.length === 1 ? '' : 's'}` : ''}</small>
        </div>
      </article>)}</div>
    </section>)}
    {!eventos.length && <div className="empty">Todavía no hay eventos cargados para mostrar.</div>}
  </div>;
}
