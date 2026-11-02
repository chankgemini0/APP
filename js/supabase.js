/* ==========================================================================
   CONFIGURACIÓN Y CLIENTE GLOBAL DE SUPABASE - BUGAMED
   Sincronización en Tiempo Real de la tabla "rutas"
   ========================================================================== */

const SUPABASE_URL = 'https://zhkmkexcnnenlbpmlmqs.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_B4Hyksen3_nd3PAiDuWmRQ_17hDGNVq';

// Inicialización del cliente global de Supabase
let _supabase = null;
try {
  if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
    _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    });
    console.log('✓ Cliente global _supabase inicializado correctamente.');
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

  return {
    id: r.id,
    created_at: r.created_at || rutaExistente?.created_at || new Date().toISOString(),
    conductor: conductorFinal,
    chofer: conductorFinal,
    vehiculo: vehiculoFinal,
    camion: vehiculoFinal,
    estado: r.estado || rutaExistente?.estado || 'pendiente',
    dia: diaFinal,
    clientes: clientesFinal,
    tipoCliente: r.tipoCliente || metaLocal.tipoCliente || rutaExistente?.tipoCliente || 'Mixto'
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
 * 3.1. UPDATE CONDUCTOR: Actualizar el conductor de una ruta en Supabase y de forma optimista
 */
async function actualizarConductorRutaSupabase(id, nuevoConductor) {
  if (!id || !nuevoConductor) return null;
  return actualizarRutaSupabase(id, { conductor: nuevoConductor });
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
 * Escucha todos los eventos utilizando { event: '*', schema: 'public', table: 'rutas' }
 * gestionando INSERT, UPDATE y DELETE de forma reactiva.
 */
function suscribirRutasRealtime() {
  if (!_supabase) {
    console.warn('⚠️ Cliente Supabase no disponible para Realtime.');
    return;
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

  console.log('📡 Conectando canal Realtime "bugamed-rutas-realtime" para tabla "rutas" con { event: "*" }...');

  canalRealtimeRutas = _supabase
    .channel('bugamed-rutas-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rutas' },
      (payload) => {
        console.log(`⚡ [Realtime postgres_changes] Evento recibido: [${payload.eventType}]`, payload);
        procesarEventoRealtime(payload);
      }
    )
    .subscribe((status, err) => {
      console.log('📡 Estado de conexión Realtime Supabase:', status);
      if (err) {
        console.error('❌ Error en canal Realtime Supabase:', err);
      }
      if (status === 'SUBSCRIBED') {
        actualizarBadgeSupabase('conectado');
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        actualizarBadgeSupabase('desconectado');
      }
    });
}

/**
 * Procesa los eventos entrantes de Supabase Realtime (INSERT, UPDATE, DELETE).
 * - 'INSERT': añade el nuevo payload.new al array local de rutas.
 * - 'UPDATE': actualiza el registro existente buscando por su id con payload.new.
 * - 'DELETE': elimina el registro del array local buscando por payload.old.id.
 * Vuelve a renderizar la pantalla dinámicamente cada vez que ocurre cualquiera de estos eventos.
 */
function procesarEventoRealtime(payload) {
  if (!payload) return;

  const eventType = (payload.eventType || payload.type || '').toUpperCase();
  const nuevoRegistro = payload.new;
  const viejoRegistro = payload.old;

  console.log(`⚡ Procesando evento Realtime [${eventType}] en tabla "rutas":`, {
    nuevo: nuevoRegistro,
    viejo: viejoRegistro
  });

  if (eventType === 'INSERT') {
    if (!nuevoRegistro || !nuevoRegistro.id) {
      console.warn('⚠️ Evento INSERT recibido sin payload.new válido:', payload);
      return;
    }

    const nuevoId = String(nuevoRegistro.id);
    const rutaMapeada = mapearRutaDesdeSupabase(nuevoRegistro);

    // Extraer clientes explícitamente desde payload.new.clientes
    const clientesNuevos = extraerClientesDePayload(nuevoRegistro.clientes);
    if (clientesNuevos !== null) {
      rutaMapeada.clientes = clientesNuevos;
    }

    // 1. Comprobar si reemplaza una ruta temporal optimista pendiente
    const tempIndex = rutas.findIndex(r => 
      String(r.id).startsWith('temp_') && 
      ((r.conductor && r.conductor === rutaMapeada.conductor) || (r.chofer && r.chofer === rutaMapeada.conductor))
    );

    // 2. Comprobar si ya existe por ID
    const indexExistente = rutas.findIndex(r => String(r.id) === nuevoId);

    if (tempIndex !== -1) {
      rutas[tempIndex] = {
        ...rutas[tempIndex],
        ...rutaMapeada,
        id: nuevoRegistro.id
      };
      console.log(`✓ Ruta temporal local confirmada con ID de Supabase: ${nuevoRegistro.id}`);
    } else if (indexExistente !== -1) {
      rutas[indexExistente] = {
        ...rutas[indexExistente],
        ...rutaMapeada
      };
      console.log(`✓ Ruta existente ${nuevoId} actualizada tras INSERT`);
    } else {
      // Añadir el nuevo payload.new al array local de rutas
      rutas.unshift(rutaMapeada);
      console.log(`✓ Nueva ruta agregada en tiempo real. Conductor: "${rutaMapeada.conductor}" con ${rutaMapeada.clientes.length} clientes`);
    }

    // Sincronizar metadatos locales
    const metaLocal = (typeof cargarStorage === 'function') ? cargarStorage('bugamed_rutas_meta', {}) : {};
    metaLocal[nuevoId] = {
      dia: rutaMapeada.dia,
      clientes: rutaMapeada.clientes,
      tipoCliente: rutaMapeada.tipoCliente
    };
    try { localStorage.setItem('bugamed_rutas_meta', JSON.stringify(metaLocal)); } catch (e) {}

    // Registrar el conductor si no existe localmente para que se visualice
    asegurarConductoresDesdeRutas();

    window.rutas = rutas;
    if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();

    // Re-renderizado dinámico de la interfaz
    refrescarVistasRutas();

    if (typeof mostrarToastLogistica === 'function') {
      const nombreChof = rutaMapeada.conductor || rutaMapeada.chofer || 'Conductor';
      mostrarToastLogistica(`⚡ Nueva ruta sincronizada para: ${nombreChof} (${rutaMapeada.clientes.length} paradas)`);
    }
  } else if (eventType === 'UPDATE') {
    if (!nuevoRegistro || !nuevoRegistro.id) {
      console.warn('⚠️ Evento UPDATE recibido sin payload.new válido:', payload);
      return;
    }

    const nuevoId = String(nuevoRegistro.id);
    const index = rutas.findIndex(r => String(r.id) === nuevoId);
    const rutaMapeada = mapearRutaDesdeSupabase(nuevoRegistro);

    // Extraer la columna "clientes" explícitamente desde payload.new
    const clientesNuevos = extraerClientesDePayload(nuevoRegistro.clientes);

    if (index !== -1) {
      const rutaAnterior = { ...rutas[index] };
      const conductorAnterior = rutaAnterior.conductor || rutaAnterior.chofer || '';
      const nuevoConductor = rutaMapeada.conductor || nuevoRegistro.conductor || nuevoRegistro.chofer || conductorAnterior;
      const estadoAnterior = rutaAnterior.estado;
      const clientesAnteriores = rutaAnterior.clientes || [];

      // Si vinieron clientes en payload.new (incluso si es un array vacío []), aplicarlos directamente
      const clientesActualizados = clientesNuevos !== null
        ? clientesNuevos
        : (rutaMapeada.clientes !== undefined ? rutaMapeada.clientes : clientesAnteriores);

      console.log(`🔄 Actualizando ruta ${nuevoId} localmente. Conductor: "${conductorAnterior}" -> "${nuevoConductor}", Clientes: ${clientesAnteriores.length} -> ${clientesActualizados.length}`);

      // Actualizar el registro existente buscando por su id con payload.new
      rutas[index] = {
        ...rutas[index],
        ...rutaMapeada,
        conductor: nuevoConductor,
        chofer: nuevoConductor,
        vehiculo: rutaMapeada.vehiculo || nuevoRegistro.vehiculo || nuevoRegistro.camion || rutas[index].vehiculo,
        camion: rutaMapeada.camion || nuevoRegistro.vehiculo || nuevoRegistro.camion || rutas[index].camion,
        estado: nuevoRegistro.estado !== undefined ? nuevoRegistro.estado : rutas[index].estado,
        dia: rutaMapeada.dia || rutas[index].dia,
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
      if (conductorAnterior && conductorAnterior !== nuevoConductor) {
        if (typeof serviciosActivos !== 'undefined' && serviciosActivos[conductorAnterior]?.rutaId === nuevoRegistro.id) {
          delete serviciosActivos[conductorAnterior];
          console.log(`🧹 Servicio activo desvinculado del conductor anterior: ${conductorAnterior}`);
        }
      }

      // Sincronizar clientes también en el servicio activo en tiempo real si el chofer está en ruta
      if (typeof serviciosActivos !== 'undefined') {
        const conductorActivo = nuevoConductor || conductorAnterior;
        if (serviciosActivos[conductorActivo] && String(serviciosActivos[conductorActivo].rutaId) === nuevoId) {
          serviciosActivos[conductorActivo].clientes = [...clientesActualizados];
        }
      }

      // Sincronizar estado de servicio en vivo si otro usuario inició o completó la ruta
      sincronizarServicioActivoDesdeRealtime(nuevoRegistro, rutas[index]);

      // Si la ruta cambió su estado a completada o finalizada, registrarla en Historial
      if (nuevoRegistro.estado === 'completada' || nuevoRegistro.estado === 'finalizada') {
        if (typeof registrarRutaEnHistorial === 'function') {
          registrarRutaEnHistorial(rutas[index]);
        }
      }

      // Asegurar que el conductor nuevo/actualizado exista en la lista local de choferes
      asegurarConductoresDesdeRutas();

      window.rutas = rutas;
      if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();

      // Re-renderizado dinámico de la interfaz
      refrescarVistasRutas();

      if (typeof mostrarToastLogistica === 'function') {
        if (conductorAnterior && conductorAnterior !== nuevoConductor) {
          mostrarToastLogistica(`⚡ Ruta reasignada: Conductor cambiado a "${nuevoConductor}"`);
        } else if (estadoAnterior !== nuevoRegistro.estado) {
          mostrarToastLogistica(`⚡ Ruta de ${nuevoConductor} cambió a: "${nuevoRegistro.estado}"`);
        } else if (clientesNuevos !== null && clientesNuevos.length !== clientesAnteriores.length) {
          mostrarToastLogistica(`⚡ Clientes actualizados en ruta de ${nuevoConductor} (${clientesActualizados.length} paradas)`);
        }
      }
    } else {
      // Si la ruta no estaba en la lista local de este dispositivo, agregarla
      if (clientesNuevos !== null) {
        rutaMapeada.clientes = clientesNuevos;
      }
      rutas.unshift(rutaMapeada);
      if (nuevoRegistro.estado === 'completada' || nuevoRegistro.estado === 'finalizada') {
        if (typeof registrarRutaEnHistorial === 'function') {
          registrarRutaEnHistorial(rutaMapeada);
        }
      }
      asegurarConductoresDesdeRutas();
      window.rutas = rutas;
      if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();

      // Re-renderizado dinámico de la interfaz
      refrescarVistasRutas();
      console.log(`✓ Ruta incorporada tras UPDATE con conductor: "${rutaMapeada.conductor}" (${rutaMapeada.clientes.length} clientes)`);
    }
  } else if (eventType === 'DELETE') {
    // Eliminar el registro del array local buscando por payload.old.id (o variantes del payload)
    const idEliminar = viejoRegistro?.id ?? payload.old_record?.id ?? payload.id;
    console.log(`🗑️ Procesando evento Realtime DELETE para ID:`, idEliminar);

    if (idEliminar) {
      const antes = rutas.length;
      rutas = rutas.filter(r => String(r.id) !== String(idEliminar));

      // Limpiar metadatos locales asociados
      const metaLocal = (typeof cargarStorage === 'function') ? cargarStorage('bugamed_rutas_meta', {}) : {};
      if (metaLocal[idEliminar]) {
        delete metaLocal[idEliminar];
        try { localStorage.setItem('bugamed_rutas_meta', JSON.stringify(metaLocal)); } catch (e) {}
      }

      if (rutas.length !== antes) {
        console.log(`✓ Ruta ${idEliminar} eliminada localmente tras evento DELETE de Supabase.`);
      }

      window.rutas = rutas;
      if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();

      // Re-renderizado dinámico de la interfaz
      refrescarVistasRutas();

      if (typeof mostrarToastLogistica === 'function') {
        mostrarToastLogistica(`⚡ Una ruta fue eliminada.`);
      }
    } else {
      console.warn('⚠️ Evento DELETE recibido pero payload.old no contiene id. Verifica REPLICA IDENTITY FULL en la tabla rutas.');
    }
  }
}

/**
 * Garantiza que cualquier conductor registrado en la columna "conductor" de la tabla "rutas"
 * exista también en la lista de conductores en memoria (choferes) de cada dispositivo.
 * Esto asegura que renderGridChoferesAsignacion, renderVisualizacionRutasChoferes y otros
 * selectores puedan renderizar la tarjeta y las rutas del nuevo conductor automáticamente.
 */
function asegurarConductoresDesdeRutas() {
  if (typeof rutas === 'undefined' || !Array.isArray(rutas) || typeof choferes === 'undefined' || !Array.isArray(choferes)) {
    return;
  }

  let modificado = false;
  rutas.forEach(r => {
    const nombre = (r.conductor || r.chofer || '').trim();
    if (!nombre || nombre === 'Sin conductor' || nombre === 'General') return;

    const existe = choferes.some(ch => ch.nombre && ch.nombre.trim().toLowerCase() === nombre.toLowerCase());
    if (!existe) {
      console.log(`👤 Conductor "${nombre}" detectado en tabla "rutas". Agregando automáticamente a la lista local de choferes.`);
      choferes.push({
        nombre: nombre,
        dni: 'Registrado en ruta',
        telefono: '',
        foto: ''
      });
      modificado = true;
    }
  });

  if (modificado) {
    if (typeof guardarDatosEnLocal === 'function') {
      try {
        localStorage.setItem('bugamed_choferes', JSON.stringify(choferes));
      } catch (e) {
        console.warn('Error guardando choferes:', e);
      }
    }
  }
}

/**
 * Sincroniza la visualización de camiones y servicios activos en la oficina
 * cuando un chofer cambia el estado de su ruta en ruta.
 */
function sincronizarServicioActivoDesdeRealtime(nuevoRegistro, rutaLocal) {
  const choferNombre = nuevoRegistro.conductor;
  const vehiculoMat = nuevoRegistro.vehiculo;

  if (nuevoRegistro.estado === 'en_curso') {
    if (typeof serviciosActivos !== 'undefined' && !serviciosActivos[choferNombre]) {
      serviciosActivos[choferNombre] = {
        chofer: choferNombre,
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
      if (cam) cam.estado = `Ocupado por ${choferNombre}`;
    }
  } else if (nuevoRegistro.estado === 'completada' || nuevoRegistro.estado === 'finalizada') {
    if (typeof serviciosActivos !== 'undefined' && serviciosActivos[choferNombre]) {
      delete serviciosActivos[choferNombre];
    }
    if (typeof camiones !== 'undefined') {
      const cam = camiones.find(v => v.matricula === vehiculoMat);
      if (cam) cam.estado = 'Libre';
    }
  }
}

/**
 * Refresca todas las interfaces dependientes de rutas en la app en tiempo real
 */
function refrescarVistasRutas() {
  try {
    if (typeof asegurarConductoresDesdeRutas === 'function') asegurarConductoresDesdeRutas();
  } catch (e) { console.warn('Aviso al sincronizar conductores:', e); }

  try {
    if (typeof renderDiasSemana === 'function') renderDiasSemana();
    if (typeof renderGridChoferesAsignacion === 'function') renderGridChoferesAsignacion();
  } catch (e) { console.warn('Aviso en renderGridChoferesAsignacion:', e); }

  try {
    if (typeof renderVisualizacionRutasChoferes === 'function') renderVisualizacionRutasChoferes();
    if (typeof actualizarSelectPortalChoferes === 'function') actualizarSelectPortalChoferes();
  } catch (e) { console.warn('Aviso en renderVisualizacionRutasChoferes:', e); }

  try {
    if (typeof actualizarListadoRutasParaInicio === 'function') actualizarListadoRutasParaInicio();
    if (typeof actualizarEstadoFichajeInterfaz === 'function') actualizarEstadoFichajeInterfaz();
    if (typeof renderModuloLogistica === 'function') renderModuloLogistica();
  } catch (e) { console.warn('Aviso en renderModuloLogistica:', e); }

  try {
    const inputChofer = document.getElementById('fichaje-chofer-input');
    if (inputChofer && inputChofer.value && typeof actualizarSelectorRutasParaChoferInicio === 'function') {
      actualizarSelectorRutasParaChoferInicio(inputChofer.value);
    }
  } catch (e) {}

  try {
    if (typeof renderChoferes === 'function') renderChoferes();
    if (typeof renderCamiones === 'function') renderCamiones();
  } catch (e) {}

  try {
    if (typeof renderHistorialChoferesGrid === 'function') renderHistorialChoferesGrid();
    if (typeof verDetalleHistorialChofer === 'function' && window.choferSeleccionadoActual) {
      const panelHistorial = document.getElementById('panel-detalle-historial-chofer');
      if (panelHistorial && !panelHistorial.classList.contains('hidden')) {
        verDetalleHistorialChofer(window.choferSeleccionadoActual);
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
  return {
    id: r.id,
    created_at: r.created_at || new Date().toISOString(),
    fecha: fechaStr,
    camion: r.camion || r.vehiculo || '',
    chofer: (r.chofer || r.conductor || 'General').trim() || 'General',
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
      chofer: r.chofer || 'General',
      litros: parseFloat(r.litros || 0) || 0,
      euros: parseFloat(r.euros || 0) || 0,
      km: r.km ? (parseFloat(r.km) || null) : null,
      adblue: r.adblue ? (parseFloat(r.adblue) || null) : null,
      tipo: r.tipo || 'Gasoil'
    }));

    const { data, error } = await _supabase
      .from('repostajes')
      .insert(filasParaInsertar)
      .select();

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
async function insertarRepostajeSupabase({ fecha, camion, chofer, litros, euros, km, adblue, tipo = 'Gasoil' }) {
  const f = fecha || new Date().toISOString().split('T')[0];
  const cam = (camion || '').trim();
  const ch = (chofer || '').trim() || 'General';
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
    chofer: ch,
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
    const payload = {
      fecha: f,
      camion: cam,
      chofer: ch,
      litros: parseFloat(lit) || 0,
      euros: parseFloat(eur) || 0,
      km: k ? (parseFloat(k) || null) : null,
      adblue: adb ? (parseFloat(adb) || null) : null,
      tipo: tip
    };

    console.log('🚀 Insertando repostaje asíncrono en Supabase:', payload);

    let { data, error } = await _supabase
      .from('repostajes')
      .insert([payload])
      .select();

    // Si falló por alguna columna opcional inexistente en Postgres (código 42703), reintentar con campos base
    if (error && (error.code === '42703' || (error.message && (error.message.includes('adblue') || error.message.includes('tipo') || error.message.includes('km'))))) {
      console.warn('⚠️ Columnas opcionales no detectadas en tabla "repostajes". Reintentando con esquema mínimo...');
      const payloadMin = {
        fecha: f,
        camion: cam,
        chofer: ch,
        litros: parseFloat(lit) || 0,
        euros: parseFloat(eur) || 0
      };
      const retry = await _supabase.from('repostajes').insert([payloadMin]).select();
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
    return;
  }

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
    });
}

/**
 * Procesa los eventos entrantes de Supabase Realtime para la tabla "repostajes" (INSERT, UPDATE, DELETE).
 * Actualiza el array local de repostajes y vuelve a dibujar la interfaz en todos los dispositivos conectados.
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

  if (typeof repostajes === 'undefined' || !Array.isArray(repostajes)) {
    window.repostajes = window.repostajes || [];
    repostajes = window.repostajes;
  }

  if (eventType === 'INSERT') {
    if (!nuevoRegistro || !nuevoRegistro.id) return;

    const mapeado = mapearRepostajeDesdeSupabase(nuevoRegistro);
    const nuevoId = String(nuevoRegistro.id);

    // 1. Comprobar si reemplaza un registro optimista local pendiente
    const tempIndex = repostajes.findIndex(r => 
      String(r.id).startsWith('temp_rep_') &&
      r.camion === mapeado.camion &&
      r.chofer === mapeado.chofer &&
      Math.abs(parseFloat(r.litros || 0) - parseFloat(mapeado.litros || 0)) < 0.01
    );

    // 2. Comprobar si ya existe por ID
    const indexExistente = repostajes.findIndex(r => String(r.id) === nuevoId);

    if (tempIndex !== -1) {
      repostajes[tempIndex] = mapeado;
      console.log(`✓ Repostaje temporal local confirmado con ID Supabase: ${nuevoId}`);
    } else if (indexExistente !== -1) {
      repostajes[indexExistente] = mapeado;
      console.log(`✓ Repostaje existente ${nuevoId} actualizado tras INSERT`);
    } else {
      repostajes.unshift(mapeado);
      console.log(`✓ Nuevo repostaje recibido en tiempo real: ${mapeado.camion} (${mapeado.litros}L) por ${mapeado.chofer}`);
      if (typeof mostrarToastLogistica === 'function') {
        mostrarToastLogistica(`⛽ Nuevo repostaje: ${mapeado.camion} - ${mapeado.litros}L (${mapeado.chofer})`);
      }
    }

    window.repostajes = repostajes;
    if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
    refrescarVistasRepostajes();

  } else if (eventType === 'UPDATE') {
    if (!nuevoRegistro || !nuevoRegistro.id) return;
    const nuevoId = String(nuevoRegistro.id);
    const index = repostajes.findIndex(r => String(r.id) === nuevoId);
    const mapeado = mapearRepostajeDesdeSupabase(nuevoRegistro);

    if (index !== -1) {
      repostajes[index] = mapeado;
      console.log(`✓ Repostaje ${nuevoId} actualizado en tiempo real.`);
    } else {
      repostajes.unshift(mapeado);
    }

    window.repostajes = repostajes;
    if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
    refrescarVistasRepostajes();

  } else if (eventType === 'DELETE') {
    const idEliminar = viejoRegistro?.id ?? payload.old_record?.id ?? payload.id;
    console.log(`🗑️ Evento DELETE Realtime en repostajes para ID:`, idEliminar);

    if (idEliminar) {
      const antes = repostajes.length;
      repostajes = repostajes.filter(r => String(r.id) !== String(idEliminar));
      if (repostajes.length !== antes) {
        console.log(`✓ Repostaje ${idEliminar} eliminado localmente tras evento DELETE de Supabase.`);
      }
      window.repostajes = repostajes;
      if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
      refrescarVistasRepostajes();
      if (typeof mostrarToastLogistica === 'function') {
        mostrarToastLogistica('⚡ Un registro de repostaje fue eliminado.');
      }
    }
  }
}

/**
 * Re-renderiza dinámicamente todas las vistas de repostajes en la interfaz (panel admin, lista y detalle de chofer)
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
    if (typeof verDetalleHistorialChofer === 'function' && window.choferSeleccionadoActual) {
      const panelHistorial = document.getElementById('panel-detalle-historial-chofer');
      if (panelHistorial && !panelHistorial.classList.contains('hidden')) {
        verDetalleHistorialChofer(window.choferSeleccionadoActual);
      }
    }
  } catch (e) {
    console.warn('Aviso al refrescar historial de repostajes del chofer:', e);
  }
}

/**
 * Función principal de arranque de Supabase llamada al cargar la página
 */
async function iniciarSupabaseApp() {
  if (!_supabase) {
    actualizarBadgeSupabase('desconectado', 'SDK de Supabase no inicializado');
    return;
  }

  // 1. Cargar las rutas y repostajes remotos desde Supabase (SELECT)
  await Promise.allSettled([
    cargarRutasDesdeSupabase(),
    cargarRepostajesDesdeSupabase()
  ]);

  // 2. Suscribirse a cambios en tiempo real en ambas tablas (REALTIME)
  suscribirRutasRealtime();
  suscribirRepostajesRealtime();
}

// Exponer funciones principales en window para acceso global
window.extraerClientesDePayload = extraerClientesDePayload;
window.cargarRutasDesdeSupabase = cargarRutasDesdeSupabase;
window.insertarRutaSupabase = insertarRutaSupabase;
window.actualizarEstadoRutaSupabase = actualizarEstadoRutaSupabase;
window.actualizarConductorRutaSupabase = actualizarConductorRutaSupabase;
window.actualizarRutaSupabase = actualizarRutaSupabase;
window.actualizarClientesRutaSupabase = actualizarClientesRutaSupabase;
window.eliminarRutaSupabase = eliminarRutaSupabase;
window.eliminarRuta = eliminarRuta;
window.suscribirRutasRealtime = suscribirRutasRealtime;
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

