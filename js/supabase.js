/* ==========================================================================
   CONFIGURACIÓN Y CLIENTE GLOBAL DE SUPABASE - BUGAMED
   Sincronización en Tiempo Real de la tabla "rutas"
   ========================================================================== */

const SUPABASE_URL = 'https://zhkmkexcnnenlbpmlmqs.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_B4Hyksen3_nd3PAiDuWmRQ_17hDGNVq';

// Limpieza preventiva de sesiones residuales o expiradas en localStorage que puedan provocar 401
try {
  const projectRef = 'zhkmkexcnnenlbpmlmqs';
  const storageKey = `sb-${projectRef}-auth-token`;
  const tokenVal = localStorage.getItem(storageKey);
  if (tokenVal) {
    try {
      const p = JSON.parse(tokenVal);
      if (p?.expires_at && (p.expires_at * 1000) < Date.now()) {
        console.warn('⚠️ Token de sesión previo expirado en localStorage. Limpiando para evitar error 401...');
        localStorage.removeItem(storageKey);
      }
    } catch (e) {
      localStorage.removeItem(storageKey);
    }
  }
} catch (e) {}

// Inicialización del cliente global de Supabase con cabeceras de autorización garantizadas
let _supabase = null;
try {
  if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
    _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      },
      global: {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    });
    console.log('✓ Cliente global _supabase inicializado con cabeceras de autorización válidas.');
  } else {
    console.warn('⚠️ Supabase SDK no detectado en window.supabase. Verifica la inclusión del CDN.');
  }
} catch (e) {
  console.error('Error al inicializar cliente Supabase:', e);
}

// Exponer cliente global en window
window._supabase = _supabase;

// Referencia al canal de Realtime para suscripciones
let canalRealtimeRutas = null;
let canalRealtimeRepostajes = null;
let canalRealtimeConductores = null;
let canalRealtimeClientes = null;
let canalRealtimeIncidencias = null;
const conductoresEliminadosSet = new Set();

/**
 * Extrae y normaliza de forma segura la columna "clientes" (jsonb o array) recibida desde Supabase.
 * Soporta arrays directos, strings JSON serializados, u objetos individuales.
 * Retorna null únicamente si el campo vino indefinido o null (para distinguir de una lista vacía []).
 */
function extraerClientesDePayload(clientesRaw) {
  if (clientesRaw === undefined || clientesRaw === null) {
    return null;
  }

  let lista = clientesRaw;

  // Si viene como string (por ejemplo desde JSONB serializado en PostgreSQL o WebSocket)
  if (typeof lista === 'string') {
    const trimmed = lista.trim();
    if (trimmed === '' || trimmed === 'null') {
      return [];
    }
    try {
      lista = JSON.parse(trimmed);
    } catch (e) {
      console.warn('⚠️ No se pudo parsear el JSON de la columna clientes:', e, lista);
      return [trimmed];
    }
  }

  // Si vino un objeto suelto en lugar de un array
  if (!Array.isArray(lista)) {
    if (lista && typeof lista === 'object') {
      lista = [lista];
    } else if (lista) {
      lista = [String(lista)];
    } else {
      return [];
    }
  }

  // Normalizar los elementos (pueden ser strings de nombres o bien objetos { nombre: "..." })
  return lista.map(item => {
    if (typeof item === 'object' && item !== null) {
      return item.nombre || item.name || item.titulo || JSON.stringify(item);
    }
    return String(item || '').trim();
  }).filter(Boolean);
}

/**
 * Normaliza un registro de Supabase al formato que utiliza la aplicación en memoria.
 * Mapea 'conductor' <-> 'chofer' y 'vehiculo' <-> 'camion'.
 */
function mapearRutaDesdeSupabase(r) {
  if (!r) return null;

  // Recuperar datos previos en memoria local si existen para no perder día o clientes
  const rutaExistente = (typeof rutas !== 'undefined' && Array.isArray(rutas))
    ? rutas.find(x => String(x.id) === String(r.id))
    : null;

  // Recuperar metadatos locales si existen (día y lista de clientes)
  const metaLocal = (typeof cargarStorage === 'function')
    ? (cargarStorage('bugamed_rutas_meta', {})[r.id] || {})
    : {};

  // Extraer clientes de forma robusta desde la columna jsonb remota
  const clientesRemotos = extraerClientesDePayload(r.clientes);
  // Si vino explícitamente en el registro remoto (incluso si es []), tiene precedencia sobre la memoria local
  const clientesFinal = clientesRemotos !== null
    ? clientesRemotos
    : (rutaExistente?.clientes || metaLocal.clientes || []);

  // Calcular día de la semana si no está presente en la base de datos
  const diasSemanaNombres = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const diaCalculado = r.created_at ? diasSemanaNombres[new Date(r.created_at).getDay()] : 'Lunes';
  const diaFinal = r.dia || metaLocal.dia || rutaExistente?.dia || (diaCalculado === 'Domingo' ? 'Lunes' : diaCalculado);

  const conductorFinal = (r.conductor !== undefined && r.conductor !== null && String(r.conductor).trim() !== '')
    ? String(r.conductor).trim()
    : ((r.chofer !== undefined && r.chofer !== null && String(r.chofer).trim() !== '')
      ? String(r.chofer).trim()
      : (rutaExistente?.conductor || rutaExistente?.chofer || metaLocal.chofer || 'Sin conductor'));

  const vehiculoFinal = r.vehiculo || r.camion || rutaExistente?.vehiculo || rutaExistente?.camion || metaLocal.camion || '';

  const estadoFinal = r.estado || (r.status === 'completed' ? 'completada' : (rutaExistente?.estado || 'pendiente'));
  const statusFinal = r.status || (estadoFinal === 'completada' || estadoFinal === 'finalizada' ? 'completed' : (rutaExistente?.status || 'pending'));

  return {
    id: r.id,
    created_at: r.created_at || rutaExistente?.created_at || new Date().toISOString(),
    conductor: conductorFinal,
    chofer: conductorFinal,
    vehiculo: vehiculoFinal,
    camion: vehiculoFinal,
    estado: estadoFinal,
    status: statusFinal,
    completed_at: r.completed_at || rutaExistente?.completed_at || null,
    duration_seconds: r.duration_seconds || rutaExistente?.duration_seconds || null,
    dia: diaFinal,
    clientes: clientesFinal,
    tipoCliente: (typeof normalizarTipoCliente === 'function' ? normalizarTipoCliente(r.tipoCliente || metaLocal.tipoCliente || rutaExistente?.tipoCliente || 'Mixto') : (r.tipoCliente || metaLocal.tipoCliente || rutaExistente?.tipoCliente || 'Mixto'))
  };
}

/**
 * 1. SELECT: Obtener todas las rutas desde Supabase (sincronización inicial)
 */
async function cargarRutasDesdeSupabase() {
  if (!_supabase) {
    console.warn('Supabase no disponible, continuando en modo almacenamiento local.');
    actualizarBadgeSupabase('desconectado');
    return;
  }

  try {
    actualizarBadgeSupabase('sincronizando');

    const { data, error } = await _supabase
      .from('rutas')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error al consultar rutas en Supabase:', error.message);
      actualizarBadgeSupabase('error', error.message);
      return;
    }

    if (data && Array.isArray(data)) {
      if (data.length > 0) {
        console.log(`✓ ${data.length} rutas cargadas exitosamente desde Supabase:`, data);
        const rutasMapeadas = data.map(mapearRutaDesdeSupabase).filter(Boolean);
        rutas = rutasMapeadas;
        window.rutas = rutas;
        asegurarConductoresDesdeRutas();
        if (typeof asegurarSincronizacionHistorial === 'function') {
          asegurarSincronizacionHistorial();
        }
        if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
      } else {
        console.log('Tabla "rutas" en Supabase vacía. Migrando rutas locales iniciales a Supabase...');
        await migrarRutasInicialesASupabase();
      }

      refrescarVistasRutas();
      actualizarBadgeSupabase('conectado');
    }
  } catch (err) {
    console.error('Excepción al cargar rutas desde Supabase:', err);
    actualizarBadgeSupabase('error', err.message);
  }
}

/**
 * Migra las rutas iniciales locales a Supabase si la tabla remota está recién creada y vacía.
 */
async function migrarRutasInicialesASupabase() {
  if (!_supabase || !Array.isArray(rutas) || rutas.length === 0) return;

  try {
    for (const r of rutas) {
      const payload = {
        conductor: r.conductor || r.chofer || 'Sin conductor',
        vehiculo: r.vehiculo || r.camion || 'Sin vehículo',
        estado: r.estado || 'pendiente'
      };

      const { data, error } = await _supabase.from('rutas').insert([payload]).select();
      if (!error && data && data[0]) {
        const metaLocal = (typeof cargarStorage === 'function') ? cargarStorage('bugamed_rutas_meta', {}) : {};
        metaLocal[data[0].id] = {
          dia: r.dia || 'Lunes',
          clientes: r.clientes || [],
          tipoCliente: r.tipoCliente || 'Mixto'
        };
        localStorage.setItem('bugamed_rutas_meta', JSON.stringify(metaLocal));
      }
    }

    const { data: recargadas } = await _supabase.from('rutas').select('*').order('created_at', { ascending: false });
    if (recargadas && recargadas.length > 0) {
      rutas = recargadas.map(mapearRutaDesdeSupabase).filter(Boolean);
      window.rutas = rutas;
      if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
    }
  } catch (e) {
    console.error('Error durante la migración de rutas iniciales a Supabase:', e);
  }
}

/**
 * 2. INSERT: Crear una nueva ruta en Supabase
 */
async function insertarRutaSupabase({ conductor, vehiculo, estado = 'pendiente', dia = 'Lunes', clientes = [], tipoCliente = 'Mixto' }) {
  const cond = conductor || '';
  const veh = vehiculo || '';
  const est = estado || 'pendiente';

  // Creación optimista en memoria local para respuesta instantánea de interfaz
  const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  const nuevaRutaLocal = {
    id: tempId,
    conductor: cond,
    chofer: cond,
    vehiculo: veh,
    camion: veh,
    estado: est,
    dia: dia,
    clientes: [...clientes],
    tipoCliente: tipoCliente,
    created_at: new Date().toISOString()
  };

  rutas.unshift(nuevaRutaLocal);
  window.rutas = rutas;
  if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
  refrescarVistasRutas();

  if (!_supabase) {
    return nuevaRutaLocal;
  }

  try {
    // La tabla "rutas" en Supabase cuenta con: conductor, vehiculo, estado, clientes (jsonb)
    // e idealmente también 'dia' y 'tipoCliente' si se crearon las columnas
    const clientesNormalizados = Array.isArray(clientes) ? clientes : (extraerClientesDePayload(clientes) || []);
    let payload = {
      conductor: cond,
      vehiculo: veh,
      estado: est,
      clientes: clientesNormalizados,
      dia: dia,
      tipoCliente: tipoCliente
    };

    let { data, error } = await _supabase
      .from('rutas')
      .insert([payload])
      .select();

    // Si las columnas 'dia' o 'tipoCliente' no existen en la tabla remota (Postgres 42703), reintentar sin ellas
    if (error && (error.code === '42703' || (error.message && (error.message.includes('dia') || error.message.includes('tipoCliente'))))) {
      console.warn('⚠️ Columnas dia/tipoCliente no presentes en la tabla "rutas" de Supabase. Reintentando inserción básica...');
      delete payload.dia;
      delete payload.tipoCliente;
      const reintento = await _supabase.from('rutas').insert([payload]).select();
      data = reintento.data;
      error = reintento.error;
    }

    if (error) {
      console.error('Error al insertar ruta en Supabase:', error.message);
      if (typeof mostrarToastLogistica === 'function') {
        mostrarToastLogistica(`⚠️ Error en Supabase: ${error.message}`);
      }
      return nuevaRutaLocal;
    }

    if (data && data[0]) {
      const rutaCreada = data[0];

      // Guardar metadatos locales vinculados al id real
      const metaLocal = (typeof cargarStorage === 'function') ? cargarStorage('bugamed_rutas_meta', {}) : {};
      metaLocal[rutaCreada.id] = { dia, clientes: clientesNormalizados, tipoCliente };
      try { localStorage.setItem('bugamed_rutas_meta', JSON.stringify(metaLocal)); } catch (e) {}

      // Reemplazar tempId con el id real de Supabase
      const index = rutas.findIndex(r => r.id === tempId);
      if (index !== -1) {
        rutas[index] = mapearRutaDesdeSupabase(rutaCreada);
        rutas[index].dia = dia;
        rutas[index].clientes = clientesNormalizados;
        rutas[index].tipoCliente = tipoCliente;
        window.rutas = rutas;
        if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
        refrescarVistasRutas();
      }

      console.log('✓ Ruta insertada en Supabase con ID:', rutaCreada.id);
      return rutas[index] || rutaCreada;
    }
  } catch (err) {
    console.error('Excepción al insertar ruta en Supabase:', err);
  }

  return nuevaRutaLocal;
}

/**
 * 3. UPDATE: Actualizar el estado de una ruta en Supabase (ej: 'en_curso', 'completada')
 */
async function actualizarEstadoRutaSupabase(id, nuevoEstado) {
  if (!id) return;

  // Actualización optimista en memoria
  const rutaEnMemoria = rutas.find(r => String(r.id) === String(id));
  if (rutaEnMemoria) {
    rutaEnMemoria.estado = nuevoEstado;
    if (nuevoEstado === 'completada' || nuevoEstado === 'finalizada') {
      if (typeof registrarRutaEnHistorial === 'function') {
        registrarRutaEnHistorial(rutaEnMemoria);
      }
    }
    if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
    refrescarVistasRutas();
  }

  if (!_supabase) return;

  // Si es un id temporal que aún no está en Supabase, no llamar a la API
  if (String(id).startsWith('temp_') || String(id).startsWith('ruta_init_')) {
    return;
  }

  try {
    const { data, error } = await _supabase
      .from('rutas')
      .update({ estado: nuevoEstado })
      .eq('id', id)
      .select();

    if (error) {
      console.error(`Error actualizando ruta ${id} en Supabase:`, error.message);
      return;
    }

    console.log(`✓ Estado de ruta ${id} actualizado a "${nuevoEstado}" en Supabase.`);
  } catch (err) {
    console.error('Excepción al actualizar estado de ruta en Supabase:', err);
  }
}

/**
 * 3.0.1. FINALIZAR RUTA: Actualiza el estado de la ruta en la tabla 'rutas' de Supabase
 * Marca estado: 'finalizada' (tabla 'rutas' oficial).
 */
async function finalizarRutaSupabase(id, totalSegundos = 0, completedAt = new Date().toISOString()) {
  if (!id) return;
  if (!_supabase) {
    console.warn('⚠️ Supabase no disponible para finalizarRutaSupabase.');
    return;
  }

  // Si es un ID temporal local que aún no existe en Supabase, no llamar a la API
  if (String(id).startsWith('temp_') || String(id).startsWith('ruta_init_')) {
    console.log(`ℹ️ Ruta con ID temporal (${id}), se omite llamada de red.`);
    return;
  }

  try {
    // La tabla correcta en Supabase es 'rutas' y la columna de estado es 'estado'
    const { data, error } = await _supabase
      .from('rutas')
      .update({ estado: 'finalizada' })
      .eq('id', id)
      .select();

    if (error) {
      console.error('Error al actualizar ruta en tabla "rutas" de Supabase:', error.message);
    } else {
      console.log(`✓ Ruta ${id} finalizada exitosamente en Supabase (tabla 'rutas').`);
    }
  } catch (err) {
    console.error('Excepción al finalizar ruta en Supabase:', err);
  }
}

/**
 * 3.1. UPDATE CONDUCTOR: Actualizar el conductor de una ruta en Supabase y de forma optimista
 */
async function actualizarConductorRutaSupabase(id, nuevoConductor) {
  if (!id || !nuevoConductor) return null;
  return actualizarRutaSupabase(id, { conductor: nuevoConductor });
}

/**
 * 3.1.1. Actualiza el nombre del conductor en todas las rutas asociadas en Supabase
 * Dispara el evento Realtime UPDATE en la tabla "rutas" para todos los clientes conectados.
 */
async function actualizarNombreConductorEnRutasSupabase(nombreAnterior, nuevoNombre) {
  if (!nombreAnterior || !nuevoNombre || nombreAnterior.trim() === nuevoNombre.trim()) return null;

  const ant = nombreAnterior.trim();
  const nuev = nuevoNombre.trim();

  // Actualizar en memoria local optimistamente
  if (typeof rutas !== 'undefined' && Array.isArray(rutas)) {
    rutas.forEach(r => {
      if ((r.conductor && r.conductor.trim() === ant) || (r.chofer && r.chofer.trim() === ant)) {
        r.conductor = nuev;
        r.chofer = nuev;
      }
    });
    window.rutas = rutas;
  }

  sincronizarCambioNombreConductorLocal(ant, nuev);
  if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
  refrescarVistasRutas();

  if (!_supabase) return null;

  try {
    console.log(`📡 Propagando cambio de nombre de conductor en Supabase: "${ant}" -> "${nuev}"...`);
    const { data, error } = await _supabase
      .from('rutas')
      .update({ conductor: nuev })
      .eq('conductor', ant)
      .select();

    if (error) {
      console.error(`❌ Error actualizando nombre del conductor "${ant}" en Supabase:`, error.message);
      return null;
    }

    console.log(`✓ Conductor actualizado exitosamente en Supabase para ${data?.length || 0} ruta(s).`);
    return data;
  } catch (err) {
    console.error('Excepción al actualizar conductor en Supabase:', err);
    return null;
  }
}

/**
 * Sincroniza el cambio o actualización en el nombre del conductor en el array local `conductores`.
 * Preserva datos existentes (DNI, teléfono, foto) y evita duplicados o nombres obsoletos.
 */
function sincronizarCambioNombreConductorLocal(conductorAnterior, nuevoConductor) {
  if (!nuevoConductor || nuevoConductor === 'Sin conductor' || nuevoConductor === 'General') return;
  const listaConductores = (typeof conductores !== 'undefined' && Array.isArray(conductores))
    ? conductores
    : ((typeof choferes !== 'undefined' && Array.isArray(choferes)) ? choferes : null);
  if (!listaConductores) return;

  const antLimpio = (conductorAnterior || '').trim().toLowerCase();
  const nuevoLimpio = nuevoConductor.trim().toLowerCase();

  const idxNuevo = listaConductores.findIndex(c => c.nombre && c.nombre.trim().toLowerCase() === nuevoLimpio);
  const idxAnt = antLimpio ? listaConductores.findIndex(c => c.nombre && c.nombre.trim().toLowerCase() === antLimpio) : -1;

  if (idxNuevo === -1 && idxAnt !== -1) {
    // Comprobar si el conductor anterior aún tiene otras rutas asignadas en memoria
    const tieneOtrasRutasAnt = (typeof rutas !== 'undefined' && Array.isArray(rutas))
      ? rutas.some(r => {
          const c = (r.conductor || r.chofer || '').trim().toLowerCase();
          return c === antLimpio;
        })
      : false;

    if (!tieneOtrasRutasAnt) {
      // Renombrar el conductor existente preservando DNI, teléfono y foto
      console.log(`👤 Conductor renombrado en array local: "${listaConductores[idxAnt].nombre}" -> "${nuevoConductor}"`);
      listaConductores[idxAnt].nombre = nuevoConductor;
    } else {
      // El conductor anterior aún tiene otras rutas, por lo que agregamos el nuevo
      console.log(`👤 Añadiendo nuevo conductor (el anterior mantiene otras rutas): "${nuevoConductor}"`);
      listaConductores.push({
        nombre: nuevoConductor,
        dni: 'Registrado en ruta',
        telefono: '',
        foto: ''
      });
    }
  } else if (idxNuevo === -1) {
    // Nuevo conductor no registrado previamente
    console.log(`👤 Añadiendo nuevo conductor: "${nuevoConductor}"`);
    listaConductores.push({
      nombre: nuevoConductor,
      dni: 'Registrado en ruta',
      telefono: '',
      foto: ''
    });
  }

  // Actualizar referencias si el usuario estaba viendo el detalle de este conductor
  if (typeof conductorRutasSeleccionado !== 'undefined' && conductorRutasSeleccionado && conductorRutasSeleccionado.trim().toLowerCase() === antLimpio) {
    window.conductorRutasSeleccionado = nuevoConductor;
  }
  if (typeof choferRutasSeleccionado !== 'undefined' && choferRutasSeleccionado && choferRutasSeleccionado.trim().toLowerCase() === antLimpio) {
    window.choferRutasSeleccionado = nuevoConductor;
  }
  if (typeof conductorSeleccionadoActual !== 'undefined' && conductorSeleccionadoActual && conductorSeleccionadoActual.trim().toLowerCase() === antLimpio) {
    window.conductorSeleccionadoActual = nuevoConductor;
  }
  if (typeof choferSeleccionadoActual !== 'undefined' && choferSeleccionadoActual && choferSeleccionadoActual.trim().toLowerCase() === antLimpio) {
    window.choferSeleccionadoActual = nuevoConductor;
  }

  window.conductores = listaConductores;
  window.choferes = listaConductores;
  asegurarConductoresDesdeRutas();
}

/**
 * 3.2. UPDATE GENÉRICO: Actualizar campos de una ruta en Supabase (conductor, vehiculo, estado, etc.)
 */
async function actualizarRutaSupabase(id, campos) {
  if (!id || !campos) return null;

  // Actualización optimista local en memoria
  const index = rutas.findIndex(r => String(r.id) === String(id));
  if (index !== -1) {
    if (campos.conductor !== undefined) {
      rutas[index].conductor = campos.conductor;
      rutas[index].chofer = campos.conductor;
    }
    if (campos.vehiculo !== undefined) {
      rutas[index].vehiculo = campos.vehiculo;
      rutas[index].camion = campos.vehiculo;
    }
    if (campos.estado !== undefined) {
      rutas[index].estado = campos.estado;
    }
    if (campos.clientes !== undefined) {
      rutas[index].clientes = Array.isArray(campos.clientes) ? campos.clientes : (extraerClientesDePayload(campos.clientes) || []);
    }
    if (campos.dia !== undefined) {
      rutas[index].dia = campos.dia;
    }
    if (campos.tipoCliente !== undefined) {
      rutas[index].tipoCliente = campos.tipoCliente;
    }
    window.rutas = rutas;
    if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
    refrescarVistasRutas();
  }

  if (!_supabase) return null;

  if (String(id).startsWith('temp_') || String(id).startsWith('ruta_init_')) {
    return null;
  }

  try {
    const payloadUpdate = {};
    if (campos.conductor !== undefined) payloadUpdate.conductor = campos.conductor;
    if (campos.vehiculo !== undefined) payloadUpdate.vehiculo = campos.vehiculo;
    if (campos.estado !== undefined) payloadUpdate.estado = campos.estado;
    if (campos.clientes !== undefined) {
      payloadUpdate.clientes = Array.isArray(campos.clientes) ? campos.clientes : (extraerClientesDePayload(campos.clientes) || []);
    }
    if (campos.dia !== undefined) payloadUpdate.dia = campos.dia;
    if (campos.tipoCliente !== undefined) payloadUpdate.tipoCliente = campos.tipoCliente;

    let { data, error } = await _supabase
      .from('rutas')
      .update(payloadUpdate)
      .eq('id', id)
      .select();

    // Si falló por columnas adicionales inexistentes en Supabase, reintentar con esquema base
    if (error && (error.code === '42703' || (error.message && (error.message.includes('dia') || error.message.includes('tipoCliente'))))) {
      delete payloadUpdate.dia;
      delete payloadUpdate.tipoCliente;
      const res = await _supabase.from('rutas').update(payloadUpdate).eq('id', id).select();
      data = res.data;
      error = res.error;
    }

    if (error) {
      console.error(`Error actualizando ruta ${id} en Supabase:`, error.message);
      return null;
    }

    console.log(`✓ Ruta ${id} actualizada exitosamente en Supabase:`, data);
    return data && data[0] ? data[0] : null;
  } catch (err) {
    console.error(`Excepción al actualizar ruta ${id} en Supabase:`, err);
    return null;
  }
}

/**
 * 3.3. UPDATE CLIENTES: Actualizar específicamente el array jsonb de clientes de una ruta
 */
async function actualizarClientesRutaSupabase(id, clientes) {
  return actualizarRutaSupabase(id, { clientes });
}

/**
 * 4. DELETE: Eliminar una ruta de Supabase
 * Ejecuta la llamada asíncrona a Supabase utilizando await _supabase.from('rutas').delete().eq('id', idDelRegistro)
 * Valida que no devuelva error y solo confirma tras el borrado exitoso.
 */
async function eliminarRutaSupabase(idDelRegistro) {
  if (!idDelRegistro) {
    console.warn('⚠️ eliminarRutaSupabase llamado sin ID válido');
    return { success: false, error: new Error('ID no especificado') };
  }

  console.log(`🗑️ Ejecutando llamada asíncrona de borrado en Supabase para ruta ID: ${idDelRegistro}...`);

  // Si Supabase no está configurado, permitir eliminación local
  if (!_supabase) {
    console.warn('⚠️ Supabase no disponible; borrado solo en memoria local.');
    return { success: true };
  }

  // Si es un id temporal previo a guardarse en Supabase
  if (typeof idDelRegistro === 'string' && (idDelRegistro.startsWith('temp_') || idDelRegistro.startsWith('ruta_init_'))) {
    return { success: true };
  }

  try {
    // 1. Llamada asíncrona real a Supabase
    const { error } = await _supabase
      .from('rutas')
      .delete()
      .eq('id', idDelRegistro);

    // 2. Validar que no devuelva error
    if (error) {
      console.error(`❌ Error al eliminar ruta ${idDelRegistro} en Supabase:`, error.message);
      if (typeof mostrarToastLogistica === 'function') {
        mostrarToastLogistica(`⚠️ Error en Supabase al eliminar: ${error.message}`);
      }
      return { success: false, error };
    }

    // Limpiar metadatos locales asociados
    const metaLocal = (typeof cargarStorage === 'function') ? cargarStorage('bugamed_rutas_meta', {}) : {};
    if (metaLocal[idDelRegistro]) {
      delete metaLocal[idDelRegistro];
      try { localStorage.setItem('bugamed_rutas_meta', JSON.stringify(metaLocal)); } catch (e) {}
    }

    console.log(`✓ Ruta ${idDelRegistro} eliminada exitosamente en Supabase.`);
    return { success: true };
  } catch (err) {
    console.error(`❌ Excepción al eliminar ruta ${idDelRegistro} en Supabase:`, err);
    return { success: false, error: err };
  }
}

/**
 * Función global para eliminar una ruta por ID:
 * 1. Ejecuta la llamada asíncrona a Supabase
 * 2. Valida que no devuelva error
 * 3. Solo elimina del array local y de la pantalla una vez confirmado el éxito
 */
async function eliminarRuta(idDelRegistro) {
  if (!idDelRegistro) {
    console.warn('⚠️ eliminarRuta llamado sin ID');
    return false;
  }

  const res = await eliminarRutaSupabase(idDelRegistro);
  if (res && res.success === false) {
    alert(`⚠️ Error al eliminar en Supabase: ${res.error?.message || 'Error desconocido'}.\n\nEl registro se mantiene en pantalla.`);
    return false;
  }

  // 3. Solo eliminar del array local y de la interfaz tras la confirmación exitosa de Supabase
  const index = rutas.findIndex(r => String(r.id) === String(idDelRegistro));
  if (index !== -1) {
    rutas.splice(index, 1);
  }
  window.rutas = rutas;
  if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
  if (typeof refrescarVistasRutas === 'function') refrescarVistasRutas();

  if (typeof mostrarToastLogistica === 'function') {
    mostrarToastLogistica('✓ Ruta eliminada de Supabase y de la pantalla');
  }

  return true;
}

/**
 * 5. REALTIME: Suscribirse a cambios en tiempo real en la tabla "rutas"
 * Detecta cualquier inserción, actualización o eliminación en la columna "conductor"
 * o propiedades de la ruta mediante los eventos 'INSERT' y 'UPDATE' en tiempo real.
 */
function suscribirRutasRealtime() {
  if (!_supabase) {
    console.warn('⚠️ Cliente Supabase no disponible para Realtime.');
    return null;
  }

  // Eliminar canal previo si existía para evitar listeners duplicados
  if (canalRealtimeRutas) {
    console.log('🔄 Removiendo canal Realtime existente antes de reconectar...');
    try {
      _supabase.removeChannel(canalRealtimeRutas);
    } catch (e) {
      console.warn('Error al remover canal Realtime anterior:', e);
    }
    canalRealtimeRutas = null;
  }

  console.log('📡 Conectando canal Realtime "bugamed-rutas-realtime" para tabla "rutas" con listener { event: "*" }...');

  // Canal Realtime configurado para detectar todos los eventos ('*') en vivo (INSERT, UPDATE y DELETE)
  canalRealtimeRutas = _supabase
    .channel('bugamed-rutas-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rutas' },
      (payload) => {
        console.log(`⚡ [Realtime Rutas] Evento [${payload?.eventType || payload?.type || '*'}] detectado en tabla "rutas":`, payload);
        procesarEventoRealtime(payload);
      }
    )
    .subscribe((status, err) => {
      console.log('📡 Estado de conexión Realtime Supabase Rutas:', status);
      if (err) {
        console.error('❌ Error en canal Realtime Supabase Rutas:', err);
      }
      if (status === 'SUBSCRIBED') {
        console.log('✅ [Realtime Rutas] Canal suscrito exitosamente (SUBSCRIBED). Sincronización en vivo activa.');
        actualizarBadgeSupabase('conectado');
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        actualizarBadgeSupabase('desconectado');
      }
    });

  return canalRealtimeRutas;
}

/**
 * Procesa los eventos entrantes de Supabase Realtime (INSERT, UPDATE, DELETE).
 * Canal: "bugamed-rutas-realtime" con { event: '*' }
 *
 * 1. Extrae correctamente la propiedad `conductor` del objeto `payload.new`.
 * 2. Actualiza el registro correspondiente en el array local de rutas (`rutas`).
 * 3. Ejecuta de inmediato `refrescarVistasRutas()` para repintar las tablas/tarjetas en el HTML
 *    en todos los dispositivos conectados sin recargar la página.
 */
function procesarEventoRealtime(payload) {
  if (!payload) return;

  const eventType = (payload.eventType || payload.type || payload.event || '').toUpperCase();
  const nuevoRegistro = payload.new || payload.record || (payload.conductor ? payload : null);
  const viejoRegistro = payload.old || payload.old_record || {};

  console.log(`⚡ [Realtime Rutas] Procesando evento [${eventType || 'AUTO'}] en tabla "rutas":`, {
    nuevo: nuevoRegistro,
    viejo: viejoRegistro
  });

  // Determinar tipo de evento automáticamente si no viene especificado
  let tipoEvento = eventType;
  if (!tipoEvento) {
    if (nuevoRegistro && (!viejoRegistro || Object.keys(viejoRegistro).length === 0)) {
      tipoEvento = 'INSERT';
    } else if (nuevoRegistro) {
      tipoEvento = 'UPDATE';
    } else if (viejoRegistro && viejoRegistro.id) {
      tipoEvento = 'DELETE';
    }
  }

  // =========================================================================
  // 1. EXTRAER CORRECTAMENTE LA PROPIEDAD "conductor" DEL OBJETO payload.new
  // =========================================================================
  let conductorNuevo = '';
  if (nuevoRegistro) {
    if (nuevoRegistro.conductor !== undefined && nuevoRegistro.conductor !== null && String(nuevoRegistro.conductor).trim() !== '') {
      conductorNuevo = String(nuevoRegistro.conductor).trim();
    } else if (nuevoRegistro.chofer !== undefined && nuevoRegistro.chofer !== null && String(nuevoRegistro.chofer).trim() !== '') {
      conductorNuevo = String(nuevoRegistro.chofer).trim();
    } else {
      conductorNuevo = 'Sin conductor';
    }
  }

  // =========================================================================
  // GESTIÓN DEL EVENTO INSERT
  // =========================================================================
  if (tipoEvento === 'INSERT') {
    if (!nuevoRegistro || !nuevoRegistro.id) {
      console.warn('⚠️ Evento INSERT recibido sin payload.new válido:', payload);
      return;
    }

    const nuevoId = String(nuevoRegistro.id);
    const rutaMapeada = mapearRutaDesdeSupabase(nuevoRegistro) || {};

    // Extraer clientes explícitamente desde payload.new.clientes si están presentes
    const clientesNuevos = extraerClientesDePayload(nuevoRegistro.clientes);
    const clientesFinales = clientesNuevos !== null ? clientesNuevos : (rutaMapeada.clientes || []);

    // 1. Comprobar si reemplaza una ruta temporal optimista pendiente
    const tempIndex = rutas.findIndex(r => 
      String(r.id).startsWith('temp_') && 
      ((r.conductor && conductorNuevo && r.conductor.trim().toLowerCase() === conductorNuevo.toLowerCase()) ||
       (r.chofer && conductorNuevo && r.chofer.trim().toLowerCase() === conductorNuevo.toLowerCase()))
    );

    // 2. Comprobar si ya existe por ID
    const indexExistente = rutas.findIndex(r => String(r.id) === nuevoId);

    // 2. ACTUALIZAR O INSERTAR EN EL ARRAY LOCAL DE RUTAS
    if (tempIndex !== -1) {
      rutas[tempIndex] = {
        ...rutas[tempIndex],
        ...rutaMapeada,
        id: nuevoRegistro.id,
        conductor: conductorNuevo,
        chofer: conductorNuevo,
        clientes: clientesFinales
      };
      console.log(`✓ [INSERT Realtime] Ruta temporal confirmada con ID de Supabase: ${nuevoRegistro.id} para conductor: "${conductorNuevo}"`);
    } else if (indexExistente !== -1) {
      rutas[indexExistente] = {
        ...rutas[indexExistente],
        ...rutaMapeada,
        id: nuevoRegistro.id,
        conductor: conductorNuevo,
        chofer: conductorNuevo,
        clientes: clientesFinales
      };
      console.log(`✓ [INSERT Realtime] Ruta existente ${nuevoId} actualizada tras INSERT`);
    } else {
      const nuevaRuta = {
        ...rutaMapeada,
        id: nuevoRegistro.id,
        conductor: conductorNuevo,
        chofer: conductorNuevo,
        vehiculo: nuevoRegistro.vehiculo || nuevoRegistro.camion || rutaMapeada.vehiculo || '',
        camion: nuevoRegistro.vehiculo || nuevoRegistro.camion || rutaMapeada.camion || '',
        estado: nuevoRegistro.estado || rutaMapeada.estado || 'pendiente',
        dia: nuevoRegistro.dia || rutaMapeada.dia || 'Lunes',
        clientes: clientesFinales,
        tipoCliente: nuevoRegistro.tipoCliente || rutaMapeada.tipoCliente || 'Mixto'
      };
      rutas.unshift(nuevaRuta);
      console.log(`✓ [INSERT Realtime] Nueva ruta agregada en tiempo real. Conductor: "${conductorNuevo}" (${clientesFinales.length} clientes)`);
    }

    // Sincronizar metadatos locales vinculados
    const metaLocal = (typeof cargarStorage === 'function') ? cargarStorage('bugamed_rutas_meta', {}) : {};
    metaLocal[nuevoId] = {
      dia: rutaMapeada.dia || 'Lunes',
      clientes: clientesFinales,
      tipoCliente: rutaMapeada.tipoCliente || 'Mixto'
    };
    try { localStorage.setItem('bugamed_rutas_meta', JSON.stringify(metaLocal)); } catch (e) {}

    // Incorporar el nuevo conductor en choferes si no existía
    if (conductorNuevo && conductorNuevo !== 'Sin conductor' && conductorNuevo !== 'General') {
      sincronizarCambioNombreConductorLocal('', conductorNuevo);
    }
    asegurarConductoresDesdeRutas();

    window.rutas = rutas;
    window.choferes = choferes;
    if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();

    // 3. VUELVE A EJECUTAR DE INMEDIATO LA FUNCIÓN ENCARGADA DE PINTAR LA TABLA/TARJETAS EN EL HTML
    refrescarVistasRutas();

    if (typeof mostrarToastLogistica === 'function') {
      mostrarToastLogistica(`⚡ Conductor en tiempo real: ${conductorNuevo} sincronizado`);
    }

  // =========================================================================
  // GESTIÓN DEL EVENTO UPDATE
  // =========================================================================
  } else if (tipoEvento === 'UPDATE') {
    if (!nuevoRegistro || !nuevoRegistro.id) {
      console.warn('⚠️ Evento UPDATE recibido sin payload.new válido:', payload);
      return;
    }

    const nuevoId = String(nuevoRegistro.id);
    let index = rutas.findIndex(r => String(r.id) === nuevoId);

    // Si no se encuentra por id exacto, buscar si existía con ID temporal optimista
    if (index === -1) {
      index = rutas.findIndex(r => 
        String(r.id).startsWith('temp_') && (
          (r.conductor && conductorNuevo && r.conductor.trim().toLowerCase() === conductorNuevo.toLowerCase()) ||
          (r.chofer && conductorNuevo && r.chofer.trim().toLowerCase() === conductorNuevo.toLowerCase())
        )
      );
    }

    const rutaMapeada = mapearRutaDesdeSupabase(nuevoRegistro) || {};
    const clientesNuevos = extraerClientesDePayload(nuevoRegistro.clientes);

    // Obtener conductor anterior para verificar si hubo cambio en el nombre
    const rutaAnterior = index !== -1 ? { ...rutas[index] } : null;
    const conductorAnterior = (
      (rutaAnterior ? (rutaAnterior.conductor || rutaAnterior.chofer) : '') ||
      (viejoRegistro?.conductor || viejoRegistro?.chofer || '')
    ).trim();

    const huboCambioConductor = conductorAnterior && conductorNuevo && 
      (conductorAnterior.toLowerCase() !== conductorNuevo.toLowerCase());

    console.log(`🔄 [UPDATE Realtime] Ruta ${nuevoId} recibida. Conductor: "${conductorAnterior}" -> "${conductorNuevo}"`);

    // =======================================================================
    // 2. ACTUALIZAR EL REGISTRO CORRESPONDIENTE EN EL ARRAY LOCAL DE RUTAS
    // =======================================================================
    if (index !== -1) {
      const estadoAnterior = rutaAnterior.estado;
      const clientesAnteriores = rutaAnterior.clientes || [];
      const clientesActualizados = clientesNuevos !== null
        ? clientesNuevos
        : (rutaMapeada.clientes !== undefined ? rutaMapeada.clientes : clientesAnteriores);

      rutas[index] = {
        ...rutas[index],
        ...rutaMapeada,
        id: nuevoRegistro.id || rutas[index].id,
        conductor: conductorNuevo,
        chofer: conductorNuevo,
        vehiculo: nuevoRegistro.vehiculo || nuevoRegistro.camion || rutaMapeada.vehiculo || rutas[index].vehiculo || '',
        camion: nuevoRegistro.vehiculo || nuevoRegistro.camion || rutaMapeada.camion || rutas[index].camion || '',
        estado: nuevoRegistro.estado !== undefined ? nuevoRegistro.estado : rutas[index].estado,
        dia: nuevoRegistro.dia || rutaMapeada.dia || rutas[index].dia,
        clientes: clientesActualizados
      };

      // Actualizar metadatos locales vinculados
      const metaLocal = (typeof cargarStorage === 'function') ? cargarStorage('bugamed_rutas_meta', {}) : {};
      metaLocal[nuevoId] = {
        dia: rutas[index].dia,
        clientes: clientesActualizados,
        tipoCliente: rutas[index].tipoCliente
      };
      try { localStorage.setItem('bugamed_rutas_meta', JSON.stringify(metaLocal)); } catch (e) {}

      // Si el conductor asignado cambió y la ruta estaba en curso, liberar el servicio activo del conductor previo
      if (huboCambioConductor) {
        if (typeof serviciosActivos !== 'undefined' && serviciosActivos[conductorAnterior]?.rutaId === nuevoRegistro.id) {
          delete serviciosActivos[conductorAnterior];
          console.log(`🧹 Servicio activo desvinculado del conductor anterior: ${conductorAnterior}`);
        }
      }

      // Sincronizar clientes también en el servicio activo en tiempo real si el chofer está en ruta
      if (typeof serviciosActivos !== 'undefined') {
        const conductorActivo = conductorNuevo || conductorAnterior;
        if (serviciosActivos[conductorActivo] && String(serviciosActivos[conductorActivo].rutaId) === nuevoId) {
          serviciosActivos[conductorActivo].clientes = [...clientesActualizados];
        }
      }

      // Sincronizar estado de servicio en vivo si otro usuario inició o completó la ruta
      sincronizarServicioActivoDesdeRealtime(nuevoRegistro, rutas[index]);

      // Si la ruta cambió su estado a completada o finalizada, registrarla en Historial
      if (nuevoRegistro.estado === 'completada' || nuevoRegistro.estado === 'finalizada' || nuevoRegistro.status === 'completed') {
        if (typeof registrarRutaEnHistorial === 'function') {
          registrarRutaEnHistorial(rutas[index]);
        }
      }
    } else {
      // Si la ruta no estaba en la lista local de este dispositivo, agregarla al array local
      const clientesActualizados = clientesNuevos !== null ? clientesNuevos : (rutaMapeada.clientes || []);
      const rutaNueva = {
        ...rutaMapeada,
        id: nuevoRegistro.id,
        conductor: conductorNuevo,
        chofer: conductorNuevo,
        vehiculo: nuevoRegistro.vehiculo || nuevoRegistro.camion || rutaMapeada.vehiculo || '',
        camion: nuevoRegistro.vehiculo || nuevoRegistro.camion || rutaMapeada.camion || '',
        estado: nuevoRegistro.estado !== undefined ? nuevoRegistro.estado : (rutaMapeada.estado || 'pendiente'),
        status: nuevoRegistro.status !== undefined ? nuevoRegistro.status : (rutaMapeada.status || 'pending'),
        dia: nuevoRegistro.dia || rutaMapeada.dia || 'Lunes',
        clientes: clientesActualizados
      };
      rutas.unshift(rutaNueva);

      if (nuevoRegistro.estado === 'completada' || nuevoRegistro.estado === 'finalizada' || nuevoRegistro.status === 'completed') {
        if (typeof registrarRutaEnHistorial === 'function') {
          registrarRutaEnHistorial(rutaNueva);
        }
      }
    }

    // Sincronizar la lista de conductores en memoria si hubo cambio o actualización de conductor
    if (conductorNuevo && conductorNuevo !== 'Sin conductor' && conductorNuevo !== 'General') {
      if (huboCambioConductor) {
        sincronizarCambioNombreConductorLocal(conductorAnterior, conductorNuevo);
      } else {
        asegurarConductoresDesdeRutas();
      }
    } else {
      asegurarConductoresDesdeRutas();
    }

    window.rutas = rutas;
    window.choferes = choferes;
    if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();

    // =======================================================================
    // 3. VUELVE A EJECUTAR DE INMEDIATO LA FUNCIÓN ENCARGADA DE PINTAR LA TABLA/TARJETAS EN EL HTML
    // =======================================================================
    refrescarVistasRutas();

    if (typeof mostrarToastLogistica === 'function') {
      if (huboCambioConductor) {
        mostrarToastLogistica(`⚡ Conductor actualizado en vivo: "${conductorNuevo}"`);
      } else if (rutaAnterior && rutaAnterior.estado !== nuevoRegistro.estado) {
        mostrarToastLogistica(`⚡ Ruta de ${conductorNuevo} cambió a: "${nuevoRegistro.estado}"`);
      } else if (clientesNuevos !== null && rutaAnterior && clientesNuevos.length !== (rutaAnterior.clientes || []).length) {
        mostrarToastLogistica(`⚡ Clientes actualizados en ruta de ${conductorNuevo}`);
      }
    }

  // =========================================================================
  // GESTIÓN DEL EVENTO DELETE
  // =========================================================================
  } else if (tipoEvento === 'DELETE') {
    // 1. Extraer ID del registro eliminado de forma robusta y completa desde el payload
    let idEliminar = null;

    if (payload.old && typeof payload.old === 'object') {
      idEliminar = payload.old.id ?? payload.old.ID ?? payload.old.id_ruta ?? payload.old.ruta_id ?? payload.old._id ?? null;
      if (!idEliminar) {
        // Si no tiene id estándar, buscar cualquier propiedad que contenga 'id'
        const keys = Object.keys(payload.old);
        for (const k of keys) {
          if (k.toLowerCase().includes('id')) {
            idEliminar = payload.old[k];
            break;
          }
        }
        if (!idEliminar && keys.length === 1 && (typeof payload.old[keys[0]] === 'string' || typeof payload.old[keys[0]] === 'number')) {
          idEliminar = payload.old[keys[0]];
        }
      }
    } else if (payload.old && (typeof payload.old === 'string' || typeof payload.old === 'number')) {
      idEliminar = payload.old;
    }

    if (!idEliminar && payload.old_record && typeof payload.old_record === 'object') {
      idEliminar = payload.old_record.id ?? payload.old_record.ID ?? payload.old_record.id_ruta ?? payload.old_record.ruta_id ?? null;
    }

    if (!idEliminar && payload.id) {
      idEliminar = payload.id;
    }

    if (!idEliminar && payload.record && typeof payload.record === 'object') {
      idEliminar = payload.record.id ?? payload.record.ID ?? null;
    }

    if (!idEliminar && payload.data && typeof payload.data === 'object') {
      idEliminar = payload.data.id ?? payload.data.old?.id ?? null;
    }

    console.log(`🗑️ [DELETE Realtime] Procesando evento DELETE para ID:`, idEliminar, payload);

    if (idEliminar !== null && idEliminar !== undefined && String(idEliminar).trim() !== '') {
      const idEliminarStr = String(idEliminar).trim();
      const idEliminarNum = Number(idEliminar);
      const esNumeroValido = !isNaN(idEliminarNum);

      let totalEliminados = 0;

      // 2. Eliminar de forma inmediata del array local 'rutas' mutando in-place (splice)
      if (typeof rutas !== 'undefined' && Array.isArray(rutas)) {
        for (let i = rutas.length - 1; i >= 0; i--) {
          const r = rutas[i];
          if (!r) continue;
          const rIdStr = (r.id !== undefined && r.id !== null) ? String(r.id).trim() : '';
          const rIdNum = Number(r.id);
          const coincide = (rIdStr !== '' && rIdStr === idEliminarStr) ||
                           (esNumeroValido && !isNaN(rIdNum) && rIdNum === idEliminarNum);
          if (coincide) {
            rutas.splice(i, 1);
            totalEliminados++;
          }
        }
        // Asignación de seguridad con filter
        rutas = rutas.filter(r => {
          if (!r) return false;
          const rIdStr = (r.id !== undefined && r.id !== null) ? String(r.id).trim() : '';
          const rIdNum = Number(r.id);
          return !(rIdStr === idEliminarStr || (esNumeroValido && !isNaN(rIdNum) && rIdNum === idEliminarNum));
        });
      }

      // Eliminar de forma inmediata de 'window.rutas' mutando in-place (splice)
      if (typeof window !== 'undefined' && Array.isArray(window.rutas)) {
        for (let i = window.rutas.length - 1; i >= 0; i--) {
          const r = window.rutas[i];
          if (!r) continue;
          const rIdStr = (r.id !== undefined && r.id !== null) ? String(r.id).trim() : '';
          const rIdNum = Number(r.id);
          const coincide = (rIdStr !== '' && rIdStr === idEliminarStr) ||
                           (esNumeroValido && !isNaN(rIdNum) && rIdNum === idEliminarNum);
          if (coincide) {
            window.rutas.splice(i, 1);
            totalEliminados++;
          }
        }
        window.rutas = (typeof rutas !== 'undefined' && Array.isArray(rutas)) ? rutas : window.rutas.filter(r => {
          if (!r) return false;
          const rIdStr = (r.id !== undefined && r.id !== null) ? String(r.id).trim() : '';
          const rIdNum = Number(r.id);
          return !(rIdStr === idEliminarStr || (esNumeroValido && !isNaN(rIdNum) && rIdNum === idEliminarNum));
        });
      }

      // Sincronizar referencia global en window
      if (typeof rutas !== 'undefined') {
        window.rutas = rutas;
      }

      // Limpiar metadatos locales asociados
      const metaLocal = (typeof cargarStorage === 'function') ? cargarStorage('bugamed_rutas_meta', {}) : {};
      if (metaLocal[idEliminar] || metaLocal[idEliminarStr]) {
        delete metaLocal[idEliminar];
        delete metaLocal[idEliminarStr];
        try { localStorage.setItem('bugamed_rutas_meta', JSON.stringify(metaLocal)); } catch (e) {}
      }

      // Si la ruta estaba en servicio activo en algún conductor, liberarlo
      if (typeof serviciosActivos !== 'undefined' && serviciosActivos) {
        for (const cond in serviciosActivos) {
          const serv = serviciosActivos[cond];
          if (serv && (String(serv.rutaId).trim() === idEliminarStr || (esNumeroValido && Number(serv.rutaId) === idEliminarNum))) {
            delete serviciosActivos[cond];
            try { localStorage.setItem('bugamed_servicios_activos', JSON.stringify(serviciosActivos)); } catch (e) {}
            break;
          }
        }
      }

      console.log(`✓ [DELETE Realtime] Ruta ID ${idEliminarStr} eliminada localmente (${totalEliminados} coincidencia(s)).`);

      // Guardar de inmediato en almacenamiento local
      if (typeof guardarDatosEnLocal === 'function') {
        try { guardarDatosEnLocal(); } catch (e) { console.warn('Aviso guardarDatosEnLocal:', e); }
      } else {
        try {
          const rGuardar = (typeof rutas !== 'undefined' && Array.isArray(rutas)) ? rutas : (window.rutas || []);
          localStorage.setItem('bugamed_rutas', JSON.stringify(rGuardar));
        } catch (e) {}
      }

      // Limpieza proactiva en el DOM: remover tarjetas que referencien directamente este ID
      try {
        const selectorQuery = `[onclick*="'${idEliminarStr}'"], [onclick*='"${idEliminarStr}"'], [data-ruta-id="${idEliminarStr}"], [data-id="${idEliminarStr}"]`;
        document.querySelectorAll(selectorQuery).forEach(el => {
          const tarjetaRuta = el.closest('.light-card, .bg-slate-50, div[class*="rounded-xl"]') || el;
          if (tarjetaRuta && tarjetaRuta.parentElement && tarjetaRuta !== document.body) {
            tarjetaRuta.remove();
          }
        });
      } catch (e) {}

      // 3. Re-renderizado instantáneo de la interfaz para que desaparezca en todos los dispositivos conectados
      refrescarVistasRutas();

      if (typeof mostrarToastLogistica === 'function') {
        mostrarToastLogistica(`⚡ Una ruta fue eliminada en tiempo real.`);
      }
    } else {
      console.warn('⚠️ Evento DELETE recibido pero no se pudo extraer un ID válido del payload:', payload);
    }
  }
}

/**
 * Garantiza que cualquier conductor registrado en la columna "conductor" de la tabla "rutas"
 * exista también en la lista de conductores en memoria (conductores) de cada dispositivo.
 * Esto asegura que renderGridConductoresAsignacion, renderVisualizacionRutasConductores,
 * renderConductores y otros selectores puedan renderizar la tarjeta y las rutas del conductor en vivo.
 */
function asegurarConductoresDesdeRutas() {
  if (typeof rutas === 'undefined' || !Array.isArray(rutas)) {
    return;
  }
  const listaConductores = (typeof conductores !== 'undefined' && Array.isArray(conductores))
    ? conductores
    : ((typeof choferes !== 'undefined' && Array.isArray(choferes)) ? choferes : null);
  if (!listaConductores) return;

  let modificado = false;
  const conductoresEnRutas = new Set();

  rutas.forEach(r => {
    const nombre = (r.conductor || r.chofer || '').trim();
    if (!nombre || nombre === 'Sin conductor' || nombre === 'General') return;
    if (typeof conductoresEliminadosSet !== 'undefined' && conductoresEliminadosSet.has(nombre.toLowerCase())) return;
    conductoresEnRutas.add(nombre.toLowerCase());

    const existe = listaConductores.some(ch => ch.nombre && ch.nombre.trim().toLowerCase() === nombre.toLowerCase());
    if (!existe) {
      console.log(`👤 Conductor "${nombre}" detectado en tabla "rutas". Agregando automáticamente a la lista local de conductores.`);
      listaConductores.push({
        nombre: nombre,
        dni: 'Registrado en ruta',
        telefono: '',
        foto: ''
      });
      modificado = true;
    }
  });

  window.conductores = listaConductores;
  window.choferes = listaConductores;

  if (modificado) {
    if (typeof guardarDatosEnLocal === 'function') {
      try {
        localStorage.setItem('bugamed_conductores', JSON.stringify(listaConductores));
        localStorage.setItem('bugamed_choferes', JSON.stringify(listaConductores));
      } catch (e) {
        console.warn('Error guardando conductores:', e);
      }
    }
  }
}

/**
 * Sincroniza la visualización de camiones y servicios activos en la oficina
 * cuando un conductor cambia el estado de su ruta en ruta.
 */
function sincronizarServicioActivoDesdeRealtime(nuevoRegistro, rutaLocal) {
  const conductorNombre = nuevoRegistro.conductor || nuevoRegistro.chofer;
  const vehiculoMat = nuevoRegistro.vehiculo || nuevoRegistro.camion;

  if (nuevoRegistro.estado === 'en_curso') {
    if (typeof serviciosActivos !== 'undefined' && !serviciosActivos[conductorNombre]) {
      serviciosActivos[conductorNombre] = {
        conductor: conductorNombre,
        chofer: conductorNombre,
        camion: vehiculoMat,
        dia: rutaLocal?.dia || 'Hoy',
        rutaNombre: `Ruta (${rutaLocal?.tipoCliente || 'En curso'})`,
        rutaId: nuevoRegistro.id,
        inicio: new Date(nuevoRegistro.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        fechaStr: new Date().toISOString().split('T')[0],
        clientes: rutaLocal?.clientes || []
      };
    }
    if (typeof camiones !== 'undefined') {
      const cam = camiones.find(v => v.matricula === vehiculoMat);
      if (cam) cam.estado = `Ocupado por ${conductorNombre}`;
    }
  } else if (nuevoRegistro.estado === 'completada' || nuevoRegistro.estado === 'finalizada' || nuevoRegistro.status === 'completed') {
    if (typeof serviciosActivos !== 'undefined' && serviciosActivos[conductorNombre]) {
      delete serviciosActivos[conductorNombre];
    }
    if (typeof camiones !== 'undefined') {
      const cam = camiones.find(v => v.matricula === vehiculoMat);
      if (cam) cam.estado = 'Libre';
    }
  }
}

/**
 * Refresca todas las interfaces dependientes de rutas y conductores en la app en tiempo real.
 * Vuelve a renderizar la lista de personal, cuadrícula de asignación, vista de rutas,
 * selectores de perfiles y contadores instantáneamente.
 */
function refrescarVistasRutas() {
  // 1. Sincronización base de conductores desde rutas
  try {
    if (typeof asegurarConductoresDesdeRutas === 'function') asegurarConductoresDesdeRutas();
  } catch (e) { console.warn('Aviso al sincronizar conductores:', e); }

  // 2. Planificación semanal y asignación de rutas por conductor
  try {
    if (typeof renderDiasSemana === 'function') renderDiasSemana();

    // Sincronizar día activo si el panel de detalle está abierto en el móvil u otro dispositivo
    const panelDia = document.getElementById('panel-detalle-dia');
    if (panelDia && !panelDia.classList.contains('hidden')) {
      if ((typeof diaSeleccionadoActual === 'undefined' || !diaSeleccionadoActual) && typeof window.diaActual !== 'undefined' && window.diaActual) {
        diaSeleccionadoActual = window.diaActual;
      }
      if (!diaSeleccionadoActual) {
        const tit = document.getElementById('titulo-dia-seleccionado');
        if (tit && tit.innerText) {
          const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
          const enc = dias.find(d => d.toUpperCase() === tit.innerText.trim().toUpperCase());
          if (enc) {
            diaSeleccionadoActual = enc;
            window.diaSeleccionadoActual = enc;
          }
        }
      }
    }

    if (typeof renderGridConductoresAsignacion === 'function') renderGridConductoresAsignacion();
    else if (typeof renderGridChoferesAsignacion === 'function') renderGridChoferesAsignacion();
  } catch (e) { console.warn('Aviso en renderGridConductoresAsignacion:', e); }

  // 3. Visualización de rutas asignadas por conductor (Portal Conductor y Oficina)
  try {
    if (typeof renderVisualizacionRutasConductores === 'function') renderVisualizacionRutasConductores();
    else if (typeof renderVisualizacionRutasChoferes === 'function') renderVisualizacionRutasChoferes();

    // Si el usuario en el móvil está dentro del panel detallado de rutas de un conductor, repintar
    const panelDetalleRutas = document.getElementById('panel-detalle-rutas-conductor') || document.getElementById('panel-detalle-rutas-chofer');
    if (panelDetalleRutas && !panelDetalleRutas.classList.contains('hidden')) {
      const nombreTit = document.getElementById('detalle-conductor-nombre-titulo') || document.getElementById('detalle-chofer-nombre-titulo');
      const nombre = (typeof conductorRutasSeleccionado !== 'undefined' && conductorRutasSeleccionado) ||
                     (typeof choferRutasSeleccionado !== 'undefined' && choferRutasSeleccionado) ||
                     (nombreTit ? nombreTit.innerText.trim() : '');
      if (nombre && nombre !== 'Nombre Conductor' && typeof verDetalleRutasConductor === 'function') {
        verDetalleRutasConductor(nombre);
      }
    }

    if (typeof actualizarSelectPortalConductores === 'function') actualizarSelectPortalConductores();
    else if (typeof actualizarSelectPortalChoferes === 'function') actualizarSelectPortalChoferes();
  } catch (e) { console.warn('Aviso en renderVisualizacionRutasConductores:', e); }

  // 4. Módulo de logística y selector de inicio de servicio
  try {
    if (typeof actualizarListadoRutasParaInicio === 'function') actualizarListadoRutasParaInicio();
    if (typeof actualizarEstadoFichajeInterfaz === 'function') actualizarEstadoFichajeInterfaz();
    if (typeof renderModuloLogistica === 'function') renderModuloLogistica();
  } catch (e) { console.warn('Aviso en renderModuloLogistica:', e); }

  // 5. Si el modal de perfiles de conductores para iniciar servicio está visible, refrescar sus tarjetas
  try {
    const modalSelCond = document.getElementById('modal-selector-conductores') || document.getElementById('modal-selector-choferes');
    if (modalSelCond && !modalSelCond.classList.contains('hidden')) {
      if (typeof abrirSelectorConductoresInicio === 'function') {
        abrirSelectorConductoresInicio();
      } else if (typeof abrirSelectorChoferesInicio === 'function') {
        abrirSelectorChoferesInicio();
      }
    }
  } catch (e) {}

  // 6. Fichaje y selector de conductor activo
  try {
    const inputCond = document.getElementById('fichaje-conductor-input') || document.getElementById('fichaje-chofer-input');
    if (inputCond && inputCond.value) {
      if (typeof actualizarSelectorRutasParaConductorInicio === 'function') {
        actualizarSelectorRutasParaConductorInicio(inputCond.value);
      } else if (typeof actualizarSelectorRutasParaChoferInicio === 'function') {
        actualizarSelectorRutasParaChoferInicio(inputCond.value);
      }
    }
  } catch (e) {}

  // 7. Lista principal de Conductores / Personal Bugamed y Vehículos
  try {
    if (typeof renderConductores === 'function') renderConductores();
    else if (typeof renderChoferes === 'function') renderChoferes();
    if (typeof renderCamiones === 'function') renderCamiones();
  } catch (e) {}

  // 8. Historial de conductores y KPIs del header
  try {
    if (typeof renderHistorialConductoresGrid === 'function') renderHistorialConductoresGrid();
    else if (typeof renderHistorialChoferesGrid === 'function') renderHistorialChoferesGrid();

    const condActual = window.conductorSeleccionadoActual || window.choferSeleccionadoActual;
    if (condActual) {
      const panelHistorial = document.getElementById('panel-detalle-historial-conductor') || document.getElementById('panel-detalle-historial-chofer');
      if (panelHistorial && !panelHistorial.classList.contains('hidden')) {
        if (typeof verDetalleHistorialConductor === 'function') {
          verDetalleHistorialConductor(condActual);
        } else if (typeof verDetalleHistorialChofer === 'function') {
          verDetalleHistorialChofer(condActual);
        }
      }
    }
    if (typeof actualizarKPIs === 'function') actualizarKPIs();
  } catch (e) {}
}

/**
 * Actualiza el indicador visual en el header de la aplicación
 */
function actualizarBadgeSupabase(estado, errorDetalle = '') {
  const badge = document.getElementById('supabase-status-badge');
  const texto = document.getElementById('supabase-status-text');
  const dot = document.getElementById('supabase-status-dot');
  if (!badge || !texto) return;

  badge.classList.remove('hidden');

  if (estado === 'conectado') {
    badge.className = 'hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-2xs transition-all';
    if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse';
    texto.innerText = 'Supabase En Línea';
    badge.title = 'Conectado y sincronizado en tiempo real con Supabase';
  } else if (estado === 'sincronizando') {
    badge.className = 'hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold shadow-2xs transition-all';
    if (dot) dot.className = 'w-2 h-2 rounded-full bg-blue-500 animate-spin';
    texto.innerText = 'Sincronizando...';
  } else if (estado === 'error' || estado === 'desconectado') {
    badge.className = 'hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold shadow-2xs transition-all';
    if (dot) dot.className = 'w-2 h-2 rounded-full bg-amber-500';
    texto.innerText = 'Supabase Offline';
    badge.title = errorDetalle ? `Aviso: ${errorDetalle}` : 'Modo local sin conexión en tiempo real';
  }
}

/* ==========================================================================
   SINCRONIZACIÓN Y TIEMPO REAL DE LA TABLA "repostajes"
   ========================================================================== */

/**
 * Normaliza un registro de repostaje proveniente de Supabase al formato que utiliza la aplicación en memoria.
 */
function mapearRepostajeDesdeSupabase(r) {
  if (!r) return null;
  const fechaStr = r.fecha || (r.created_at ? r.created_at.split('T')[0] : new Date().toISOString().split('T')[0]);
  const condFinal = (r.conductor || r.chofer || 'General').trim() || 'General';
  return {
    id: r.id,
    created_at: r.created_at || new Date().toISOString(),
    fecha: fechaStr,
    camion: r.camion || r.vehiculo || '',
    conductor: condFinal,
    chofer: condFinal,
    litros: (r.litros !== undefined && r.litros !== null) ? String(r.litros) : '0',
    euros: (r.euros !== undefined && r.euros !== null) ? String(r.euros) : '0',
    km: (r.km !== undefined && r.km !== null) ? String(r.km) : '',
    adblue: (r.adblue !== undefined && r.adblue !== null) ? String(r.adblue) : '',
    tipo: r.tipo || 'Gasoil'
  };
}

/**
 * 1. SELECT: Obtener todos los repostajes desde Supabase al iniciar la aplicación
 */
async function cargarRepostajesDesdeSupabase() {
  if (!_supabase) {
    console.warn('⚠️ Supabase no disponible para cargar repostajes.');
    return;
  }

  try {
    const { data, error } = await _supabase
      .from('repostajes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === 'PGRST205' || (error.message && error.message.includes('schema cache'))) {
        console.warn('ℹ️ La tabla "repostajes" aún no ha sido creada en el panel de Supabase. Operando con datos locales temporalmente.');
        return;
      }
      console.error('Error al consultar repostajes en Supabase:', error.message);
      return;
    }

    if (data && Array.isArray(data)) {
      if (data.length > 0) {
        console.log(`✓ ${data.length} repostajes cargados exitosamente desde Supabase:`, data);
        const mapeados = data.map(mapearRepostajeDesdeSupabase).filter(Boolean);
        repostajes = mapeados;
        window.repostajes = repostajes;
        if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
      } else {
        console.log('Tabla "repostajes" en Supabase vacía. Migrando repostajes locales iniciales si existen...');
        await migrarRepostajesInicialesASupabase();
      }
      refrescarVistasRepostajes();
    }
  } catch (err) {
    console.error('Excepción al cargar repostajes desde Supabase:', err);
  }
}

/**
 * Migra los repostajes locales iniciales si la tabla remota en Supabase está vacía
 */
async function migrarRepostajesInicialesASupabase() {
  if (!_supabase || typeof repostajes === 'undefined' || !Array.isArray(repostajes) || repostajes.length === 0) return;

  try {
    const filasParaInsertar = repostajes.map(r => ({
      fecha: r.fecha || new Date().toISOString().split('T')[0],
      camion: r.camion || '',
      chofer: r.chofer || r.conductor || 'General',
      litros: parseFloat(r.litros || 0) || 0,
      euros: parseFloat(r.euros || 0) || 0,
      km: r.km ? (parseFloat(r.km) || null) : null,
      adblue: r.adblue ? (parseFloat(r.adblue) || null) : null,
      tipo: r.tipo || 'Gasoil'
    }));

    let { data, error } = await _supabase
      .from('repostajes')
      .insert(filasParaInsertar)
      .select();

    // Si la columna en Supabase fuera 'conductor' en vez de 'chofer'
    if (error && (error.code === 'PGRST204' || error.code === '42703' || (error.message && error.message.includes('chofer')))) {
      const filasConductor = filasParaInsertar.map(f => {
        const copy = { ...f, conductor: f.chofer };
        delete copy.chofer;
        return copy;
      });
      const retry = await _supabase.from('repostajes').insert(filasConductor).select();
      data = retry.data;
      error = retry.error;
    }

    if (!error && data && data.length > 0) {
      console.log(`✓ ${data.length} repostajes iniciales migrados exitosamente a Supabase.`);
      repostajes = data.map(mapearRepostajeDesdeSupabase).filter(Boolean);
      window.repostajes = repostajes;
      if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
    }
  } catch (e) {
    console.error('Error durante la migración de repostajes a Supabase:', e);
  }
}

/**
 * 2. INSERT: Registrar un nuevo repostaje en Supabase de forma asíncrona
 */
async function insertarRepostajeSupabase({ fecha, camion, conductor, chofer, litros, euros, km, adblue, tipo = 'Gasoil' }) {
  const f = fecha || new Date().toISOString().split('T')[0];
  const cam = (camion || '').trim();
  const cond = (chofer || conductor || '').trim() || 'General';
  const lit = String(litros || '0');
  const eur = String(euros || '0');
  const k = (km !== undefined && km !== null && km !== '') ? String(km) : '';
  const adb = (adblue !== undefined && adblue !== null && adblue !== '') ? String(adblue) : '';
  const tip = tipo || 'Gasoil';

  // 1. Inserción optimista en memoria local para respuesta instantánea en la interfaz
  const tempId = 'temp_rep_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  const nuevoLocal = {
    id: tempId,
    fecha: f,
    camion: cam,
    conductor: cond,
    chofer: cond,
    litros: lit,
    euros: eur,
    km: k,
    adblue: adb,
    tipo: tip,
    created_at: new Date().toISOString()
  };

  if (typeof repostajes !== 'undefined' && Array.isArray(repostajes)) {
    repostajes.unshift(nuevoLocal);
    window.repostajes = repostajes;
  }
  if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
  refrescarVistasRepostajes();

  if (!_supabase) {
    console.warn('⚠️ Supabase no disponible; el repostaje se guardó únicamente en local.');
    return nuevoLocal;
  }

  try {
    // La columna oficial en la tabla 'repostajes' de Supabase es 'chofer'
    const payload = {
      fecha: f,
      camion: cam,
      chofer: cond,
      litros: parseFloat(lit) || 0,
      euros: parseFloat(eur) || 0,
      km: k ? (parseFloat(k) || null) : null,
      adblue: adb ? (parseFloat(adb) || null) : null,
      tipo: tip
    };

    console.log('🚀 Insertando repostaje asíncrono en Supabase (tabla "repostajes"):', payload);

    let { data, error } = await _supabase
      .from('repostajes')
      .insert([payload])
      .select();

    // Fallback si la columna en la BD se llamara 'conductor' en lugar de 'chofer'
    if (error && (error.code === 'PGRST204' || error.code === '42703' || (error.message && error.message.includes('chofer')))) {
      console.warn('⚠️ Columna "chofer" no detectada en "repostajes", reintentando con "conductor"...');
      const payloadConductor = { ...payload, conductor: cond };
      delete payloadConductor.chofer;
      const retry = await _supabase.from('repostajes').insert([payloadConductor]).select();
      data = retry.data;
      error = retry.error;
    }

    // Fallback: Si falló por alguna columna opcional inexistente en Postgres
    if (error && (error.code === 'PGRST204' || error.code === '42703' || (error.message && (error.message.includes('adblue') || error.message.includes('tipo') || error.message.includes('km'))))) {
      console.warn('⚠️ Columnas opcionales no detectadas en tabla "repostajes". Reintentando con esquema mínimo...');
      const payloadMin = {
        fecha: f,
        camion: cam,
        chofer: cond,
        litros: parseFloat(lit) || 0,
        euros: parseFloat(eur) || 0
      };
      let retry = await _supabase.from('repostajes').insert([payloadMin]).select();
      if (retry.error && (retry.error.code === 'PGRST204' || retry.error.code === '42703' || (retry.error.message && retry.error.message.includes('chofer')))) {
        delete payloadMin.chofer;
        payloadMin.conductor = cond;
        retry = await _supabase.from('repostajes').insert([payloadMin]).select();
      }
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('❌ Error al insertar repostaje en Supabase:', error.message);
      if (typeof mostrarToastLogistica === 'function') {
        if (error.code === 'PGRST205') {
          mostrarToastLogistica('⚠️ Falta crear la tabla "repostajes" en Supabase. Guardado localmente.');
        } else {
          mostrarToastLogistica(`⚠️ Error en Supabase al registrar repostaje: ${error.message}`);
        }
      }
      return nuevoLocal;
    }

    if (data && data[0]) {
      const creado = data[0];
      const mapeado = mapearRepostajeDesdeSupabase(creado);

      // Reemplazar el registro optimista temporal con el ID definitivo asignado por Supabase
      if (typeof repostajes !== 'undefined' && Array.isArray(repostajes)) {
        const idx = repostajes.findIndex(r => r.id === tempId);
        if (idx !== -1) {
          repostajes[idx] = mapeado;
        }
        window.repostajes = repostajes;
      }

      if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
      refrescarVistasRepostajes();
      console.log('✓ Repostaje confirmado e insertado en Supabase con ID:', creado.id);
      return mapeado;
    }
  } catch (err) {
    console.error('Excepción al insertar repostaje en Supabase:', err);
  }

  return nuevoLocal;
}

/**
 * 3. DELETE: Eliminar un registro de repostaje de Supabase
 */
async function eliminarRepostajeSupabase(idDelRegistro) {
  if (!idDelRegistro) {
    return { success: false, error: new Error('ID no especificado') };
  }

  if (String(idDelRegistro).startsWith('temp_rep_')) {
    return { success: true };
  }

  if (!_supabase) {
    return { success: true };
  }

  try {
    console.log(`🗑️ Eliminando repostaje ID ${idDelRegistro} en Supabase...`);
    const { error } = await _supabase
      .from('repostajes')
      .delete()
      .eq('id', idDelRegistro);

    if (error) {
      console.error(`❌ Error al eliminar repostaje ${idDelRegistro} en Supabase:`, error.message);
      return { success: false, error };
    }

    console.log(`✓ Repostaje ${idDelRegistro} eliminado exitosamente en Supabase.`);
    return { success: true };
  } catch (err) {
    console.error(`❌ Excepción al eliminar repostaje ${idDelRegistro} en Supabase:`, err);
    return { success: false, error: err };
  }
}

/**
 * 4. REALTIME: Suscribirse a cambios en tiempo real en la tabla "repostajes"
 * Escucha todos los eventos utilizando { event: '*', schema: 'public', table: 'repostajes' }
 */
function suscribirRepostajesRealtime() {
  if (!_supabase) {
    console.warn('⚠️ Cliente Supabase no disponible para Realtime de repostajes.');
    return null;
  }

  // 1. Eliminar canal previo si existía para evitar listeners duplicados
  if (canalRealtimeRepostajes) {
    console.log('🔄 Removiendo canal Realtime de repostajes previo antes de reconectar...');
    try {
      _supabase.removeChannel(canalRealtimeRepostajes);
    } catch (e) {
      console.warn('Error al remover canal Realtime anterior de repostajes:', e);
    }
    canalRealtimeRepostajes = null;
  }

  console.log('📡 Conectando canal Realtime "bugamed-repostajes-realtime" para tabla "repostajes" con { event: "*" }...');

  // 1. Crear nuevo canal en tiempo real
  // 2. Configurar listener con { event: '*', schema: 'public', table: 'repostajes' }
  // 3. Procesar eventos en tiempo real (INSERT, UPDATE, DELETE) y repintar la interfaz
  // 4. Suscribirse garantizando el retorno del estado 'SUBSCRIBED' en consola
  canalRealtimeRepostajes = _supabase
    .channel('bugamed-repostajes-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'repostajes' },
      (payload) => {
        console.log(`⛽ [Realtime Repostajes] Evento recibido: [${payload.eventType}]`, payload);
        procesarEventoRealtimeRepostajes(payload);
      }
    )
    .subscribe((status, err) => {
      console.log('📡 Estado de conexión Realtime Repostajes:', status);
      if (err) {
        console.error('❌ Error en canal Realtime Repostajes:', err);
      }
      if (status === 'SUBSCRIBED') {
        console.log('✅ [Realtime Repostajes] Canal suscrito exitosamente (SUBSCRIBED)');
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        console.warn('⚠️ [Realtime Repostajes] Canal cerrado o con error:', status);
      }
    });

  return canalRealtimeRepostajes;
}

/**
 * Procesa los eventos entrantes de Supabase Realtime para la tabla "repostajes" (INSERT, UPDATE, DELETE).
 * Actualiza el array local de repostajes y vuelve a dibujar la interfaz en tiempo real en todos los dispositivos conectados.
 */
function procesarEventoRealtimeRepostajes(payload) {
  if (!payload) return;

  const eventType = (payload.eventType || payload.type || '').toUpperCase();
  const nuevoRegistro = payload.new;
  const viejoRegistro = payload.old;

  console.log(`⚡ Procesando evento Realtime [${eventType}] en tabla "repostajes":`, {
    nuevo: nuevoRegistro,
    viejo: viejoRegistro
  });

  // Asegurar referencia unificada en window.repostajes y variable de ámbito local
  let lista = (typeof window.repostajes !== 'undefined' && Array.isArray(window.repostajes))
    ? window.repostajes
    : ((typeof repostajes !== 'undefined' && Array.isArray(repostajes)) ? repostajes : []);

  if (eventType === 'INSERT') {
    if (!nuevoRegistro || !nuevoRegistro.id) return;

    const mapeado = mapearRepostajeDesdeSupabase(nuevoRegistro);
    const nuevoId = String(nuevoRegistro.id);

    // 1. Comprobar si reemplaza un registro optimista local pendiente
    const condMapeado = mapeado.conductor || mapeado.chofer;
    const tempIndex = lista.findIndex(r => 
      String(r.id).startsWith('temp_rep_') &&
      r.camion === mapeado.camion &&
      (r.conductor === condMapeado || r.chofer === condMapeado) &&
      Math.abs(parseFloat(r.litros || 0) - parseFloat(mapeado.litros || 0)) < 0.01
    );

    // 2. Comprobar si ya existe por ID
    const indexExistente = lista.findIndex(r => String(r.id) === nuevoId);

    if (tempIndex !== -1) {
      lista[tempIndex] = mapeado;
      console.log(`✓ Repostaje temporal local confirmado con ID Supabase: ${nuevoId}`);
    } else if (indexExistente !== -1) {
      lista[indexExistente] = mapeado;
      console.log(`✓ Repostaje existente ${nuevoId} actualizado tras INSERT`);
    } else {
      lista.unshift(mapeado);
      console.log(`✓ Nuevo repostaje recibido en tiempo real: ${mapeado.camion} (${mapeado.litros}L) por ${mapeado.conductor}`);
      if (typeof mostrarToastLogistica === 'function') {
        mostrarToastLogistica(`⛽ Nuevo repostaje: ${mapeado.camion} - ${mapeado.litros}L (${mapeado.conductor})`);
      }
    }

    // Sincronizar array local en memoria y almacenamiento
    window.repostajes = lista;
    if (typeof repostajes !== 'undefined') {
      try { repostajes = lista; } catch (e) {}
    }
    if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();

    // Re-renderizado reactivo de la tabla/lista de repostajes en la UI
    refrescarVistasRepostajes();

  } else if (eventType === 'UPDATE') {
    if (!nuevoRegistro || !nuevoRegistro.id) return;
    const nuevoId = String(nuevoRegistro.id);
    const index = lista.findIndex(r => String(r.id) === nuevoId);
    const mapeado = mapearRepostajeDesdeSupabase(nuevoRegistro);

    if (index !== -1) {
      lista[index] = mapeado;
      console.log(`✓ Repostaje ${nuevoId} actualizado en tiempo real.`);
    } else {
      lista.unshift(mapeado);
    }

    window.repostajes = lista;
    if (typeof repostajes !== 'undefined') {
      try { repostajes = lista; } catch (e) {}
    }
    if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
    refrescarVistasRepostajes();

  } else if (eventType === 'DELETE') {
    const idEliminar = viejoRegistro?.id ?? payload.old_record?.id ?? payload.id;
    console.log(`🗑️ Evento DELETE Realtime en repostajes para ID:`, idEliminar);

    if (idEliminar) {
      const idx = lista.findIndex(r => String(r.id) === String(idEliminar));
      if (idx !== -1) {
        lista.splice(idx, 1);
        console.log(`✓ Repostaje ${idEliminar} eliminado localmente tras evento DELETE de Supabase.`);
      }

      window.repostajes = lista;
      if (typeof repostajes !== 'undefined') {
        try { repostajes = lista; } catch (e) {}
      }
      if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
      refrescarVistasRepostajes();

      if (typeof mostrarToastLogistica === 'function') {
        mostrarToastLogistica('⚡ Un registro de repostaje fue eliminado.');
      }
    }
  }
}

/**
 * Re-renderiza dinámicamente todas las vistas de repostajes en la interfaz (panel admin, lista y detalle de conductor)
 */
function refrescarVistasRepostajes() {
  try {
    if (typeof renderAdminCombustible === 'function') {
      renderAdminCombustible();
    }
  } catch (e) {
    console.warn('Aviso al refrescar renderAdminCombustible:', e);
  }

  try {
    if (typeof renderRepostajes === 'function') {
      renderRepostajes();
    }
  } catch (e) {
    console.warn('Aviso al refrescar renderRepostajes:', e);
  }

  try {
    const condActual = window.conductorSeleccionadoActual || window.choferSeleccionadoActual;
    if (condActual) {
      const panelHistorial = document.getElementById('panel-detalle-historial-conductor') || document.getElementById('panel-detalle-historial-chofer');
      if (panelHistorial && !panelHistorial.classList.contains('hidden')) {
        if (typeof verDetalleHistorialConductor === 'function') {
          verDetalleHistorialConductor(condActual);
        } else if (typeof verDetalleHistorialChofer === 'function') {
          verDetalleHistorialChofer(condActual);
        }
      }
    }
  } catch (e) {
    console.warn('Aviso al refrescar historial de repostajes del conductor:', e);
  }
}

/* ==========================================================================
   SINCRONIZACIÓN Y TIEMPO REAL DE LA TABLA "conductores"
   ========================================================================== */

/**
 * Normaliza un registro de conductor proveniente de Supabase al formato que utiliza la aplicación en memoria.
 * Mapea las columnas de la tabla independiente ("Nombre Completo", "DNI / NIE", "Teléfono Móvil")
 * y asegura compatibilidad bidireccional con las propiedades locales ('nombre', 'dni', 'telefono').
 */
function mapearConductorDesdeSupabase(c) {
  if (!c) return null;

  const nombreFinal = (c['Nombre Completo'] || c.nombre || c.nombre_completo || c.Nombre || 'Conductor').toString().trim();
  const dniFinal = (c['DNI / NIE'] || c['DNI/NIE'] || c.dni || c.dni_nie || c['DNI'] || '').toString().trim();
  const telFinal = (c['Teléfono Móvil'] || c['Telefono Movil'] || c['telefono_movil'] || c.telefono || c['Telefono'] || '').toString().trim();
  const fotoFinal = (c.foto && typeof esFotoValida === 'function' && esFotoValida(c.foto)) ? c.foto : (c.Foto && typeof esFotoValida === 'function' && esFotoValida(c.Foto) ? c.Foto : '');

  return {
    id: c.id,
    created_at: c.created_at || new Date().toISOString(),
    nombre: nombreFinal,
    'Nombre Completo': nombreFinal,
    dni: dniFinal,
    'DNI / NIE': dniFinal,
    telefono: telFinal,
    'Teléfono Móvil': telFinal,
    foto: fotoFinal
  };
}

/**
 * 1. SELECT: Obtener todos los conductores desde la tabla "conductores" de Supabase al iniciar la aplicación
 */
async function cargarConductoresDesdeSupabase() {
  if (!_supabase) {
    console.warn('⚠️ Supabase no disponible para cargar conductores.');
    return;
  }

  try {
    const { data, error } = await _supabase
      .from('conductores')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      if (error.code === 'PGRST205' || (error.message && error.message.includes('schema cache'))) {
        console.warn('ℹ️ La tabla "conductores" aún no está disponible en el panel de Supabase. Operando con datos locales temporalmente.');
        return;
      }
      if (error.code === '42501' || (error.message && error.message.includes('row-level security')) || error.code === 'PGRST301') {
        console.warn('ℹ️ Políticas RLS activas en tabla "conductores". Manteniendo datos locales en memoria:', error.message);
        return;
      }
      console.error('❌ Error al consultar conductores en Supabase:', error.message);
      return;
    }

    if (data && Array.isArray(data)) {
      if (data.length > 0) {
        console.log(`✓ ${data.length} conductores cargados exitosamente desde Supabase:`, data);
        const mapeados = data.map(mapearConductorDesdeSupabase).filter(Boolean);
        conductores = mapeados;
        window.conductores = conductores;
        window.choferes = conductores;
        if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
      } else {
        console.log('Tabla "conductores" en Supabase vacía. Migrando conductores locales iniciales si existen...');
        await migrarConductoresInicialesASupabase();
      }
      refrescarVistasConductores();
    }
  } catch (err) {
    console.error('Excepción al cargar conductores desde Supabase:', err);
  }
}

/**
 * Migra los conductores locales iniciales a la tabla "conductores" de Supabase si está recién creada y vacía
 */
async function migrarConductoresInicialesASupabase() {
  if (!_supabase || typeof conductores === 'undefined' || !Array.isArray(conductores) || conductores.length === 0) return;

  try {
    const filasParaInsertar = conductores.map(c => ({
      'Nombre Completo': (c['Nombre Completo'] || c.nombre || 'Conductor').toString().trim(),
      'DNI / NIE': (c['DNI / NIE'] || c.dni || '').toString().trim(),
      'Teléfono Móvil': (c['Teléfono Móvil'] || c.telefono || '').toString().trim()
    }));

    let { data, error } = await _supabase
      .from('conductores')
      .insert(filasParaInsertar)
      .select();

    // Si Postgres lanza 42501 / 401 por políticas RLS activas en Supabase
    if (error && (error.code === '42501' || (error.message && error.message.includes('row-level security')) || error.code === 'PGRST301')) {
      console.warn('ℹ️ [RLS Activo en Supabase] La tabla "conductores" requiere política de INSERT para anon o desactivar RLS. Operando con conductores locales.');
      return;
    }

    // Si Postgres lanza 42703 (columna inexistente por variaciones en el nombre de columna), reintentar con estándar en minúsculas
    if (error && error.code === '42703') {
      const filasAlt = conductores.map(c => ({
        nombre: (c.nombre || c['Nombre Completo'] || 'Conductor').toString().trim(),
        dni: (c.dni || c['DNI / NIE'] || '').toString().trim(),
        telefono: (c.telefono || c['Teléfono Móvil'] || '').toString().trim()
      }));
      const retry = await _supabase.from('conductores').insert(filasAlt).select();
      data = retry.data;
      error = retry.error;
    }

    if (!error && data && data.length > 0) {
      console.log(`✓ ${data.length} conductores iniciales migrados exitosamente a Supabase.`);
      conductores = data.map(mapearConductorDesdeSupabase).filter(Boolean);
      window.conductores = conductores;
      window.choferes = conductores;
      if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
    }
  } catch (e) {
    console.error('Error durante la migración de conductores a Supabase:', e);
  }
}

/**
 * 2. INSERT: Registrar un nuevo conductor en la tabla "conductores" de Supabase de forma asíncrona
 */
async function insertarConductorSupabase(conductorData) {
  if (!conductorData) return null;

  const nombre = (conductorData['Nombre Completo'] || conductorData.nombre || '').toString().trim();
  const dni = (conductorData['DNI / NIE'] || conductorData.dni || '').toString().trim();
  const telefono = (conductorData['Teléfono Móvil'] || conductorData.telefono || '').toString().trim();
  const foto = (conductorData.foto && (typeof esFotoValida !== 'function' || esFotoValida(conductorData.foto))) ? conductorData.foto : '';

  // 1. Inserción optimista en memoria local para respuesta instantánea en la interfaz
  const tempId = 'temp_cond_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  const nuevoLocal = {
    id: tempId,
    created_at: new Date().toISOString(),
    nombre: nombre,
    'Nombre Completo': nombre,
    dni: dni,
    'DNI / NIE': dni,
    telefono: telefono,
    'Teléfono Móvil': telefono,
    foto: foto
  };

  let lista = (typeof window.conductores !== 'undefined' && Array.isArray(window.conductores))
    ? window.conductores
    : ((typeof conductores !== 'undefined' && Array.isArray(conductores)) ? conductores : []);

  // Evitar duplicados si fue agregado con ID temporal
  const idxExistente = lista.findIndex(c => 
    (c.id && c.id === conductorData.id) ||
    (c.nombre && c.nombre.trim().toLowerCase() === nombre.toLowerCase())
  );

  if (idxExistente !== -1) {
    lista[idxExistente] = { ...lista[idxExistente], ...nuevoLocal, id: lista[idxExistente].id || tempId };
  } else {
    lista.push(nuevoLocal);
  }

  window.conductores = lista;
  window.choferes = lista;
  if (typeof conductores !== 'undefined') {
    try { conductores = lista; } catch (e) {}
  }
  if (typeof choferes !== 'undefined') {
    try { choferes = lista; } catch (e) {}
  }
  if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
  refrescarVistasConductores();

  if (!_supabase) {
    console.warn('⚠️ Supabase no disponible; el conductor se guardó únicamente en local.');
    return { data: [nuevoLocal], error: null, id: nuevoLocal.id, ...nuevoLocal };
  }

  try {
    // Columnas exactas de la tabla: "Nombre Completo", "DNI / NIE", "Teléfono Móvil"
    const payload = {
      'Nombre Completo': nombre,
      'DNI / NIE': dni,
      'Teléfono Móvil': telefono
    };

    console.log('🚀 Insertando conductor asíncrono en Supabase ("conductores"):', payload);

    let { data, error } = await _supabase
      .from('conductores')
      .insert([payload])
      .select();

    // Si Postgres falla por nombre de columna (código 42703), reintentar con variantes minúsculas
    if (error && error.code === '42703') {
      console.warn('⚠️ Columnas exactas con espacios no detectadas en tabla "conductores". Reintentando con formato alternativo...');
      const payloadAlt = {
        nombre: nombre,
        dni: dni,
        telefono: telefono
      };
      const retry = await _supabase.from('conductores').insert([payloadAlt]).select();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('❌ Error al insertar conductor en Supabase:', error.message);
      if (typeof mostrarToastLogistica === 'function') {
        if (error.code === 'PGRST205') {
          mostrarToastLogistica('⚠️ Falta crear la tabla "conductores" en Supabase. Guardado localmente.');
        } else if (error.code === '42501' || (error.message && error.message.includes('row-level security'))) {
          mostrarToastLogistica('⚠️ RLS activo en "conductores". Guardado localmente. Revisa las políticas en Supabase.');
        } else {
          mostrarToastLogistica(`⚠️ Error en Supabase al registrar conductor: ${error.message}`);
        }
      }
      return { data: [nuevoLocal], error, id: nuevoLocal.id, ...nuevoLocal };
    }

    if (data && data[0]) {
      const creado = data[0];
      const mapeado = mapearConductorDesdeSupabase(creado);
      if (foto) mapeado.foto = foto;

      // Reemplazar el registro optimista temporal con el ID definitivo asignado por Supabase
      const idxTemp = lista.findIndex(c => String(c.id) === String(tempId) || (c.nombre && c.nombre.trim().toLowerCase() === nombre.toLowerCase()));
      if (idxTemp !== -1) {
        lista[idxTemp] = mapeado;
      } else {
        lista.push(mapeado);
      }

      window.conductores = lista;
      window.choferes = lista;
      if (typeof conductores !== 'undefined') {
        try { conductores = lista; } catch (e) {}
      }
      if (typeof choferes !== 'undefined') {
        try { choferes = lista; } catch (e) {}
      }

      if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
      refrescarVistasConductores();
      console.log('✓ Conductor confirmado e insertado en tabla "conductores" de Supabase con ID:', creado.id);
      return { data: [creado], error: null, id: creado.id, ...mapeado };
    }
  } catch (err) {
    console.error('Excepción al insertar conductor en Supabase:', err);
  }

  return { data: [nuevoLocal], error: null, id: nuevoLocal.id, ...nuevoLocal };
}

/**
 * 3. UPDATE: Actualizar datos de un conductor existente en la tabla "conductores" de Supabase
 */
async function actualizarConductorSupabase(conductorData, nombreAnterior = null) {
  if (!conductorData) return null;

  const id = conductorData.id;
  const nombre = (conductorData['Nombre Completo'] || conductorData.nombre || '').toString().trim();
  const dni = (conductorData['DNI / NIE'] || conductorData.dni || '').toString().trim();
  const telefono = (conductorData['Teléfono Móvil'] || conductorData.telefono || '').toString().trim();
  const foto = (conductorData.foto && (typeof esFotoValida !== 'function' || esFotoValida(conductorData.foto))) ? conductorData.foto : '';

  // 1. Actualización optimista inmediata en memoria local
  let lista = (typeof window.conductores !== 'undefined' && Array.isArray(window.conductores))
    ? window.conductores
    : ((typeof conductores !== 'undefined' && Array.isArray(conductores)) ? conductores : []);

  let idx = -1;
  if (id !== undefined && id !== null && String(id).trim() !== '') {
    idx = lista.findIndex(c => String(c.id) === String(id));
  }
  if (idx === -1 && nombreAnterior) {
    idx = lista.findIndex(c => c.nombre && c.nombre.trim().toLowerCase() === String(nombreAnterior).trim().toLowerCase());
  }
  if (idx === -1 && nombre) {
    idx = lista.findIndex(c => c.nombre && c.nombre.trim().toLowerCase() === nombre.toLowerCase());
  }

  if (idx !== -1) {
    lista[idx] = {
      ...lista[idx],
      ...conductorData,
      nombre: nombre,
      'Nombre Completo': nombre,
      dni: dni,
      'DNI / NIE': dni,
      telefono: telefono,
      'Teléfono Móvil': telefono,
      foto: foto || lista[idx].foto || ''
    };
    window.conductores = lista;
    window.choferes = lista;
    if (typeof conductores !== 'undefined') {
      try { conductores = lista; } catch (e) {}
    }
    if (typeof choferes !== 'undefined') {
      try { choferes = lista; } catch (e) {}
    }
    if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
    refrescarVistasConductores();
  }

  if (!_supabase) {
    console.warn('⚠️ Supabase no disponible; actualización guardada únicamente en local.');
    return { data: [conductorData], error: null };
  }

  try {
    const payload = {
      'Nombre Completo': nombre,
      'DNI / NIE': dni,
      'Teléfono Móvil': telefono
    };

    console.log(`📡 Enviando UPDATE a tabla "conductores" en Supabase:`, { id, payload });

    const esIdValido = id !== undefined && id !== null && !String(id).startsWith('temp_cond_') && !String(id).startsWith('local_');

    let query = null;
    if (esIdValido) {
      query = _supabase.from('conductores').update(payload).eq('id', id);
    } else if (nombreAnterior) {
      query = _supabase.from('conductores').update(payload).eq('Nombre Completo', nombreAnterior);
    } else {
      query = _supabase.from('conductores').update(payload).eq('Nombre Completo', nombre);
    }

    let { data, error } = await query.select();

    // Si Postgres falla por nombre de columna (código 42703), reintentar con variantes minúsculas
    if (error && error.code === '42703') {
      console.warn('⚠️ Columnas exactas con espacios no detectadas en UPDATE. Reintentando con minúsculas...');
      const payloadAlt = { nombre, dni, telefono };
      let queryAlt = null;
      if (esIdValido) {
        queryAlt = _supabase.from('conductores').update(payloadAlt).eq('id', id);
      } else if (nombreAnterior) {
        queryAlt = _supabase.from('conductores').update(payloadAlt).eq('nombre', nombreAnterior);
      } else {
        queryAlt = _supabase.from('conductores').update(payloadAlt).eq('nombre', nombre);
      }
      const retry = await queryAlt.select();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('❌ Error al actualizar conductor en Supabase:', error.message);
      return { data: null, error };
    }

    if (data && data[0]) {
      const mapeado = mapearConductorDesdeSupabase(data[0]);
      if (foto) mapeado.foto = foto;
      if (idx !== -1) {
        lista[idx] = mapeado;
        window.conductores = lista;
        window.choferes = lista;
        if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
        refrescarVistasConductores();
      }
      console.log('✓ Conductor confirmado y actualizado en tabla "conductores" de Supabase:', data[0]);
      return { data, error: null, id: data[0].id, ...mapeado };
    }
  } catch (err) {
    console.error('Excepción al actualizar conductor en Supabase:', err);
    return { data: null, error: err };
  }

  return { data: [conductorData], error: null };
}

/**
 * 4. DELETE: Eliminar un registro de la tabla "conductores" en Supabase de forma asíncrona
 */
async function eliminarConductorSupabase(idDelRegistro, nombre = null) {
  if (!idDelRegistro && !nombre) {
    return { success: false, error: new Error('ID o Nombre no especificado') };
  }

  if (idDelRegistro && String(idDelRegistro).startsWith('temp_cond_')) {
    return { success: true };
  }

  if (!_supabase) {
    return { success: true };
  }

  try {
    console.log(`🗑️ Eliminando conductor de la tabla "conductores" en Supabase...`, { id: idDelRegistro, nombre });

    let query = null;
    const esIdValido = idDelRegistro !== undefined && idDelRegistro !== null && !String(idDelRegistro).startsWith('local_') && !String(idDelRegistro).startsWith('temp_');

    if (esIdValido) {
      query = _supabase.from('conductores').delete().eq('id', idDelRegistro);
    } else if (nombre) {
      query = _supabase.from('conductores').delete().eq('Nombre Completo', nombre);
    } else {
      return { success: false, error: new Error('Identificador no válido') };
    }

    let { error } = await query;

    // Si falla por 42703 (por ejemplo 'Nombre Completo' no reconocido), reintentar con 'nombre'
    if (error && error.code === '42703' && nombre) {
      const retry = await _supabase.from('conductores').delete().eq('nombre', nombre);
      error = retry.error;
    }

    if (error) {
      console.error(`❌ Error al eliminar conductor en Supabase:`, error.message);
      return { success: false, error };
    }

    console.log(`✓ Conductor eliminado exitosamente de la tabla "conductores" en Supabase.`);
    return { success: true };
  } catch (err) {
    console.error(`❌ Excepción al eliminar conductor en Supabase:`, err);
    return { success: false, error: err };
  }
}

/**
 * 5. REALTIME: Suscribirse a cambios en tiempo real en la tabla "conductores"
 * Configura el canal "bugamed-conductores-realtime" escuchando todos los eventos:
 * { event: '*', schema: 'public', table: 'conductores' }
 */
function suscribirConductoresRealtime() {
  if (!_supabase) {
    console.warn('⚠️ Cliente Supabase no disponible para Realtime de conductores.');
    return null;
  }

  // 1. Eliminar canal previo si existía para evitar listeners duplicados
  if (canalRealtimeConductores) {
    console.log('🔄 Removiendo canal Realtime de conductores previo antes de reconectar...');
    try {
      _supabase.removeChannel(canalRealtimeConductores);
    } catch (e) {
      console.warn('Error al remover canal Realtime anterior de conductores:', e);
    }
    canalRealtimeConductores = null;
  }

  console.log('📡 Conectando canal Realtime "bugamed-conductores-realtime" para tabla "conductores" con { event: "*" }...');

  // 2. Crear y suscribirse al canal específico de la tabla conductores
  canalRealtimeConductores = _supabase
    .channel('bugamed-conductores-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'conductores' },
      (payload) => {
        console.log(`👤 [Realtime Conductores] Evento detectado [${payload?.eventType || payload?.type || '*'}] en tabla "conductores":`, payload);
        procesarEventoRealtimeConductores(payload);
      }
    )
    .subscribe((status, err) => {
      console.log('📡 Estado de conexión Realtime Conductores:', status);
      if (err) {
        console.error('❌ Error en canal Realtime Conductores:', err);
      }
      if (status === 'SUBSCRIBED') {
        console.log('✅ [Realtime Conductores] Canal suscrito exitosamente (SUBSCRIBED). Conductores sincronizados en vivo.');
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        console.warn('⚠️ [Realtime Conductores] Canal cerrado o con error:', status);
      }
    });

  window.canalRealtimeConductores = canalRealtimeConductores;
  return canalRealtimeConductores;
}

/**
 * 6. EVENT HANDLER: Procesa los eventos entrantes de Supabase Realtime para la tabla "conductores" (INSERT, UPDATE, DELETE).
 * Actualiza el array local de conductores al instante y vuelve a dibujar la interfaz en todos los dispositivos conectados sin recargar la página.
 */
function procesarEventoRealtimeConductores(payload) {
  if (!payload) return;

  const eventType = (payload.eventType || payload.type || payload.event || '').toUpperCase();
  const nuevoRegistro = payload.new || payload.record;
  const viejoRegistro = payload.old || payload.old_record || {};

  console.log(`⚡ [Realtime Conductores] Procesando evento [${eventType}] en tabla "conductores":`, {
    nuevo: nuevoRegistro,
    viejo: viejoRegistro
  });

  // Asegurar referencia unificada en window.conductores y variable de ámbito
  let lista = (typeof window.conductores !== 'undefined' && Array.isArray(window.conductores))
    ? window.conductores
    : ((typeof conductores !== 'undefined' && Array.isArray(conductores)) ? conductores : []);

  // =========================================================================
  // GESTIÓN DEL EVENTO INSERT
  // =========================================================================
  if (eventType === 'INSERT') {
    if (!nuevoRegistro || nuevoRegistro.id === undefined) return;

    const mapeado = mapearConductorDesdeSupabase(nuevoRegistro);
    const nuevoId = String(nuevoRegistro.id);
    const nombreNuevo = mapeado.nombre;

    // 1. Comprobar si reemplaza un registro optimista local pendiente
    const tempIndex = lista.findIndex(c => 
      String(c.id).startsWith('temp_cond_') &&
      c.nombre && c.nombre.trim().toLowerCase() === nombreNuevo.toLowerCase()
    );

    // 2. Comprobar si ya existe por ID o por Nombre
    const indexExistenteId = lista.findIndex(c => String(c.id) === nuevoId);
    const indexExistenteNombre = lista.findIndex(c => c.nombre && c.nombre.trim().toLowerCase() === nombreNuevo.toLowerCase());

    if (tempIndex !== -1) {
      if (!mapeado.foto && lista[tempIndex].foto) mapeado.foto = lista[tempIndex].foto;
      lista[tempIndex] = mapeado;
      console.log(`✓ Conductor temporal local confirmado con ID Supabase: ${nuevoId}`);
    } else if (indexExistenteId !== -1) {
      if (!mapeado.foto && lista[indexExistenteId].foto) mapeado.foto = lista[indexExistenteId].foto;
      lista[indexExistenteId] = mapeado;
      console.log(`✓ Conductor existente ${nuevoId} actualizado tras INSERT`);
    } else if (indexExistenteNombre !== -1) {
      if (!mapeado.foto && lista[indexExistenteNombre].foto) mapeado.foto = lista[indexExistenteNombre].foto;
      lista[indexExistenteNombre] = mapeado;
      console.log(`✓ Conductor ${nombreNuevo} sincronizado con nuevo ID Supabase: ${nuevoId}`);
    } else {
      lista.push(mapeado);
      console.log(`✓ Nuevo conductor recibido en tiempo real: ${mapeado.nombre} (${mapeado.telefono})`);
      if (typeof mostrarToastLogistica === 'function') {
        mostrarToastLogistica(`👤 Nuevo conductor en vivo: ${mapeado.nombre}`);
      }
    }

    // Sincronizar array local en memoria y almacenamiento
    window.conductores = lista;
    window.choferes = lista;
    if (typeof conductores !== 'undefined') {
      try { conductores = lista; } catch (e) {}
    }
    if (typeof choferes !== 'undefined') {
      try { choferes = lista; } catch (e) {}
    }
    if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();

    // Re-renderizado reactivo inmediato de la interfaz en todos los dispositivos
    refrescarVistasConductores();

  // =========================================================================
  // GESTIÓN DEL EVENTO UPDATE
  // =========================================================================
  } else if (eventType === 'UPDATE') {
    if (!nuevoRegistro) return;

    const mapeado = mapearConductorDesdeSupabase(nuevoRegistro);
    const idModificado = nuevoRegistro.id;
    let index = -1;

    if (idModificado !== undefined && idModificado !== null && idModificado !== '') {
      index = lista.findIndex(c => String(c.id) === String(idModificado));
    }

    // Fallbacks si el registro local no tenía el ID exacto
    if (index === -1 && mapeado.dni) {
      index = lista.findIndex(c => c.dni && c.dni.trim().toLowerCase() === mapeado.dni.toLowerCase());
    }
    if (index === -1 && mapeado.nombre) {
      index = lista.findIndex(c => c.nombre && c.nombre.trim().toLowerCase() === mapeado.nombre.toLowerCase());
    }

    if (index !== -1) {
      const nombreAnterior = lista[index].nombre;
      const nombreNuevo = mapeado.nombre;

      if (!mapeado.foto && lista[index].foto) {
        mapeado.foto = lista[index].foto;
      }

      lista[index] = {
        ...lista[index],
        ...mapeado
      };

      console.log(`✓ [UPDATE Realtime] Conductor ID ${idModificado} modificado en vivo:`, {
        nombre: lista[index].nombre,
        dni: lista[index].dni,
        telefono: lista[index].telefono
      });

      // Si el nombre del conductor fue modificado, propagar a las rutas locales
      if (nombreAnterior && nombreNuevo && nombreAnterior !== nombreNuevo) {
        if (typeof sincronizarCambioNombreConductorLocal === 'function') {
          sincronizarCambioNombreConductorLocal(nombreAnterior, nombreNuevo);
        }
      }
    } else {
      lista.push(mapeado);
      console.log(`✓ [UPDATE Realtime] Conductor ID ${idModificado} añadido al array:`, mapeado);
    }

    // Sincronizar array local en memoria y almacenamiento
    window.conductores = lista;
    window.choferes = lista;
    if (typeof conductores !== 'undefined') {
      try { conductores = lista; } catch (e) {}
    }
    if (typeof choferes !== 'undefined') {
      try { choferes = lista; } catch (e) {}
    }
    if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();

    // Re-renderizado reactivo inmediato de la interfaz
    refrescarVistasConductores();

    if (typeof mostrarToastLogistica === 'function') {
      mostrarToastLogistica(`⚡ Datos de "${mapeado.nombre}" actualizados en vivo`);
    }

  // =========================================================================
  // GESTIÓN DEL EVENTO DELETE
  // =========================================================================
  } else if (eventType === 'DELETE' || (!eventType && (viejoRegistro?.id || payload.old?.id))) {
    // 1. Extraer ID del conductor eliminado de forma robusta y directa desde payload.old.id
    const idEliminar = payload.old?.id ?? viejoRegistro?.id ?? payload.old_record?.id ?? payload.id ?? null;
    const nombreEliminar = payload.old?.['Nombre Completo'] ?? payload.old?.nombre ?? viejoRegistro?.['Nombre Completo'] ?? viejoRegistro?.nombre ?? payload.old_record?.['Nombre Completo'] ?? payload.old_record?.nombre ?? null;

    console.log(`🗑️ [Realtime Conductores] Evento DELETE recibido para ID:`, idEliminar, payload);

    if (idEliminar === null && idEliminar === undefined && !nombreEliminar) {
      console.warn('⚠️ Evento DELETE en tabla "conductores" recibido sin ID identificable:', payload);
      return;
    }

    const idEliminarStr = (idEliminar !== null && idEliminar !== undefined) ? String(idEliminar).trim() : '';
    const idEliminarNum = Number(idEliminar);
    const esNumeroValido = !isNaN(idEliminarNum) && idEliminarStr !== '';
    const nomNorm = nombreEliminar ? String(nombreEliminar).trim().toLowerCase() : '';

    let nombreEliminado = nombreEliminar || null;

    // Función auxiliar para eliminar el conductor in-place mediante splice buscando por ID o Nombre
    const eliminarDeArray = (arr) => {
      if (!Array.isArray(arr)) return 0;
      let count = 0;
      for (let i = arr.length - 1; i >= 0; i--) {
        const c = arr[i];
        if (!c) continue;
        const cIdStr = (c.id !== undefined && c.id !== null) ? String(c.id).trim() : '';
        const cIdNum = Number(c.id);
        const coincideId = idEliminarStr !== '' && (cIdStr === idEliminarStr || (esNumeroValido && !isNaN(cIdNum) && cIdNum === idEliminarNum));
        const coincideNombre = nomNorm !== '' && c.nombre && c.nombre.trim().toLowerCase() === nomNorm;

        if (coincideId || coincideNombre) {
          if (!nombreEliminado && c.nombre) {
            nombreEliminado = c.nombre;
          }
          arr.splice(i, 1);
          count++;
        }
      }
      return count;
    };

    // 2. Eliminar del array local de conductores in-place en todas las referencias globales y de ámbito
    let totalEliminados = 0;
    if (typeof window !== 'undefined' && Array.isArray(window.conductores)) {
      totalEliminados += eliminarDeArray(window.conductores);
    }
    if (typeof window !== 'undefined' && Array.isArray(window.choferes) && window.choferes !== window.conductores) {
      totalEliminados += eliminarDeArray(window.choferes);
    }
    if (typeof conductores !== 'undefined' && Array.isArray(conductores) && conductores !== window?.conductores) {
      totalEliminados += eliminarDeArray(conductores);
    }
    if (typeof choferes !== 'undefined' && Array.isArray(choferes) && choferes !== window?.choferes && choferes !== conductores) {
      totalEliminados += eliminarDeArray(choferes);
    }

    // Sincronizar referencias unificadas
    const listaActualizada = (typeof window !== 'undefined' && Array.isArray(window.conductores))
      ? window.conductores
      : ((typeof conductores !== 'undefined' && Array.isArray(conductores)) ? conductores : []);

    window.conductores = listaActualizada;
    window.choferes = listaActualizada;
    if (typeof conductores !== 'undefined') {
      try { conductores = listaActualizada; } catch (e) {}
    }
    if (typeof choferes !== 'undefined') {
      try { choferes = listaActualizada; } catch (e) {}
    }

    if (nombreEliminado && typeof conductoresEliminadosSet !== 'undefined') {
      conductoresEliminadosSet.add(nombreEliminado.trim().toLowerCase());
    }

    console.log(`✓ Conductor (ID: ${idEliminar}${nombreEliminado ? `, Nombre: "${nombreEliminado}"` : ''}) eliminado en tiempo real. Registros locales retirados: ${totalEliminados}`);

    // Limpiar rutas asociadas en memoria local si corresponde
    if (nombreEliminado) {
      const nNorm = nombreEliminado.trim().toLowerCase();
      if (typeof rutas !== 'undefined' && Array.isArray(rutas)) {
        for (let i = rutas.length - 1; i >= 0; i--) {
          const r = rutas[i];
          if (r && ((r.conductor && r.conductor.trim().toLowerCase() === nNorm) || (r.chofer && r.chofer.trim().toLowerCase() === nNorm))) {
            rutas.splice(i, 1);
          }
        }
      }
      if (typeof window !== 'undefined' && Array.isArray(window.rutas)) {
        for (let i = window.rutas.length - 1; i >= 0; i--) {
          const r = window.rutas[i];
          if (r && ((r.conductor && r.conductor.trim().toLowerCase() === nNorm) || (r.chofer && r.chofer.trim().toLowerCase() === nNorm))) {
            window.rutas.splice(i, 1);
          }
        }
      }
    }

    // Guardar cambios en almacenamiento local
    if (typeof guardarDatosEnLocal === 'function') {
      guardarDatosEnLocal();
    } else {
      try {
        localStorage.setItem('bugamed_conductores', JSON.stringify(listaActualizada));
        localStorage.setItem('bugamed_choferes', JSON.stringify(listaActualizada));
      } catch (e) {}
    }

    // 3. Volver a renderizar la interfaz al instante en todos los dispositivos conectados sin recargar
    refrescarVistasConductores();
    if (typeof refrescarVistasRutas === 'function') {
      refrescarVistasRutas();
    }
    if (typeof actualizarKPIs === 'function') {
      actualizarKPIs();
    }

    if (typeof mostrarToastLogistica === 'function') {
      mostrarToastLogistica(`🗑️ Conductor ${nombreEliminado ? `"${nombreEliminado}"` : ''} eliminado en tiempo real.`);
    }
  }
}

/**
 * 7. Re-renderiza dinámicamente todas las vistas de conductores en la interfaz:
 * - Tarjetas de conductores/personal Bugamed (renderConductores / renderChoferes)
 * - Cuadrícula de asignación semanal (renderGridConductoresAsignacion)
 * - Portal y visualización de rutas de conductores (renderVisualizacionRutasConductores)
 * - Historial de conductores (renderHistorialConductoresGrid)
 * - Módulo de logística y selector de conductores
 * - KPIs y filtros de combustible
 */
function refrescarVistasConductores() {
  try {
    if (typeof renderConductores === 'function') renderConductores();
    else if (typeof renderChoferes === 'function') renderChoferes();
  } catch (e) { console.warn('Aviso en renderConductores:', e); }

  try {
    if (typeof renderGridConductoresAsignacion === 'function') renderGridConductoresAsignacion();
    else if (typeof renderGridChoferesAsignacion === 'function') renderGridChoferesAsignacion();
  } catch (e) { console.warn('Aviso en renderGridConductoresAsignacion:', e); }

  try {
    if (typeof renderVisualizacionRutasConductores === 'function') renderVisualizacionRutasConductores();
    else if (typeof renderVisualizacionRutasChoferes === 'function') renderVisualizacionRutasChoferes();

    if (typeof actualizarSelectPortalConductores === 'function') actualizarSelectPortalConductores();
    else if (typeof actualizarSelectPortalChoferes === 'function') actualizarSelectPortalChoferes();
  } catch (e) { console.warn('Aviso en renderVisualizacionRutasConductores:', e); }

  try {
    if (typeof renderHistorialConductoresGrid === 'function') renderHistorialConductoresGrid();
    else if (typeof renderHistorialChoferesGrid === 'function') renderHistorialChoferesGrid();
  } catch (e) { console.warn('Aviso en renderHistorialConductoresGrid:', e); }

  try {
    if (typeof renderModuloLogistica === 'function') renderModuloLogistica();
  } catch (e) { console.warn('Aviso en renderModuloLogistica:', e); }

  try {
    if (typeof renderAdminCombustible === 'function') renderAdminCombustible();
  } catch (e) { console.warn('Aviso en renderAdminCombustible desde conductores:', e); }

  try {
    const modalSel = document.getElementById('modal-selector-conductores') || document.getElementById('modal-selector-choferes');
    if (modalSel && !modalSel.classList.contains('hidden')) {
      if (typeof abrirSelectorConductoresInicio === 'function') abrirSelectorConductoresInicio();
      else if (typeof abrirSelectorChoferesInicio === 'function') abrirSelectorChoferesInicio();
    }
  } catch (e) {}

  try {
    if (typeof actualizarKPIs === 'function') actualizarKPIs();
  } catch (e) {}
}

/* ==========================================================================
   SINCRONIZACIÓN Y TIEMPO REAL DE LA TABLA "clientes"
   ========================================================================== */

/**
 * Normaliza un registro de cliente proveniente de Supabase al formato de la aplicación.
 */
function mapearClienteDesdeSupabase(c) {
  if (!c) return null;
  return {
    id: c.id,
    created_at: c.created_at || new Date().toISOString(),
    nombre: (c.nombre || c.name || '').toString().trim(),
    zona: (c.zona || 'Sin Zona Asignada').toString().trim(),
    tipo: (typeof normalizarTipoCliente === 'function' ? normalizarTipoCliente(c.tipo) : (c.tipo || 'Hotel')),
    direccion: (c.direccion || '').toString().trim(),
    telefono: (c.telefono || '').toString().trim(),
    ubicacion: (c.ubicacion || '').toString().trim()
  };
}

/**
 * 1. SELECT: Obtener todos los clientes desde la tabla "clientes" de Supabase al iniciar la aplicación
 */
async function cargarClientesDesdeSupabase() {
  if (!_supabase) {
    console.warn('⚠️ Supabase no disponible para cargar clientes.');
    return;
  }

  try {
    console.log('🔄 Consultando clientes desde tabla "clientes" de Supabase...');
    const { data, error } = await _supabase
      .from('clientes')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      if (error.code === 'PGRST205' || (error.message && error.message.includes('schema cache'))) {
        console.warn('ℹ️ La tabla "clientes" aún no ha sido creada en Supabase. Operando con datos locales temporalmente.');
        return;
      }
      if (error.code === '42501' || (error.message && error.message.includes('row-level security')) || error.code === 'PGRST301') {
        console.warn('ℹ️ Políticas RLS activas en tabla "clientes". Operando con datos locales temporalmente:', error.message);
        return;
      }
      console.error('❌ Error al consultar clientes en Supabase:', error.message);
      return;
    }

    if (data && Array.isArray(data)) {
      if (data.length > 0) {
        console.log(`✓ ${data.length} clientes cargados exitosamente desde Supabase:`, data);
        const mapeados = data.map(mapearClienteDesdeSupabase).filter(Boolean);
        clientes = mapeados;
        window.clientes = clientes;
        if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
      } else {
        console.log('Tabla "clientes" en Supabase vacía. Migrando clientes locales iniciales...');
        await migrarClientesInicialesASupabase();
      }
      refrescarVistasClientes();
    }
  } catch (err) {
    console.error('Excepción al cargar clientes desde Supabase:', err);
  }
}

/**
 * Migra los clientes locales iniciales a la tabla "clientes" de Supabase si está recién creada y vacía
 */
async function migrarClientesInicialesASupabase() {
  if (!_supabase || typeof clientes === 'undefined' || !Array.isArray(clientes) || clientes.length === 0) return;

  try {
    const filasParaInsertar = clientes.map(c => ({
      nombre: (c.nombre || '').trim(),
      zona: (c.zona || 'Sin Zona Asignada').trim(),
      tipo: (typeof normalizarTipoCliente === 'function' ? normalizarTipoCliente(c.tipo) : (c.tipo || 'Hotel')),
      direccion: (c.direccion || '').trim(),
      telefono: (c.telefono || '').trim(),
      ubicacion: (c.ubicacion || '').trim()
    })).filter(c => c.nombre);

    if (filasParaInsertar.length === 0) return;

    let { data, error } = await _supabase
      .from('clientes')
      .insert(filasParaInsertar)
      .select();

    if (error && (error.code === '42501' || (error.message && error.message.includes('row-level security')))) {
      console.warn('ℹ️ [RLS Activo] La tabla "clientes" en Supabase requiere política de INSERT para anon o desactivar RLS.');
      return;
    }

    if (!error && data && data.length > 0) {
      console.log(`✓ ${data.length} clientes iniciales migrados exitosamente a Supabase.`);
      clientes = data.map(mapearClienteDesdeSupabase).filter(Boolean);
      window.clientes = clientes;
      if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
    }
  } catch (e) {
    console.error('Error durante la migración de clientes a Supabase:', e);
  }
}

/**
 * 2. INSERT: Registrar un nuevo cliente en Supabase de forma asíncrona
 */
async function insertarClienteSupabase(clienteData) {
  if (!clienteData || !clienteData.nombre) {
    return { data: null, error: new Error('Nombre de cliente requerido') };
  }

  const nombre = clienteData.nombre.trim();
  const zona = (clienteData.zona || 'Sin Zona Asignada').trim();
  const tipo = (typeof normalizarTipoCliente === 'function' ? normalizarTipoCliente(clienteData.tipo) : (clienteData.tipo || 'Hotel'));
  const direccion = (clienteData.direccion || '').trim();
  const telefono = (clienteData.telefono || '').trim();
  const ubicacion = (clienteData.ubicacion || '').trim();

  // 1. Inserción optimista en memoria local
  const tempId = 'temp_cli_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  const nuevoLocal = {
    id: tempId,
    created_at: new Date().toISOString(),
    nombre,
    zona,
    tipo,
    direccion,
    telefono,
    ubicacion
  };

  let lista = (typeof clientes !== 'undefined' && Array.isArray(clientes)) ? clientes : [];
  lista.push(nuevoLocal);
  clientes = lista;
  window.clientes = lista;
  if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
  refrescarVistasClientes();

  if (!_supabase) {
    console.warn('⚠️ Supabase no disponible; el cliente se guardó únicamente en local.');
    return { data: [nuevoLocal], error: null, id: tempId, ...nuevoLocal };
  }

  try {
    const payload = {
      nombre,
      zona,
      tipo,
      direccion,
      telefono,
      ubicacion
    };

    console.log('🚀 Insertando cliente en Supabase (tabla "clientes"):', payload);
    const { data, error } = await _supabase
      .from('clientes')
      .insert([payload])
      .select();

    if (error) {
      console.error('❌ Error al insertar cliente en Supabase:', error.message);
      if (typeof mostrarToastLogistica === 'function') {
        if (error.code === 'PGRST205') {
          mostrarToastLogistica('⚠️ Falta crear la tabla "clientes" en Supabase. Guardado localmente.');
        } else if (error.code === '42501' || (error.message && error.message.includes('row-level security'))) {
          mostrarToastLogistica('⚠️ RLS activo en "clientes". Guardado localmente. Revisa las políticas.');
        } else {
          mostrarToastLogistica(`⚠️ Error en Supabase al registrar cliente: ${error.message}`);
        }
      }
      return { data: [nuevoLocal], error, id: tempId, ...nuevoLocal };
    }

    if (data && data[0]) {
      const creado = data[0];
      const mapeado = mapearClienteDesdeSupabase(creado);

      // Reemplazar registro temporal por el ID asignado por Supabase
      const idxTemp = lista.findIndex(c => String(c.id) === String(tempId));
      if (idxTemp !== -1) {
        lista[idxTemp] = mapeado;
      }
      clientes = lista;
      window.clientes = lista;
      if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
      refrescarVistasClientes();
      console.log('✓ Cliente confirmado e insertado en Supabase con ID:', creado.id);
      return { data: [creado], error: null, id: creado.id, ...mapeado };
    }
  } catch (err) {
    console.error('Excepción al insertar cliente en Supabase:', err);
  }

  return { data: [nuevoLocal], error: null, id: tempId, ...nuevoLocal };
}

/**
 * 3. UPDATE: Actualizar datos de un cliente existente en Supabase de forma asíncrona
 */
async function actualizarClienteSupabase(clienteData, id = null) {
  if (!clienteData) return { data: null, error: new Error('Datos de cliente vacíos') };

  const idTarget = id || clienteData.id;
  const nombre = (clienteData.nombre || '').trim();
  const zona = (clienteData.zona || 'Sin Zona Asignada').trim();
  const tipo = (typeof normalizarTipoCliente === 'function' ? normalizarTipoCliente(clienteData.tipo) : (clienteData.tipo || 'Hotel'));
  const direccion = (clienteData.direccion || '').trim();
  const telefono = (clienteData.telefono || '').trim();
  const ubicacion = (clienteData.ubicacion || '').trim();

  let lista = (typeof clientes !== 'undefined' && Array.isArray(clientes)) ? clientes : [];
  const idx = lista.findIndex(c => String(c.id) === String(idTarget) || (c.nombre && c.nombre.trim().toLowerCase() === nombre.toLowerCase()));

  if (idx !== -1) {
    lista[idx] = { ...lista[idx], ...clienteData, nombre, zona, tipo, direccion, telefono, ubicacion };
    clientes = lista;
    window.clientes = lista;
    if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
    refrescarVistasClientes();
  }

  if (!_supabase) return { data: [clienteData], error: null };

  const esIdValido = idTarget && !String(idTarget).startsWith('temp_cli_');

  try {
    const payload = {
      nombre,
      zona,
      tipo,
      direccion,
      telefono,
      ubicacion
    };

    let query = null;
    if (esIdValido) {
      query = _supabase.from('clientes').update(payload).eq('id', idTarget);
    } else {
      query = _supabase.from('clientes').update(payload).eq('nombre', nombre);
    }

    const { data, error } = await query.select();

    if (error) {
      console.error('❌ Error al actualizar cliente en Supabase:', error.message);
      return { data: null, error };
    }

    if (data && data[0]) {
      const mapeado = mapearClienteDesdeSupabase(data[0]);
      if (idx !== -1) {
        lista[idx] = mapeado;
        clientes = lista;
        window.clientes = lista;
        if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
        refrescarVistasClientes();
      }
      console.log('✓ Cliente actualizado en Supabase:', data[0]);
      return { data, error: null, id: data[0].id, ...mapeado };
    }
  } catch (err) {
    console.error('Excepción al actualizar cliente en Supabase:', err);
    return { data: null, error: err };
  }

  return { data: [clienteData], error: null };
}

/**
 * 4. DELETE: Eliminar un registro de la tabla "clientes" en Supabase de forma asíncrona
 */
async function eliminarClienteSupabase(idDelRegistro, nombre = null) {
  if (!idDelRegistro && !nombre) {
    return { success: false, error: new Error('ID o Nombre de cliente no especificado') };
  }

  // Si es un id temporal local, borrar de memoria inmediatamente
  if (idDelRegistro && String(idDelRegistro).startsWith('temp_cli_')) {
    clientes = clientes.filter(c => String(c.id) !== String(idDelRegistro));
    window.clientes = clientes;
    if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
    refrescarVistasClientes();
    return { success: true };
  }

  // Eliminación optimista en memoria local
  let lista = (typeof clientes !== 'undefined' && Array.isArray(clientes)) ? clientes : [];
  lista = lista.filter(c => {
    if (idDelRegistro && String(c.id) === String(idDelRegistro)) return false;
    if (nombre && c.nombre && c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase()) return false;
    return true;
  });
  clientes = lista;
  window.clientes = lista;
  if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
  refrescarVistasClientes();

  if (!_supabase) return { success: true };

  try {
    console.log(`🗑️ Eliminando cliente en Supabase (tabla "clientes")...`, { id: idDelRegistro, nombre });
    let query = null;
    const esIdValido = idDelRegistro !== undefined && idDelRegistro !== null && !String(idDelRegistro).startsWith('temp_');

    if (esIdValido) {
      query = _supabase.from('clientes').delete().eq('id', idDelRegistro);
    } else if (nombre) {
      query = _supabase.from('clientes').delete().eq('nombre', nombre);
    }

    if (query) {
      const { error } = await query;
      if (error) {
        console.error(`❌ Error al eliminar cliente ${idDelRegistro || nombre} en Supabase:`, error.message);
        if (typeof mostrarToastLogistica === 'function') {
          mostrarToastLogistica(`⚠️ Error en Supabase al eliminar cliente: ${error.message}`);
        }
        return { success: false, error };
      }
      console.log(`✓ Cliente ${idDelRegistro || nombre} eliminado exitosamente en Supabase.`);
      return { success: true };
    }
  } catch (err) {
    console.error(`❌ Excepción al eliminar cliente en Supabase:`, err);
    return { success: false, error: err };
  }

  return { success: true };
}

/**
 * 5. REALTIME: Suscribirse a cambios en tiempo real en la tabla "clientes"
 * Escucha todos los eventos utilizando { event: '*', schema: 'public', table: 'clientes' }
 */
function suscribirClientesRealtime() {
  if (!_supabase) {
    console.warn('⚠️ Cliente Supabase no disponible para Realtime de clientes.');
    return null;
  }

  if (canalRealtimeClientes) {
    console.log('🔄 Removiendo canal Realtime de clientes previo...');
    try {
      _supabase.removeChannel(canalRealtimeClientes);
    } catch (e) {
      console.warn('Error al remover canal Realtime anterior de clientes:', e);
    }
    canalRealtimeClientes = null;
  }

  console.log('📡 Conectando canal Realtime "bugamed-clientes-realtime" para tabla "clientes"...');
  canalRealtimeClientes = _supabase
    .channel('bugamed-clientes-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'clientes' },
      payload => {
        console.log(`⚡ [Realtime Clientes] Evento recibido: [${payload.eventType}]`, payload);
        procesarEventoRealtimeClientes(payload);
      }
    )
    .subscribe((status, err) => {
      console.log('📡 Estado conexión Realtime Clientes:', status);
      if (err) console.error('❌ Error en canal Realtime Clientes:', err);
      else if (status === 'SUBSCRIBED') console.log('✓ [Realtime Clientes] Canal suscrito exitosamente (SUBSCRIBED)');
    });

  return canalRealtimeClientes;
}

/**
 * Procesa los eventos entrantes de Supabase Realtime para la tabla "clientes" (INSERT, UPDATE, DELETE).
 */
function procesarEventoRealtimeClientes(payload) {
  if (!payload) return;
  const eventType = payload.eventType;
  const nuevoRegistro = payload.new;
  const viejoRegistro = payload.old;

  let lista = (typeof window.clientes !== 'undefined' && Array.isArray(window.clientes))
    ? window.clientes
    : ((typeof clientes !== 'undefined' && Array.isArray(clientes)) ? clientes : []);

  if (eventType === 'INSERT' && nuevoRegistro) {
    const mapeado = mapearClienteDesdeSupabase(nuevoRegistro);
    const yaExiste = lista.some(c => String(c.id) === String(mapeado.id));
    if (!yaExiste) {
      lista.push(mapeado);
      clientes = lista;
      window.clientes = lista;
      if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
      refrescarVistasClientes();
      if (typeof mostrarToastLogistica === 'function') {
        mostrarToastLogistica(`⚡ Nuevo cliente en vivo: ${mapeado.nombre}`);
      }
    }
  } else if (eventType === 'UPDATE' && nuevoRegistro) {
    const mapeado = mapearClienteDesdeSupabase(nuevoRegistro);
    const idx = lista.findIndex(c => String(c.id) === String(mapeado.id) || (c.nombre && c.nombre.trim().toLowerCase() === mapeado.nombre.trim().toLowerCase()));
    if (idx !== -1) {
      lista[idx] = mapeado;
    } else {
      lista.push(mapeado);
    }
    clientes = lista;
    window.clientes = lista;
    if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
    refrescarVistasClientes();
    if (typeof mostrarToastLogistica === 'function') {
      mostrarToastLogistica(`⚡ Cliente actualizado: ${mapeado.nombre}`);
    }
  } else if (eventType === 'DELETE' && viejoRegistro) {
    const idEliminar = viejoRegistro.id;
    lista = lista.filter(c => String(c.id) !== String(idEliminar));
    clientes = lista;
    window.clientes = lista;
    if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
    refrescarVistasClientes();
    if (typeof mostrarToastLogistica === 'function') {
      mostrarToastLogistica(`🗑️ Cliente eliminado en vivo`);
    }
  }
}

/**
 * Re-renderiza dinámicamente las vistas que dependen del listado de clientes
 */
function refrescarVistasClientes() {
  try {
    if (typeof renderClientes === 'function') renderClientes();
  } catch (e) { console.warn('Aviso en renderClientes:', e); }

  try {
    if (typeof renderCheckboxesClientesRapidos === 'function') renderCheckboxesClientesRapidos();
  } catch (e) { console.warn('Aviso en renderCheckboxesClientesRapidos:', e); }

  try {
    if (typeof actualizarKPIs === 'function') actualizarKPIs();
  } catch (e) {}
}

/**
 * 6. REALTIME: Suscripción al canal de incidencias (Broadcast en vivo y Postgres Changes)
 */
function suscribirIncidenciasRealtime() {
  if (!_supabase) return null;

  if (canalRealtimeIncidencias) {
    try {
      _supabase.removeChannel(canalRealtimeIncidencias);
    } catch (e) {}
    canalRealtimeIncidencias = null;
  }

  console.log('📡 Conectando canal Realtime "bugamed-incidencias-realtime"...');
  canalRealtimeIncidencias = _supabase
    .channel('bugamed-incidencias-realtime')
    .on('broadcast', { event: 'incidencia_cambio' }, payload => {
      console.log('⚡ [Realtime Incidencias Broadcast]:', payload);
      const datosPayload = payload.payload || payload;
      const { accion, datos } = datosPayload;
      if (typeof window.procesarCambioIncidenciasRemoto === 'function') {
        window.procesarCambioIncidenciasRemoto(accion, datos);
      }
    })
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'incidencias' },
      payload => {
        console.log(`⚡ [Realtime Incidencias Postgres] Evento: [${payload.eventType}]`, payload);
        if (payload.eventType === 'INSERT' && payload.new) {
          if (typeof window.procesarCambioIncidenciasRemoto === 'function') {
            window.procesarCambioIncidenciasRemoto('NUEVA_INCIDENCIA', payload.new);
          }
        } else if (payload.eventType === 'UPDATE' && payload.new) {
          if (typeof window.procesarCambioIncidenciasRemoto === 'function') {
            window.procesarCambioIncidenciasRemoto('NUEVA_INCIDENCIA', payload.new);
          }
        }
      }
    )
    .subscribe((status, err) => {
      if (err) console.warn('Aviso canal Realtime Incidencias:', err);
      else if (status === 'SUBSCRIBED') console.log('✓ [Realtime Incidencias] Canal suscrito exitosamente (SUBSCRIBED)');
    });

  window.canalRealtimeIncidencias = canalRealtimeIncidencias;
  return canalRealtimeIncidencias;
}

/**
 * Función principal de arranque de Supabase llamada al cargar la página
 */
async function iniciarSupabaseApp() {
  if (!_supabase) {
    actualizarBadgeSupabase('desconectado', 'SDK de Supabase no inicializado');
    return;
  }

  // 1. Suscribirse inmediatamente a cambios en tiempo real en todas las tablas (REALTIME)
  suscribirRutasRealtime();
  suscribirRepostajesRealtime();
  suscribirConductoresRealtime();
  suscribirClientesRealtime();
  suscribirIncidenciasRealtime();

  // 2. Cargar las rutas, repostajes, conductores y clientes remotos desde Supabase (SELECT)
  await Promise.allSettled([
    cargarRutasDesdeSupabase(),
    cargarRepostajesDesdeSupabase(),
    cargarConductoresDesdeSupabase(),
    cargarClientesDesdeSupabase()
  ]);
}

// Exponer funciones principales en window para acceso global
window.extraerClientesDePayload = extraerClientesDePayload;
window.cargarRutasDesdeSupabase = cargarRutasDesdeSupabase;
window.insertarRutaSupabase = insertarRutaSupabase;
window.actualizarEstadoRutaSupabase = actualizarEstadoRutaSupabase;
window.finalizarRutaSupabase = finalizarRutaSupabase;
window.actualizarConductorRutaSupabase = actualizarConductorRutaSupabase;
window.actualizarNombreConductorEnRutasSupabase = actualizarNombreConductorEnRutasSupabase;
window.sincronizarCambioNombreConductorLocal = sincronizarCambioNombreConductorLocal;
window.actualizarRutaSupabase = actualizarRutaSupabase;
window.actualizarClientesRutaSupabase = actualizarClientesRutaSupabase;
window.eliminarRutaSupabase = eliminarRutaSupabase;
window.eliminarRuta = eliminarRuta;
window.suscribirRutasRealtime = suscribirRutasRealtime;
window.procesarEventoRealtime = procesarEventoRealtime;
window.iniciarSupabaseApp = iniciarSupabaseApp;
window.refrescarVistasRutas = refrescarVistasRutas;
window.asegurarConductoresDesdeRutas = asegurarConductoresDesdeRutas;
window.actualizarBadgeSupabase = actualizarBadgeSupabase;

// Exponer funciones de Repostajes en window
window.mapearRepostajeDesdeSupabase = mapearRepostajeDesdeSupabase;
window.cargarRepostajesDesdeSupabase = cargarRepostajesDesdeSupabase;
window.insertarRepostajeSupabase = insertarRepostajeSupabase;
window.eliminarRepostajeSupabase = eliminarRepostajeSupabase;
window.suscribirRepostajesRealtime = suscribirRepostajesRealtime;
window.procesarEventoRealtimeRepostajes = procesarEventoRealtimeRepostajes;
window.refrescarVistasRepostajes = refrescarVistasRepostajes;

// Exponer funciones de Conductores / Personal en window
window.mapearConductorDesdeSupabase = mapearConductorDesdeSupabase;
window.cargarConductoresDesdeSupabase = cargarConductoresDesdeSupabase;
window.migrarConductoresInicialesASupabase = migrarConductoresInicialesASupabase;
window.insertarConductorSupabase = insertarConductorSupabase;
window.actualizarConductorSupabase = actualizarConductorSupabase;
window.eliminarConductorSupabase = eliminarConductorSupabase;
window.canalRealtimeConductores = canalRealtimeConductores;
window.suscribirConductoresRealtime = suscribirConductoresRealtime;
window.procesarEventoRealtimeConductores = procesarEventoRealtimeConductores;
window.refrescarVistasConductores = refrescarVistasConductores;

// Exponer funciones de Clientes en window
window.mapearClienteDesdeSupabase = mapearClienteDesdeSupabase;
window.cargarClientesDesdeSupabase = cargarClientesDesdeSupabase;
window.migrarClientesInicialesASupabase = migrarClientesInicialesASupabase;
window.insertarClienteSupabase = insertarClienteSupabase;
window.actualizarClienteSupabase = actualizarClienteSupabase;
window.eliminarClienteSupabase = eliminarClienteSupabase;
window.canalRealtimeClientes = canalRealtimeClientes;
window.suscribirClientesRealtime = suscribirClientesRealtime;
window.procesarEventoRealtimeClientes = procesarEventoRealtimeClientes;
window.refrescarVistasClientes = refrescarVistasClientes;

// Exponer funciones de Incidencias en window
window.canalRealtimeIncidencias = canalRealtimeIncidencias;
window.suscribirIncidenciasRealtime = suscribirIncidenciasRealtime;

