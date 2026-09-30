import { DIAS } from './config.js';

export const TURNOS = DIAS.flatMap((dia) =>
  dia.horarios.map((h) => ({
    ...h,
    id: `${dia.id}-${h.hora.replace(':', '')}`,
    dia,
  })),
);

export const turnoPorId = (id) => TURNOS.find((t) => t.id === id);

export class LlenoError extends Error {}
export class ClaveError extends Error {}

// En la compu (localhost) o con ?demo en la URL corre sin servidor:
// cupos e inscriptos se guardan sólo en ese navegador.
export function esDemo() {
  return ['localhost', '127.0.0.1'].includes(location.hostname) || location.search.includes('demo');
}

export async function crearStore() {
  return esDemo() ? crearStoreDemo() : crearStoreApi();
}

// ── api.php (Hostinger) ──────────────────────────────────────

async function post(body) {
  const r = await fetch('api.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await r.json().catch(() => ({}));
  if (r.status === 409 && json.error === 'lleno') throw new LlenoError();
  if (!r.ok) throw new Error(json.error || `api ${r.status}`);
  return json;
}

function crearStoreApi() {
  return {
    demo: false,

    async leer() {
      const r = await fetch('api.php', { cache: 'no-store' });
      if (!r.ok) throw new Error(`api ${r.status}`);
      return (await r.json()).ocupados;
    },

    // → { token, personas }
    reservar: (turno, { nombre, telefono, acompanantes }) =>
      post({ accion: 'reservar', turno: turno.id, nombre, telefono, acompanantes }),

    cambiar: (token, turno) => post({ accion: 'cambiar', token, turno: turno.id }),

    cancelar: (token) => post({ accion: 'baja', token }),

    async inscriptos(clave) {
      const r = await fetch('api.php?inscriptos=1', { cache: 'no-store', headers: { 'X-Clave': clave } });
      if (r.status === 403) throw new ClaveError();
      if (!r.ok) throw new Error(`api ${r.status}`);
      return (await r.json()).inscriptos;
    },
  };
}

// ── modo demo: todo en localStorage ──────────────────────────

function crearStoreDemo() {
  const KEY = 'padel-demo';
  const cargar = () => {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d?.ocupados && d?.reservas) return d;
    } catch {}
    return { ocupados: {}, reservas: {} };
  };
  const guardar = (d) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(d));
    } catch {}
  };
  const espera = () => new Promise((r) => setTimeout(r, 400));

  return {
    demo: true,

    async leer() {
      return cargar().ocupados;
    },

    async reservar(turno, { nombre, telefono, acompanantes }) {
      await espera();
      const d = cargar();
      const personas = 1 + acompanantes;
      if ((d.ocupados[turno.id] || 0) + personas > turno.cupo) throw new LlenoError();
      d.ocupados[turno.id] = (d.ocupados[turno.id] || 0) + personas;
      const token = crypto.randomUUID().replace(/-/g, '');
      d.reservas[token] = { turno: turno.id, nombre, telefono, personas, creada: new Date().toISOString() };
      guardar(d);
      return { token, personas };
    },

    async cambiar(token, turno) {
      await espera();
      const d = cargar();
      const r = d.reservas[token];
      if (!r) throw new Error('reserva');
      if ((d.ocupados[turno.id] || 0) + r.personas > turno.cupo) throw new LlenoError();
      d.ocupados[turno.id] = (d.ocupados[turno.id] || 0) + r.personas;
      d.ocupados[r.turno] = Math.max(0, (d.ocupados[r.turno] || 0) - r.personas);
      r.turno = turno.id;
      guardar(d);
    },

    async cancelar(token) {
      await espera();
      const d = cargar();
      const r = d.reservas[token];
      if (r) {
        d.ocupados[r.turno] = Math.max(0, (d.ocupados[r.turno] || 0) - r.personas);
        delete d.reservas[token];
        guardar(d);
      }
    },

    async inscriptos() {
      return Object.values(cargar().reservas).sort((a, b) =>
        (a.turno + a.creada).localeCompare(b.turno + b.creada),
      );
    },
  };
}
