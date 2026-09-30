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

// En la compu (localhost) o con ?demo en la URL corre sin servidor:
// los cupos se guardan sólo en ese navegador.
export function esDemo() {
  return ['localhost', '127.0.0.1'].includes(location.hostname) || location.search.includes('demo');
}

export async function crearStore() {
  return esDemo() ? crearStoreDemo() : crearStoreApi();
}

// Contadores en MySQL a través de api.php (Hostinger).
function crearStoreApi() {
  return {
    demo: false,

    async leer() {
      const r = await fetch('api.php', { cache: 'no-store' });
      if (!r.ok) throw new Error(`api ${r.status}`);
      return (await r.json()).ocupados;
    },

    // Suma 1 al turno nuevo (si hay lugar) y, si cambia de horario, libera el anterior.
    async reservar(turno, anteriorId) {
      const r = await fetch('api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turno: turno.id, anterior: anteriorId || '' }),
      });
      if (r.status === 409) throw new LlenoError();
      if (!r.ok) throw new Error(`api ${r.status}`);
    },
  };
}

// Modo demo: mismos contadores pero en localStorage de este navegador.
function crearStoreDemo() {
  const KEY = 'padel-demo-ocupados';
  const cargar = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || {};
    } catch {
      return {};
    }
  };
  const guardar = (o) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(o));
    } catch {}
  };

  return {
    demo: true,
    async leer() {
      return cargar();
    },
    async reservar(turno, anteriorId) {
      await new Promise((r) => setTimeout(r, 400));
      const o = cargar();
      if ((o[turno.id] || 0) >= turno.cupo) throw new LlenoError();
      o[turno.id] = (o[turno.id] || 0) + 1;
      if (anteriorId && o[anteriorId] > 0) o[anteriorId] -= 1;
      guardar(o);
    },
  };
}
