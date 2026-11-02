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

// Variables Globales de Datos
let camiones = cargarStorage('bugamed_camiones', [
  { matricula: '4589-KLL', modelo: 'Iveco Daily 35-160', tipo: 'Pequeño', estado: 'Libre', foto: '' },
  { matricula: '8912-MBN', modelo: 'Iveco Stralis 360 E6', tipo: 'Grande', estado: 'Libre', foto: '' }
]);

let choferes = cargarStorage('bugamed_choferes', [
  { nombre: 'Antonio Fernández', dni: '44556677A', telefono: '+34 612 987 654', foto: '' },
  { nombre: 'David Morales', dni: '88776655B', telefono: '+34 655 443 322', foto: '' }
]);

let clientes = cargarStorage('bugamed_clientes', [
  { nombre: 'Hotel Meliá Palma', zona: 'Tarragona', tipo: 'Hoteles', direccion: 'Passeig Marítim 12', telefono: '+34 971 111 222', ubicacion: 'https://www.google.com/maps/search/?api=1&query=Hotel+Melia+Palma+Passeig+Maritim+12+Tarragona' },
  { nombre: 'Hotel Salou Sun', zona: 'Salou', tipo: 'Hoteles', direccion: 'Av. Diputació 45', telefono: '+34 977 222 333', ubicacion: 'https://www.google.com/maps/search/?api=1&query=Hotel+Salou+Sun+Av+Diputacio+45+Salou' },
  { nombre: 'Restaurante Cambrils Port', zona: 'Cambrils', tipo: 'Restaurantes', direccion: 'Puerto Deportivo 8', telefono: '+34 977 444 555', ubicacion: 'https://www.google.com/maps/search/?api=1&query=Restaurante+Cambrils+Port+Puerto+Deportivo+8+Cambrils' },
  { nombre: 'Camping Estanyet', zona: 'Alcanar', tipo: 'Camping', direccion: 'Playa Vinaròs km 3', telefono: '+34 977 722 111', ubicacion: 'https://www.google.com/maps/search/?api=1&query=Camping+Estanyet+Alcanar' }
]);

let rutas = cargarStorage('bugamed_rutas', [
  { id: 'ruta_init_1', dia: 'Lunes', tipoCliente: 'Hoteles', chofer: 'Antonio Fernández', camion: '8912-MBN', clientes: ['Hotel Meliá Palma', 'Hotel Salou Sun'], estado: 'pendiente' },
  { id: 'ruta_init_2', dia: 'Lunes', tipoCliente: 'Restaurantes', chofer: 'Antonio Fernández', camion: '8912-MBN', clientes: ['Restaurante Cambrils Port'], estado: 'pendiente' },
  { id: 'ruta_init_3', dia: 'Martes', tipoCliente: 'Restaurantes', chofer: 'David Morales', camion: '4589-KLL', clientes: ['Restaurante Cambrils Port'], estado: 'pendiente' }
]);

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
    });
    if (modificado) {
      localStorage.setItem('bugamed_rutas', JSON.stringify(rutas));
    }
  }
}
asegurarEstadoRutas();

let repostajes = cargarStorage('bugamed_repostajes', [
  { fecha: '2026-10-24', tipo: 'Gasoil', litros: '65', euros: '102.50', camion: '8912-MBN', chofer: 'Antonio Fernández' },
  { fecha: '2026-10-25', tipo: 'Gasoil', litros: '40', euros: '64.00', camion: '4589-KLL', chofer: 'David Morales' }
]);

let incidencias = cargarStorage('bugamed_incidencias', [
  { fecha: '2026-10-22', categoria: 'Neumáticos', camion: '4589-KLL', nota: 'Presión baja en rueda trasera derecha.', resuelto: false }
]);

const demoHistorialInicial = [
  // NOVIEMBRE 2026 - Antonio Fernández
  {
    id: 'hist_demo_1',
    fecha: '2026-11-02',
    dia: 'Lunes',
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
// Asegurar IDs únicos para cada ruta finalizada
historialFinalizadas.forEach((r, idx) => {
  if (!r.id) {
    r.id = 'hist_' + (Date.now() + idx) + '_' + Math.random().toString(36).substr(2, 6);
  }
});
let serviciosActivos = cargarStorage('bugamed_servicios_activos', {});
let envasesPorClienteRuta = cargarStorage('bugamed_envases_registrados', {});

let diaActual = 'Lunes';
let diaSeleccionadoActual = null;
let diaActualModal = 'Lunes';
let modalAsignacionTemporal = null;
let choferSeleccionadoAsignacion = null;
let clientesManualesTempRapido = [];
let filtroClienteActual = 'Todos';
let filtroCamionActual = 'Todos';
let filtroIncidenciasTab = 'curso'; 
let choferAcordeonAbierto = null; 
const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

function guardarDatosEnLocal() {
  localStorage.setItem('bugamed_camiones', JSON.stringify(camiones));
  localStorage.setItem('bugamed_choferes', JSON.stringify(choferes));
  localStorage.setItem('bugamed_clientes', JSON.stringify(clientes));
  localStorage.setItem('bugamed_rutas', JSON.stringify(rutas));
  localStorage.setItem('bugamed_repostajes', JSON.stringify(repostajes));
  localStorage.setItem('bugamed_incidencias', JSON.stringify(incidencias));
  localStorage.setItem('bugamed_servicios_activos', JSON.stringify(serviciosActivos));
  localStorage.setItem('bugamed_envases_registrados', JSON.stringify(envasesPorClienteRuta));
  localStorage.setItem('bugamed_historial_finalizadas', JSON.stringify(historialFinalizadas));
  actualizarKPIs();
}

function actualizarKPIs() {
  const elCam = document.getElementById('kpi-camiones');
  const elChof = document.getElementById('kpi-choferes');
  const elInc = document.getElementById('kpi-incidencias');

  if (elCam) elCam.innerText = camiones.length;
  if (elChof) elChof.innerText = choferes.length;
  if (elInc) {
    const enCursoCount = incidencias.filter(i => !i.resuelto).length;
    elInc.innerText = enCursoCount;
  }
}
