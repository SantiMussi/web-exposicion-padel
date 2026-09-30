<?php
// API de cupos e inscripciones.
//
//   GET  api.php                                  → { "ocupados": { "2026-10-09-1900": 12, ... } }
//   POST { accion: "reservar", turno, nombre, telefono, acompanantes }
//                                                  → { token, personas } | 409 { error: "lleno" }
//   POST { accion: "cambiar", token, turno }       → { ok } | 409 { error: "lleno" }
//   POST { accion: "baja", token }                 → { ok }
//   GET  api.php?inscriptos=1  (header X-Clave)    → { inscriptos: [...] }   ← sólo organización
//
// `turnos` guarda cuántas personas hay en cada turno; `reservas` guarda quién se anotó.
// Las bajas no se borran: quedan con fecha en `cancelada`.
// Las tablas se crean solas la primera vez.

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$cfg = require __DIR__ . '/api-config.php';
$maxAcompanantes = (int) ($cfg['max_acompanantes'] ?? 3);

function responder(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

function falla(Throwable $e): void
{
    error_log('padel api: ' . $e->getMessage());
    responder(500, ['error' => 'db']);
}

function turnoValido(string $id, array $cfg): bool
{
    // AAAA-MM-DD-HHMM con una hora habilitada
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})-(\d{4})$/', $id, $m)) return false;
    if (!checkdate((int) $m[2], (int) $m[3], (int) $m[1])) return false;
    return in_array($m[4], $cfg['horas'], true);
}

// Suma (o resta) personas a un turno. Al sumar, sólo lo hace si entran en el cupo:
// MySQL bloquea la fila mientras evalúa, así que nunca se pasa aunque lleguen juntos.
function sumar(PDO $db, string $turno, int $personas, int $cupo): bool
{
    $db->prepare('INSERT IGNORE INTO turnos (id, ocupados) VALUES (?, 0)')->execute([$turno]);
    $q = $db->prepare('UPDATE turnos SET ocupados = ocupados + ? WHERE id = ? AND ocupados + ? <= ?');
    $q->execute([$personas, $turno, $personas, $cupo]);
    return $q->rowCount() === 1;
}

function restar(PDO $db, string $turno, int $personas): void
{
    $db->prepare('UPDATE turnos SET ocupados = GREATEST(ocupados - ?, 0) WHERE id = ?')
        ->execute([$personas, $turno]);
}

function buscarReserva(PDO $db, string $token): ?array
{
    if (!preg_match('/^[a-f0-9]{32}$/', $token)) return null;
    $q = $db->prepare('SELECT turno, personas FROM reservas WHERE token = ? AND cancelada IS NULL');
    $q->execute([$token]);
    return $q->fetch(PDO::FETCH_ASSOC) ?: null;
}

try {
    $db = new PDO(
        "mysql:host={$cfg['db_host']};dbname={$cfg['db_nombre']};charset=utf8mb4",
        $cfg['db_usuario'],
        $cfg['db_clave'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    $db->exec('CREATE TABLE IF NOT EXISTS turnos (
        id VARCHAR(20) PRIMARY KEY,
        ocupados INT NOT NULL DEFAULT 0
    )');
    $db->exec('CREATE TABLE IF NOT EXISTS reservas (
        token CHAR(32) PRIMARY KEY,
        turno VARCHAR(20) NOT NULL,
        nombre VARCHAR(80) NOT NULL,
        telefono VARCHAR(30) NOT NULL,
        personas TINYINT NOT NULL,
        creada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        cancelada DATETIME NULL,
        INDEX (turno)
    ) DEFAULT CHARSET=utf8mb4');
} catch (Throwable $e) {
    falla($e);
}

// ── lecturas ────────────────────────────────────────────────

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (isset($_GET['inscriptos'])) {
        $clave = (string) ($cfg['admin_clave'] ?? '');
        $enviada = (string) ($_SERVER['HTTP_X_CLAVE'] ?? '');
        if ($clave === '' || $clave === 'REEMPLAZAR' || !hash_equals($clave, $enviada)) {
            usleep(500000); // frena a quien pruebe claves al azar
            responder(403, ['error' => 'clave']);
        }
        $filas = $db->query('SELECT turno, nombre, telefono, personas, creada FROM reservas
            WHERE cancelada IS NULL ORDER BY turno, creada')->fetchAll(PDO::FETCH_ASSOC);
        foreach ($filas as &$f) $f['personas'] = (int) $f['personas'];
        responder(200, ['inscriptos' => $filas]);
    }

    $ocupados = [];
    foreach ($db->query('SELECT id, ocupados FROM turnos') as $fila) {
        $ocupados[$fila['id']] = (int) $fila['ocupados'];
    }
    responder(200, ['ocupados' => (object) $ocupados]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') responder(405, ['error' => 'metodo']);

// ── escrituras ──────────────────────────────────────────────
// Sin transacciones a propósito: cada UPDATE es atómico por sí solo y así no hay
// deadlocks cuando muchos se anotan al mismo turno a la vez.

$datos = json_decode(file_get_contents('php://input'), true) ?: [];
$accion = (string) ($datos['accion'] ?? '');

try {
    if ($accion === 'reservar') {
        $turno = (string) ($datos['turno'] ?? '');
        $nombre = trim(preg_replace('/\s+/u', ' ', (string) ($datos['nombre'] ?? '')));
        $telefono = preg_replace('/[^\d+]/', '', (string) ($datos['telefono'] ?? ''));
        $acompanantes = (int) ($datos['acompanantes'] ?? 0);

        if (!turnoValido($turno, $cfg)) responder(400, ['error' => 'turno']);
        if (mb_strlen($nombre) < 3 || mb_strlen($nombre) > 80) responder(400, ['error' => 'nombre']);
        if (strlen(preg_replace('/\D/', '', $telefono)) < 8 || strlen($telefono) > 20) responder(400, ['error' => 'telefono']);
        if ($acompanantes < 0 || $acompanantes > $maxAcompanantes) responder(400, ['error' => 'acompanantes']);

        $personas = 1 + $acompanantes;
        if (!sumar($db, $turno, $personas, $cfg['cupo'])) responder(409, ['error' => 'lleno']);

        $token = bin2hex(random_bytes(16));
        try {
            $db->prepare('INSERT INTO reservas (token, turno, nombre, telefono, personas) VALUES (?, ?, ?, ?, ?)')
                ->execute([$token, $turno, $nombre, $telefono, $personas]);
        } catch (Throwable $e) {
            restar($db, $turno, $personas); // no dejar lugares tomados sin reserva
            throw $e;
        }
        responder(200, ['token' => $token, 'personas' => $personas]);
    }

    if ($accion === 'cambiar') {
        $turno = (string) ($datos['turno'] ?? '');
        if (!turnoValido($turno, $cfg)) responder(400, ['error' => 'turno']);
        $reserva = buscarReserva($db, (string) ($datos['token'] ?? ''));
        if (!$reserva) responder(404, ['error' => 'reserva']);
        if ($reserva['turno'] === $turno) responder(200, ['ok' => true]);

        $personas = (int) $reserva['personas'];
        if (!sumar($db, $turno, $personas, $cfg['cupo'])) responder(409, ['error' => 'lleno']);

        // Mueve la reserva sólo si sigue en el turno viejo (por si llegan dos pedidos juntos).
        $mover = $db->prepare('UPDATE reservas SET turno = ? WHERE token = ? AND turno = ? AND cancelada IS NULL');
        $mover->execute([$turno, $datos['token'], $reserva['turno']]);
        if ($mover->rowCount() !== 1) {
            restar($db, $turno, $personas);
            responder(409, ['error' => 'reserva']);
        }
        restar($db, $reserva['turno'], $personas);
        responder(200, ['ok' => true]);
    }

    if ($accion === 'baja') {
        $token = (string) ($datos['token'] ?? '');
        $reserva = buscarReserva($db, $token);
        if (!$reserva) responder(200, ['ok' => true]); // ya estaba dada de baja

        $baja = $db->prepare('UPDATE reservas SET cancelada = NOW() WHERE token = ? AND cancelada IS NULL');
        $baja->execute([$token]);
        if ($baja->rowCount() === 1) restar($db, $reserva['turno'], (int) $reserva['personas']);
        responder(200, ['ok' => true]);
    }

    responder(400, ['error' => 'accion']);
} catch (Throwable $e) {
    falla($e);
}
