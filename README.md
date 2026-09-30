# Inscripción — Presentación de la paleta

La gente escanea el QR del club → elige día y horario → se reserva el lugar → botón para unirse al grupo de WhatsApp de su turno.

- 3 fines de semana × viernes, sábado y domingo × 19, 20 y 21 h = **27 turnos de 30 personas = 810 lugares**.
- Los cupos se cuentan en MySQL (Hostinger). La reserva es un único `UPDATE ... WHERE ocupados < 30`, así que nunca pasa de 30 aunque se anoten 50 a la vez.
- Cada celular recuerda su turno: si vuelve a escanear, ve su grupo directamente (no cuenta dos veces). Puede **cambiar de horario**, y eso libera el lugar anterior.
- Los turnos que ya empezaron se ocultan solos.
- `admin.html` → tabla con anotados por turno, para Francisco.

## Archivos (todo lo de `public/` se sube a Hostinger)

| Archivo | Qué es |
|---|---|
| `config.js` | Fechas, horarios, cupo, links de WhatsApp |
| `api-config.php` | Datos de la base MySQL (+ cupo y horas, iguales a `config.js`). **No va a git**: si no está, copiarlo de `api-config.example.php` |
| `api.php` | Lee y reserva cupos. Crea la tabla `turnos` sola |
| `index.html` · `app.js` · `styles.css` · `store.js` | La página que abre el QR |
| `admin.html` | Tabla de anotados |
| `.htaccess` | Bloquea el acceso a `api-config.php` |

## Probar en la compu (modo demo)

En `localhost` corre sin servidor ni base: los cupos se guardan en el navegador.

```bash
python -m http.server 5173 --directory public
```

Abrir http://localhost:5173 y http://localhost:5173/admin.html

## Subir a Hostinger (una sola vez)

1. **Base de datos**: hPanel → *Bases de datos → Administración* → crear base + usuario. Anotar nombre, usuario y clave (Hostinger les antepone `u123456789_`).
2. **Completar** `public/api-config.php` con esos datos, y `public/config.js` con las fechas de los 3 viernes y los links de WhatsApp.
3. **Subir** todo el contenido de `public/` (incluido `.htaccess`, que está oculto) a `public_html/padel/` con el *Administrador de archivos* o por FTP.
4. **Probar**: abrir `https://tudominio.com/padel/api.php` → tiene que mostrar `{"ocupados":{}}`. Si dice `{"error":"db"}`, revisar los datos de `api-config.php`.
5. Verificar que `https://tudominio.com/padel/api-config.php` dé **403** (prohibido).

`https://tudominio.com/padel/` **es el link que va en el QR.** Tabla de anotados: `https://tudominio.com/padel/admin.html`.

## Grupos de WhatsApp

- Un grupo por turno (27): cargar cada link en `LINKS` con la clave `'AAAA-MM-DD-HHMM'`.
- Un grupo por día (9) o uno solo: usar `LINK_POR_DEFECTO` y/o repetir el mismo link.
- En cada grupo conviene activar *"Aprobar nuevos participantes"* para que el link no se viralice fuera del club.

## Antes del evento

- **Probar** desde 2–3 celulares distintos: anotarse, cambiar de turno, ver `admin.html`.
- **Resetear** los contadores de la prueba: hPanel → phpMyAdmin → tabla `turnos` → *Vaciar*.
- **No cambiar** fechas u horarios que ya tengan anotados (el contador se guarda por fecha + hora). Agregar un finde nuevo sí se puede.
- Para corregir a mano un turno: phpMyAdmin → tabla `turnos` → editar `ocupados`.

## Límites a saber

- El contador cuenta quién **reservó** en la página, no quién entró realmente al grupo (WhatsApp no lo expone).
- Alguien que borre los datos del navegador o use otro celular podría anotarse dos veces. Para una inscripción de club alcanza; si hiciera falta más control, se puede pedir nombre y teléfono y guardarlos en la misma base.
