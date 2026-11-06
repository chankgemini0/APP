// Recuperación limpia de datos del almacenamiento local
function cargarStorage(clave, valorPorDefecto) {
  try {
    const datos = localStorage.getItem(clave);
    return datos ? JSON.parse(datos) : valorPorDefecto;
  } catch (error) {
    console.error(`Error cargando ${clave}:`, error);
    return valorPorDefecto;
  }
}

function esFotoValida(url) {
  if (!url || typeof url !== 'string') return false;
  const s = url.trim();
  if (!s || s === 'undefined' || s === 'null' || s === '[object Object]') return false;

  // 1. Data URLs base64 válidas (ej: fotos subidas desde archivo)
  if (s.startsWith('data:image/')) return true;

  // 2. URLs de Blob local
  if (s.startsWith('blob:')) return true;

  // 3. URLs web completas http:// o https://
  if (/^https?:\/\//i.test(s)) {
    try {
      new URL(s);
      return true;
    } catch (e) {
      return false;
    }
  }

  // 4. Archivos locales estáticos conocidos del proyecto
  const archivosLocalesValidos = [
    'bugamed_horizontal_cian-1-tinta.jpg',
    'camion pequeño.webp',
    'grande.webp',
    'css/bugamed_icono_cian-1-tinta.jpg',
    'bugamed_icono_cian-1-tinta.jpg'
  ];
  const nombreLimpio = s.replace(/^\.?\/+/, '').toLowerCase();
  if (archivosLocalesValidos.includes(nombreLimpio)) return true;

  // 5. Rutas relativas explícitas con prefijo de carpeta conocido y extensión de imagen
  const tieneExtension = /\.(jpe?g|png|webp|gif|svg|avif|ico)($|\?)/i.test(s);
  if (tieneExtension && (s.startsWith('./') || s.startsWith('/') || s.startsWith('assets/') || s.startsWith('img/') || s.startsWith('images/'))) {
    return true;
  }

  return false;
}
window.esFotoValida = esFotoValida;

function sanitizarConductoresStorage(lista) {
  if (!Array.isArray(lista)) return lista;
  let modificado = false;
  const limpia = lista.map((ch, idx) => {
    if (!ch) return ch;
    if (!ch.id && ch.id !== 0) {
      ch.id = idx + 1;
      modificado = true;
    }
    if (ch && ch.foto && !esFotoValida(ch.foto)) {
      ch.foto = '';
      modificado = true;
    }
    return ch;
  });
  if (modificado) {
    try {
      localStorage.setItem('bugamed_conductores', JSON.stringify(limpia));
      localStorage.setItem('bugamed_choferes', JSON.stringify(limpia));
    } catch (e) {
      console.warn('Error al guardar conductores saneados:', e);
    }
  }
  return limpia;
}
window.sanitizarConductoresStorage = sanitizarConductoresStorage;
window.sanitizarChoferesStorage = sanitizarConductoresStorage;

function sanitizarCamionesStorage(lista) {
  if (!Array.isArray(lista)) return lista;
  let modificado = false;
  const limpia = lista.map(c => {
    if (!c) return c;
    if (c.foto && !esFotoValida(c.foto)) {
      c.foto = '';
      modificado = true;
    }
    return c;
  });
  if (modificado) {
    try {
      localStorage.setItem('bugamed_camiones', JSON.stringify(limpia));
    } catch (e) {}
  }
  return limpia;
}
window.sanitizarCamionesStorage = sanitizarCamionesStorage;

// Variables Globales de Datos
let camiones = sanitizarCamionesStorage(cargarStorage('bugamed_camiones', [
  { matricula: '4589-KLL', modelo: 'Iveco Daily 35-160', tipo: 'Pequeño', estado: 'Libre', foto: '' },
  { matricula: '8912-MBN', modelo: 'Iveco Stralis 360 E6', tipo: 'Grande', estado: 'Libre', foto: '' }
]));

let conductores = sanitizarConductoresStorage(cargarStorage('bugamed_conductores', cargarStorage('bugamed_choferes', [
  { id: 1, nombre: 'Antonio Fernández', dni: '44556677A', telefono: '+34 612 987 654', foto: '' },
  { id: 2, nombre: 'David Morales', dni: '88776655B', telefono: '+34 655 443 322', foto: '' }
])));
let choferes = conductores;
window.conductores = conductores;
window.choferes = conductores;

let clientes = cargarStorage('bugamed_clientes', [
  { nombre: 'Hotel Meliá Palma', zona: 'Tarragona', tipo: 'Hotel', direccion: 'Passeig Marítim 12', telefono: '+34 971 111 222', ubicacion: 'https://www.google.com/maps/search/?api=1&query=Hotel+Melia+Palma+Passeig+Maritim+12+Tarragona' },
  { nombre: 'Hotel Salou Sun', zona: 'Salou', tipo: 'Hotel', direccion: 'Av. Diputació 45', telefono: '+34 977 222 333', ubicacion: 'https://www.google.com/maps/search/?api=1&query=Hotel+Salou+Sun+Av+Diputacio+45+Salou' },
  { nombre: 'Restaurante Cambrils Port', zona: 'Cambrils', tipo: 'Restaurante', direccion: 'Puerto Deportivo 8', telefono: '+34 977 444 555', ubicacion: 'https://www.google.com/maps/search/?api=1&query=Restaurante+Cambrils+Port+Puerto+Deportivo+8+Cambrils' },
  { nombre: 'Camping Estanyet', zona: 'Alcanar', tipo: 'Camping', direccion: 'Playa Vinaròs km 3', telefono: '+34 977 722 111', ubicacion: 'https://www.google.com/maps/search/?api=1&query=Camping+Estanyet+Alcanar' }
]);
window.clientes = clientes;

let rutas = cargarStorage('bugamed_rutas', [
  { id: 'ruta_init_1', dia: 'Lunes', tipoCliente: 'Hotel', conductor: 'Antonio Fernández', chofer: 'Antonio Fernández', camion: '8912-MBN', vehiculo: '8912-MBN', clientes: ['Hotel Meliá Palma', 'Hotel Salou Sun'], estado: 'pendiente' },
  { id: 'ruta_init_2', dia: 'Lunes', tipoCliente: 'Restaurante', conductor: 'Antonio Fernández', chofer: 'Antonio Fernández', camion: '8912-MBN', vehiculo: '8912-MBN', clientes: ['Restaurante Cambrils Port'], estado: 'pendiente' },
  { id: 'ruta_init_3', dia: 'Martes', tipoCliente: 'Restaurante', conductor: 'David Morales', chofer: 'David Morales', camion: '4589-KLL', vehiculo: '4589-KLL', clientes: ['Restaurante Cambrils Port'], estado: 'pendiente' }
]);
window.rutas = rutas;

function asegurarEstadoRutas() {
  if (typeof rutas !== 'undefined' && Array.isArray(rutas)) {
    let modificado = false;
    rutas.forEach((r, idx) => {
      if (!r.id) {
        r.id = 'ruta_' + (Date.now() + idx) + '_' + Math.random().toString(36).substr(2, 6);
        modificado = true;
      }
      if (!r.estado) {
        r.estado = 'pendiente';
        modificado = true;
      }
      if (!r.conductor && r.chofer) { r.conductor = r.chofer; modificado = true; }
      if (!r.chofer && r.conductor) { r.chofer = r.conductor; modificado = true; }
      if (!r.vehiculo && r.camion) { r.vehiculo = r.camion; modificado = true; }
      if (!r.camion && r.vehiculo) { r.camion = r.vehiculo; modificado = true; }
    });
    window.rutas = rutas;
    if (modificado) {
      localStorage.setItem('bugamed_rutas', JSON.stringify(rutas));
    }
  }
}
asegurarEstadoRutas();

let repostajes = cargarStorage('bugamed_repostajes', [
  { fecha: '2026-10-24', tipo: 'Gasoil', litros: '65', euros: '102.50', camion: '8912-MBN', conductor: 'Antonio Fernández', chofer: 'Antonio Fernández' },
  { fecha: '2026-10-25', tipo: 'Gasoil', litros: '40', euros: '64.00', camion: '4589-KLL', conductor: 'David Morales', chofer: 'David Morales' }
]);
if (Array.isArray(repostajes)) {
  repostajes.forEach(r => {
    if (!r.conductor && r.chofer) r.conductor = r.chofer;
    if (!r.chofer && r.conductor) r.chofer = r.conductor;
  });
}
window.repostajes = repostajes;

let incidencias = cargarStorage('bugamed_incidencias', [
  { id: 'inc_demo_1', fecha: '2026-10-22', categoria: 'Neumáticos', camion: '4589-KLL', nota: 'Presión baja en rueda trasera derecha.', resuelto: false }
]);
window.incidencias = incidencias;

const demoHistorialInicial = [
  // NOVIEMBRE 2026 - Antonio Fernández
  {
    id: 'hist_demo_1',
    fecha: '2026-11-02',
    dia: 'Lunes',
    conductor: 'Antonio Fernández',
    chofer: 'Antonio Fernández',
    camion: '8912-MBN',
    rutaNombre: 'Ruta Matutina Hoteles',
    km: '145',
    obs: 'Ruta finalizada a tiempo. Sin incidencias de tráfico.',
    horaInicio: '07:30',
    horaFin: '14:45',
    detalleClientes: [
      { cliente: 'Hotel Meliá Palma', entregados: 12, recogidos: 10 },
      { cliente: 'Hotel Salou Sun', entregados: 8, recogidos: 9 }
    ],
    estado: 'completada'
  },
  {
    id: 'hist_demo_2',
    fecha: '2026-11-01',
    dia: 'Domingo',
    conductor: 'Antonio Fernández',
    chofer: 'Antonio Fernández',
    camion: '8912-MBN',
    rutaNombre: 'Ruta Especial Costa',
    km: '98',
    obs: 'Servicio de refuerzo fin de semana.',
    horaInicio: '08:00',
    horaFin: '13:15',
    detalleClientes: [
      { cliente: 'Hotel Salou Sun', entregados: 14, recogidos: 12 }
    ],
    estado: 'completada'
  },
  // OCTUBRE 2026 - Antonio Fernández
  {
    id: 'hist_demo_3',
    fecha: '2026-10-28',
    dia: 'Miércoles',
    conductor: 'Antonio Fernández',
    chofer: 'Antonio Fernández',
    camion: '8912-MBN',
    rutaNombre: 'Ruta Tarragona Central',
    km: '120',
    obs: 'Entregas regulares completadas.',
    horaInicio: '08:00',
    horaFin: '15:00',
    detalleClientes: [
      { cliente: 'Hotel Meliá Palma', entregados: 10, recogidos: 8 },
      { cliente: 'Restaurante Cambrils Port', entregados: 5, recogidos: 5 }
    ],
    estado: 'completada'
  },
  {
    id: 'hist_demo_4',
    fecha: '2026-10-21',
    dia: 'Miércoles',
    conductor: 'Antonio Fernández',
    chofer: 'Antonio Fernández',
    camion: '8912-MBN',
    rutaNombre: 'Ruta Playas y Restaurantes',
    km: '135',
    obs: 'Todo conforme en albaranes.',
    horaInicio: '07:45',
    horaFin: '14:30',
    detalleClientes: [
      { cliente: 'Restaurante Cambrils Port', entregados: 6, recogidos: 6 }
    ],
    estado: 'completada'
  },
  {
    id: 'hist_demo_5',
    fecha: '2026-10-14',
    dia: 'Miércoles',
    conductor: 'Antonio Fernández',
    chofer: 'Antonio Fernández',
    camion: '8912-MBN',
    rutaNombre: 'Ruta Salou - Cambrils',
    km: '110',
    obs: 'Tráfico fluido en autovía.',
    horaInicio: '08:15',
    horaFin: '14:40',
    detalleClientes: [
      { cliente: 'Hotel Salou Sun', entregados: 9, recogidos: 9 }
    ],
    estado: 'completada'
  },
  // SEPTIEMBRE 2026 - Antonio Fernández
  {
    id: 'hist_demo_6',
    fecha: '2026-09-30',
    dia: 'Miércoles',
    conductor: 'Antonio Fernández',
    chofer: 'Antonio Fernández',
    camion: '8912-MBN',
    rutaNombre: 'Ruta Cierre Septiembre',
    km: '128',
    obs: 'Cierre de mes con recogida de jaulas vacías.',
    horaInicio: '08:00',
    horaFin: '15:20',
    detalleClientes: [
      { cliente: 'Hotel Meliá Palma', entregados: 15, recogidos: 16 }
    ],
    estado: 'completada'
  },
  // NOVIEMBRE 2026 - David Morales
  {
    id: 'hist_demo_7',
    fecha: '2026-11-02',
    dia: 'Lunes',
    conductor: 'David Morales',
    chofer: 'David Morales',
    camion: '4589-KLL',
    rutaNombre: 'Ruta Restaurantes y Campings',
    km: '90',
    obs: 'Ruta completada sin incidencias.',
    horaInicio: '08:30',
    horaFin: '14:15',
    detalleClientes: [
      { cliente: 'Restaurante Cambrils Port', entregados: 7, recogidos: 8 },
      { cliente: 'Camping Estanyet', entregados: 10, recogidos: 11 }
    ],
    estado: 'completada'
  },
  // OCTUBRE 2026 - David Morales
  {
    id: 'hist_demo_8',
    fecha: '2026-10-29',
    dia: 'Jueves',
    conductor: 'David Morales',
    chofer: 'David Morales',
    camion: '4589-KLL',
    rutaNombre: 'Ruta Costa Sur',
    km: '105',
    obs: 'Entregas a tiempo y firma de albaranes.',
    horaInicio: '08:00',
    horaFin: '14:00',
    detalleClientes: [
      { cliente: 'Camping Estanyet', entregados: 12, recogidos: 10 }
    ],
    estado: 'completada'
  }
];

let historialFinalizadas = cargarStorage('bugamed_historial_finalizadas', demoHistorialInicial);
if (!historialFinalizadas || !Array.isArray(historialFinalizadas) || historialFinalizadas.length === 0) {
  historialFinalizadas = demoHistorialInicial;
}
// Asegurar IDs únicos y propiedad conductor unificada para cada ruta finalizada
historialFinalizadas.forEach((r, idx) => {
  if (!r.id) {
    r.id = 'hist_' + (Date.now() + idx) + '_' + Math.random().toString(36).substr(2, 6);
  }
  if (!r.conductor && r.chofer) r.conductor = r.chofer;
  if (!r.chofer && r.conductor) r.chofer = r.conductor;
});
let serviciosActivos = cargarStorage('bugamed_servicios_activos', {});
let envasesPorClienteRuta = cargarStorage('bugamed_envases_registrados', {});

let diaActual = 'Lunes';
let diaSeleccionadoActual = null;
let diaActualModal = 'Lunes';
let modalAsignacionTemporal = null;
let conductorSeleccionadoAsignacion = null;
let choferSeleccionadoAsignacion = null;
let clientesManualesTempRapido = [];
let filtroClienteActual = 'Todos';
let filtroCamionActual = 'Todos';
let filtroIncidenciasTab = 'curso'; 
let conductorAcordeonAbierto = null; 
let choferAcordeonAbierto = null; 
const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

function guardarDatosEnLocal() {
  window.rutas = rutas;
  window.repostajes = repostajes;
  window.conductores = conductores;
  window.choferes = conductores;
  window.incidencias = incidencias;
  localStorage.setItem('bugamed_camiones', JSON.stringify(camiones));
  localStorage.setItem('bugamed_conductores', JSON.stringify(conductores));
  localStorage.setItem('bugamed_choferes', JSON.stringify(conductores));
  localStorage.setItem('bugamed_clientes', JSON.stringify(clientes));
  localStorage.setItem('bugamed_rutas', JSON.stringify(rutas));
  localStorage.setItem('bugamed_repostajes', JSON.stringify(repostajes));
  localStorage.setItem('bugamed_incidencias', JSON.stringify(incidencias));
  localStorage.setItem('bugamed_servicios_activos', JSON.stringify(serviciosActivos));
  localStorage.setItem('bugamed_envases_registrados', JSON.stringify(envasesPorClienteRuta));
  localStorage.setItem('bugamed_historial_finalizadas', JSON.stringify(historialFinalizadas));
  actualizarKPIs();
}

function registrarRutaEnHistorial(ruta, metadatos = {}) {
  if (!ruta) return null;
  if (!Array.isArray(historialFinalizadas)) {
    historialFinalizadas = [];
  }

  const idRuta = String(ruta.id || ('hist_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6)));
  const fechaHoy = metadatos.fecha || ruta.fechaCompletada || new Date().toISOString().split('T')[0];
  const horaFin = metadatos.horaFin || ruta.horaFin || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const horaInicio = metadatos.horaInicio || ruta.horaInicio || '08:00';
  const km = metadatos.km || ruta.km || 'No especificado';
  const obs = metadatos.obs || ruta.obs || 'Ruta finalizada';
  const conductor = (ruta.conductor || ruta.chofer || metadatos.conductor || metadatos.chofer || 'Sin conductor').trim();
  const camion = ruta.camion || ruta.vehiculo || metadatos.camion || 'Sin camión';
  const dia = ruta.dia || metadatos.dia || 'General';

  let detalleClientes = [];
  if (metadatos.detalleClientes && Array.isArray(metadatos.detalleClientes) && metadatos.detalleClientes.length > 0) {
    detalleClientes = metadatos.detalleClientes;
  } else if (ruta.detalleClientes && Array.isArray(ruta.detalleClientes) && ruta.detalleClientes.length > 0) {
    detalleClientes = ruta.detalleClientes;
  } else if (ruta.clientes && Array.isArray(ruta.clientes)) {
    detalleClientes = ruta.clientes.map(cli => {
      const cliNombre = typeof cli === 'object' && cli !== null ? (cli.nombre || cli.name || '') : String(cli);
      return { cliente: cliNombre, entregados: 0, recogidos: 0 };
    });
  }

  const rutaNombre = ruta.rutaNombre || metadatos.rutaNombre || `Ruta ${dia} (${detalleClientes.length} paradas)`;

  const idxExistente = historialFinalizadas.findIndex(h => String(h.id) === idRuta);
  const entrada = {
    id: idRuta,
    fecha: fechaHoy,
    dia: dia,
    conductor: conductor,
    chofer: conductor,
    camion: camion,
    rutaNombre: rutaNombre,
    km: km,
    obs: obs,
    horaInicio: horaInicio,
    horaFin: horaFin,
    detalleClientes: detalleClientes,
    estado: 'completada',
    status: 'completed'
  };

  if (idxExistente !== -1) {
    historialFinalizadas[idxExistente] = { ...historialFinalizadas[idxExistente], ...entrada };
  } else {
    historialFinalizadas.unshift(entrada);
  }

  // Marcar estado en el objeto ruta
  ruta.estado = 'completada';
  ruta.status = 'completed';
  ruta.fechaCompletada = fechaHoy;
  ruta.horaInicio = horaInicio;
  ruta.horaFin = horaFin;
  ruta.km = km;
  ruta.obs = obs;
  ruta.detalleClientes = detalleClientes;

  window.historialFinalizadas = historialFinalizadas;
  return entrada;
}

function asegurarSincronizacionHistorial() {
  if (!Array.isArray(rutas) || !Array.isArray(historialFinalizadas)) return;
  let modificado = false;
  rutas.forEach(r => {
    if (r.estado === 'completada' || r.estado === 'finalizada' || r.status === 'completed') {
      const existe = historialFinalizadas.some(h => String(h.id) === String(r.id));
      if (!existe) {
        registrarRutaEnHistorial(r);
        modificado = true;
      }
    }
  });
  if (modificado) {
    localStorage.setItem('bugamed_historial_finalizadas', JSON.stringify(historialFinalizadas));
  }
}
asegurarSincronizacionHistorial();

async function finalizarRuta(rutaId, metadatos = {}) {
  if (!rutaId) return null;

  let ruta = (typeof rutas !== 'undefined' && Array.isArray(rutas))
    ? rutas.find(r => String(r.id) === String(rutaId))
    : null;

  if (!ruta) {
    console.warn(`⚠️ No se encontró la ruta con ID ${rutaId} para finalizar.`);
    return null;
  }

  const conductorNombre = (ruta.conductor || ruta.chofer || '').trim();
  const camionMat = ruta.camion || ruta.vehiculo;

  // 1. Registrar en Historial y marcar como finalizada
  const entradaHistorial = registrarRutaEnHistorial(ruta, metadatos);

  // 2. Liberar el camión si corresponde
  if (typeof camiones !== 'undefined' && Array.isArray(camiones) && camionMat) {
    const v = camiones.find(c => c.matricula === camionMat);
    if (v) v.estado = 'Libre';
  }

  // 3. Liberar servicio activo si estaba en curso
  if (typeof serviciosActivos !== 'undefined' && conductorNombre && serviciosActivos[conductorNombre]) {
    delete serviciosActivos[conductorNombre];
  }
  if (typeof conductorAcordeonAbierto !== 'undefined' && conductorAcordeonAbierto === conductorNombre) {
    conductorAcordeonAbierto = null;
  }
  if (typeof choferAcordeonAbierto !== 'undefined' && choferAcordeonAbierto === conductorNombre) {
    choferAcordeonAbierto = null;
  }

  // 4. Limpiar envases temporales de la ruta activa
  if (typeof envasesPorClienteRuta !== 'undefined' && ruta.clientes) {
    ruta.clientes.forEach(cli => {
      const cNombre = typeof cli === 'object' && cli !== null ? (cli.nombre || cli.name || '') : String(cli);
      const key = `${conductorNombre}_${cNombre}`;
      delete envasesPorClienteRuta[key];
    });
  }

  // 5. Guardar en almacenamiento local persistente
  if (typeof guardarDatosEnLocal === 'function') {
    guardarDatosEnLocal();
  }

  // 6. Sincronizar actualización con Supabase en tiempo real
  if (typeof actualizarEstadoRutaSupabase === 'function' && ruta.id) {
    try {
      await actualizarEstadoRutaSupabase(ruta.id, 'finalizada');
    } catch (e) {
      console.warn('Aviso sincronizando estado con Supabase:', e);
    }
  }

  // 7. Re-renderizado dinámico de la interfaz completa
  if (typeof refrescarVistasRutas === 'function') {
    refrescarVistasRutas();
  } else {
    if (typeof renderDiasSemana === 'function') renderDiasSemana();
    if (typeof renderGridConductoresAsignacion === 'function') renderGridConductoresAsignacion();
    else if (typeof renderGridChoferesAsignacion === 'function') renderGridChoferesAsignacion();
    if (typeof renderHistorialConductoresGrid === 'function') renderHistorialConductoresGrid();
    else if (typeof renderHistorialChoferesGrid === 'function') renderHistorialChoferesGrid();
  }

  // 8. Si el detalle del historial de este conductor está abierto, actualizarlo
  const conductorActual = window.conductorSeleccionadoActual || window.choferSeleccionadoActual;
  if (conductorActual === conductorNombre) {
    if (typeof verDetalleHistorialConductor === 'function') {
      verDetalleHistorialConductor(conductorNombre);
    } else if (typeof verDetalleHistorialChofer === 'function') {
      verDetalleHistorialChofer(conductorNombre);
    }
  }

  return entradaHistorial;
}

window.registrarRutaEnHistorial = registrarRutaEnHistorial;
window.asegurarSincronizacionHistorial = asegurarSincronizacionHistorial;
window.finalizarRuta = finalizarRuta;
window.historialFinalizadas = historialFinalizadas;

function actualizarKPIs() {
  const elCam = document.getElementById('kpi-camiones');
  const elCond = document.getElementById('kpi-conductores') || document.getElementById('kpi-choferes');
  const elInc = document.getElementById('kpi-incidencias');

  if (elCam && typeof camiones !== 'undefined') elCam.innerText = camiones.length;
  if (elCond && typeof conductores !== 'undefined') elCond.innerText = conductores.length;
  if (elInc) {
    const lista = (typeof window.incidencias !== 'undefined' && Array.isArray(window.incidencias))
      ? window.incidencias
      : ((typeof incidencias !== 'undefined' && Array.isArray(incidencias)) ? incidencias : []);
    const enCursoCount = lista.filter(i => !i.resuelto).length;
    elInc.innerText = enCursoCount;
  }
}
window.actualizarKPIs = actualizarKPIs;
