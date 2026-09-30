// ─────────────────────────────────────────────────────────────
//  CONFIGURACIÓN — lo único que hay que tocar
// ─────────────────────────────────────────────────────────────

export const EVENTO = {
  titulo: 'Presentación de la paleta',
  lugar: 'En el club',
  bajada:
    'Charla de 1 hora + práctica en espacio reducido. Elegí tu turno y te llevamos al grupo de WhatsApp.',
};

// El VIERNES de cada fin de semana (AAAA-MM-DD). Se generan viernes, sábado y domingo.
export const FINES_DE_SEMANA = ['2026-10-09', '2026-10-16', '2026-10-23'];

// Turnos de cada día y personas por turno.
// Si cambiás esto, cambiá también 'cupo' y 'horas' en api-config.php.
export const HORARIOS = ['19:00', '20:00', '21:00'];
export const CUPO_POR_TURNO = 30;
// Cuántas personas puede sumar cada inscripto además de él. Cada una ocupa un lugar.
// Si lo cambiás, cambiá también 'max_acompanantes' en api-config.php.
export const MAX_ACOMPANANTES = 3;

// Link de invitación del grupo de WhatsApp (WhatsApp > grupo > Invitar por enlace).
// LINK_POR_DEFECTO se usa para cualquier turno que no esté en LINKS.
// Si querés un grupo por turno, agregalo en LINKS con la clave 'AAAA-MM-DD-HHMM':
//   '2026-10-09-1900': 'https://chat.whatsapp.com/xxxx',
// Si preferís un grupo por día, repetí el mismo link en los 3 turnos de ese día.
export const LINK_POR_DEFECTO = 'https://chat.whatsapp.com/REEMPLAZAR';
export const LINKS = {};

// ─────────────────────────────────────────────────────────────
//  De acá para abajo no hace falta tocar nada.
//  OJO: una vez que la gente se empiece a anotar no cambies fechas ni
//  horarios ya publicados: el contador de cada turno usa fecha + hora.
// ─────────────────────────────────────────────────────────────

const NOMBRES = ['Viernes', 'Sábado', 'Domingo'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function sumarDias(iso, n) {
  const [a, m, d] = iso.split('-').map(Number);
  const f = new Date(Date.UTC(a, m - 1, d + n));
  return f.toISOString().slice(0, 10);
}

export const DIAS = FINES_DE_SEMANA.flatMap((viernes, finde) =>
  NOMBRES.map((nombre, i) => {
    const id = sumarDias(viernes, i);
    const [, m, d] = id.split('-').map(Number);
    return {
      id,
      finde: finde + 1,
      nombre,
      fecha: `${d} ${MESES[m - 1]}`,
      horarios: HORARIOS.map((hora) => {
        const turnoId = `${id}-${hora.replace(':', '')}`;
        return { hora, cupo: CUPO_POR_TURNO, whatsapp: LINKS[turnoId] || LINK_POR_DEFECTO };
      }),
    };
  }),
);
