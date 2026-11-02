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

/**
 * Normaliza un registro de Supabase al formato que utiliza la aplicación en memoria.
 * Mapea 'conductor' <-> 'chofer' y 'vehiculo' <-> 'camion'.
 */
function mapearRutaDesdeSupabase(r) {
  if (!r) return null;

  // Recuperar metadatos locales si existen (día y lista de clientes)
  const metaLocal = (typeof cargarStorage === 'function')
    ? (cargarStorage('bugamed_rutas_meta', {})[r.id] || {})
    : {};

  // Calcular día de la semana si no está presente en la base de datos
  const diasSemanaNombres = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const diaCalculado = r.created_at ? diasSemanaNombres[new Date(r.created_at).getDay()] : 'Lunes';
  const diaFinal = r.dia || metaLocal.dia || (diaCalculado === 'Domingo' ? 'Lunes' : diaCalculado);

  const conductorFinal = r.conductor || r.chofer || metaLocal.chofer || '';
  const vehiculoFinal = r.vehiculo || r.camion || metaLocal.camion || '';
  const clientesFinal = Array.isArray(r.clientes) ? r.clientes : (metaLocal.clientes || []);

  return {
    id: r.id,
    created_at: r.created_at,
    conductor: conductorFinal,
    chofer: conductorFinal,
    vehiculo: vehiculoFinal,
    camion: vehiculoFinal,
    estado: r.estado || 'pendiente',
    dia: diaFinal,
    clientes: clientesFinal,
    tipoCliente: r.tipoCliente || metaLocal.tipoCliente || 'Mixto'
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
    // La tabla "rutas" en Supabase cuenta con: conductor, vehiculo, estado (id y created_at autogenerados)
    const payload = {
      conductor: cond,
      vehiculo: veh,
      estado: est
    };

    const { data, error } = await _supabase
      .from('rutas')
      .insert([payload])
      .select();

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
      metaLocal[rutaCreada.id] = { dia, clientes, tipoCliente };
      localStorage.setItem('bugamed_rutas_meta', JSON.stringify(metaLocal));

      // Reemplazar tempId con el id real de Supabase
      const index = rutas.findIndex(r => r.id === tempId);
      if (index !== -1) {
        rutas[index] = mapearRutaDesdeSupabase(rutaCreada);
        rutas[index].dia = dia;
        rutas[index].clientes = clientes;
        rutas[index].tipoCliente = tipoCliente;
        window.rutas = rutas;
        if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
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
 * 4. DELETE: Eliminar una ruta de Supabase
 */
async function eliminarRutaSupabase(id) {
  if (!id) return;

  // Limpiar metadatos locales
  const metaLocal = (typeof cargarStorage === 'function') ? cargarStorage('bugamed_rutas_meta', {}) : {};
  if (metaLocal[id]) {
    delete metaLocal[id];
    localStorage.setItem('bugamed_rutas_meta', JSON.stringify(metaLocal));
  }

  if (!_supabase) return;

  if (String(id).startsWith('temp_') || String(id).startsWith('ruta_init_')) {
    return;
  }

  try {
    const { error } = await _supabase
      .from('rutas')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`Error eliminando ruta ${id} en Supabase:`, error.message);
      return;
    }

    console.log(`✓ Ruta ${id} eliminada correctamente de Supabase.`);
  } catch (err) {
    console.error('Excepción al eliminar ruta en Supabase:', err);
  }
}

/**
 * 5. REALTIME: Suscribirse a cambios en tiempo real en la tabla "rutas"
 */
function suscribirRutasRealtime() {
  if (!_supabase) return;

  if (canalRealtimeRutas) {
    _supabase.removeChannel(canalRealtimeRutas);
  }

  canalRealtimeRutas = _supabase
    .channel('bugamed-rutas-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rutas' },
      (payload) => {
        procesarEventoRealtime(payload);
      }
    )
    .subscribe((status) => {
      console.log('📡 Estado de conexión Realtime Supabase:', status);
      if (status === 'SUBSCRIBED') {
        actualizarBadgeSupabase('conectado');
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        actualizarBadgeSupabase('desconectado');
      }
    });
}

/**
 * Procesa los eventos entrantes de Supabase Realtime (INSERT, UPDATE, DELETE)
 */
function procesarEventoRealtime(payload) {
  console.log('⚡ Evento en tiempo real recibido de Supabase:', payload.eventType, payload);

  const { eventType, new: nuevoRegistro, old: viejoRegistro } = payload;

  if (eventType === 'INSERT') {
    const yaExiste = rutas.some(r => String(r.id) === String(nuevoRegistro.id));
    if (!yaExiste) {
      const rutaMapeada = mapearRutaDesdeSupabase(nuevoRegistro);
      rutas.unshift(rutaMapeada);
      window.rutas = rutas;
      if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
      refrescarVistasRutas();

      if (typeof mostrarToastLogistica === 'function') {
        mostrarToastLogistica(`⚡ Nueva ruta sincronizada: ${rutaMapeada.chofer} (${rutaMapeada.camion})`);
      }
    }
  } else if (eventType === 'UPDATE') {
    const index = rutas.findIndex(r => String(r.id) === String(nuevoRegistro.id));
    if (index !== -1) {
      const estadoAnterior = rutas[index].estado;
      rutas[index].estado = nuevoRegistro.estado;
      rutas[index].conductor = nuevoRegistro.conductor;
      rutas[index].chofer = nuevoRegistro.conductor;
      rutas[index].vehiculo = nuevoRegistro.vehiculo;
      rutas[index].camion = nuevoRegistro.vehiculo;

      // Sincronizar estado de servicio en vivo si otro usuario inició o completó la ruta
      sincronizarServicioActivoDesdeRealtime(nuevoRegistro, rutas[index]);

      window.rutas = rutas;
      if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
      refrescarVistasRutas();

      if (estadoAnterior !== nuevoRegistro.estado && typeof mostrarToastLogistica === 'function') {
        mostrarToastLogistica(`⚡ Ruta de ${rutas[index].chofer} cambió a: "${nuevoRegistro.estado}"`);
      }
    } else {
      rutas.unshift(mapearRutaDesdeSupabase(nuevoRegistro));
      window.rutas = rutas;
      if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
      refrescarVistasRutas();
    }
  } else if (eventType === 'DELETE') {
    const idEliminar = viejoRegistro?.id;
    if (idEliminar) {
      const antes = rutas.length;
      rutas = rutas.filter(r => String(r.id) !== String(idEliminar));
      if (rutas.length !== antes) {
        window.rutas = rutas;
        if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
        refrescarVistasRutas();
        if (typeof mostrarToastLogistica === 'function') {
          mostrarToastLogistica(`⚡ Una ruta fue eliminada.`);
        }
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
 * Refresca todas las interfaces dependientes de rutas en la app
 */
function refrescarVistasRutas() {
  if (typeof renderDiasSemana === 'function') renderDiasSemana();
  if (typeof renderGridChoferesAsignacion === 'function') renderGridChoferesAsignacion();
  if (typeof renderVisualizacionRutasChoferes === 'function') renderVisualizacionRutasChoferes();
  if (typeof actualizarListadoRutasParaInicio === 'function') actualizarListadoRutasParaInicio();
  if (typeof actualizarEstadoFichajeInterfaz === 'function') actualizarEstadoFichajeInterfaz();
  if (typeof renderChoferes === 'function') renderChoferes();
  if (typeof renderCamiones === 'function') renderCamiones();
  if (typeof actualizarKPIs === 'function') actualizarKPIs();
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

/**
 * Función principal de arranque de Supabase llamada al cargar la página
 */
async function iniciarSupabaseApp() {
  if (!_supabase) {
    actualizarBadgeSupabase('desconectado', 'SDK de Supabase no inicializado');
    return;
  }

  // 1. Cargar las rutas remotas desde Supabase (SELECT)
  await cargarRutasDesdeSupabase();

  // 2. Suscribirse a cambios en tiempo real (REALTIME)
  suscribirRutasRealtime();
}

// Exponer funciones principales en window para acceso global
window.cargarRutasDesdeSupabase = cargarRutasDesdeSupabase;
window.insertarRutaSupabase = insertarRutaSupabase;
window.actualizarEstadoRutaSupabase = actualizarEstadoRutaSupabase;
window.eliminarRutaSupabase = eliminarRutaSupabase;
window.suscribirRutasRealtime = suscribirRutasRealtime;
window.iniciarSupabaseApp = iniciarSupabaseApp;
window.refrescarVistasRutas = refrescarVistasRutas;
window.actualizarBadgeSupabase = actualizarBadgeSupabase;

