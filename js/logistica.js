/* --- REPOSTAJES & LOGÍSTICA --- */
// Las funciones principales de repostajes (guardarRepostaje, eliminarRepostajeAdmin, renderRepostajes)
// y su sincronización en tiempo real con Supabase residen de forma centralizada en admin.js y supabase.js.

/* --- LOGÍSTICA & INICIO DE RUTA CON TARJETAS DE PERFIL --- */
function renderModuloLogistica() {
  const listaOpcionesCamiones = document.getElementById('lista-opciones-camiones');
  const listaOpcionesConductores = document.getElementById('lista-opciones-conductores') || document.getElementById('lista-opciones-choferes');
  const selIncCamion = document.getElementById('inc-camion');

  if (listaOpcionesCamiones && typeof camiones !== 'undefined') {
    listaOpcionesCamiones.innerHTML = camiones.map(c => `
      <li onclick="seleccionarCamionRepostaje('${c.matricula.replace(/'/g, "\\'")}')" class="px-4 py-2.5 cursor-pointer border-l-4 border-transparent hover:border-blue-600 hover:bg-blue-50 text-sm text-slate-700 transition-colors flex items-center justify-between">
        <span class="font-semibold text-slate-800">${c.matricula}</span>
        ${c.modelo ? `<span class="text-xs text-slate-400 font-normal">${c.modelo}</span>` : ''}
      </li>
    `).join('');
  }

  const listaConductores = (typeof conductores !== 'undefined' && Array.isArray(conductores)) ? conductores : ((typeof choferes !== 'undefined') ? choferes : []);
  if (listaOpcionesConductores && listaConductores.length > 0) {
    listaOpcionesConductores.innerHTML = listaConductores.map(ch => `
      <li onclick="seleccionarConductorRepostaje('${ch.nombre.replace(/'/g, "\\'")}')" class="px-4 py-2.5 cursor-pointer border-l-4 border-transparent hover:border-indigo-600 hover:bg-indigo-50 text-sm text-slate-700 transition-colors flex items-center justify-between">
        <span class="font-semibold text-slate-800">${ch.nombre}</span>
        ${ch.dni ? `<span class="text-xs text-slate-400 font-normal">${ch.dni}</span>` : ''}
      </li>
    `).join('');
  }

  if (selIncCamion) selIncCamion.innerHTML = camiones.map(c => `<option value="${c.matricula}">${c.matricula}</option>`).join('');

  renderRepostajes();
  renderIncidencias();
  actualizarEstadoFichajeInterfaz();
  if (typeof renderVisualizacionRutasConductores === 'function') {
    renderVisualizacionRutasConductores();
  } else if (typeof renderVisualizacionRutasChoferes === 'function') {
    renderVisualizacionRutasChoferes();
  }
}

window.abrirSelectorConductoresInicio = function() {
  const modal = document.getElementById('modal-selector-conductores') || document.getElementById('modal-selector-choferes');
  const grid = document.getElementById('grid-modal-conductores-perfiles') || document.getElementById('grid-modal-choferes-perfiles');
  if (!modal || !grid) return;

  const lista = (typeof conductores !== 'undefined' && Array.isArray(conductores)) ? conductores : ((typeof choferes !== 'undefined') ? choferes : []);
  const conductoresDisponibles = lista.filter(ch => !serviciosActivos[ch.nombre]);

  if (conductoresDisponibles.length === 0) {
    grid.innerHTML = '<p class="col-span-full text-center text-xs text-slate-500 py-6">Todos los conductores están en ruta actualmente.</p>';
  } else {
    grid.innerHTML = conductoresDisponibles.map(ch => `
      <div onclick="seleccionarConductorInicio('${ch.nombre.replace(/'/g, "\\'")}', '${ch.foto || ''}')" class="light-card light-card-hover rounded-2xl p-4 border border-slate-200 cursor-pointer flex flex-col items-center text-center space-y-2 group">
        <div class="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center overflow-hidden border-2 border-blue-200 group-hover:border-blue-600 transition-all shadow-inner">
          ${(ch.foto && (typeof esFotoValida !== 'function' || esFotoValida(ch.foto))) 
            ? `<img src="${ch.foto}" class="w-full h-full object-cover" alt="${ch.nombre}" onerror="this.onerror=null; this.parentElement.innerHTML='<i class=\\\'fa-solid fa-user text-2xl\\\'></i>';">` 
            : '<i class="fa-solid fa-user text-2xl"></i>'}
        </div>
        <div>
          <h4 class="font-extrabold text-slate-900 text-sm leading-tight">${ch.nombre}</h4>
          <p class="text-[10px] text-slate-500">DNI: ${ch.dni}</p>
        </div>
      </div>
    `).join('');
  }

  modal.classList.remove('hidden');
};
window.abrirSelectorChoferesInicio = window.abrirSelectorConductoresInicio;

window.cerrarSelectorConductores = function() {
  const modal = document.getElementById('modal-selector-conductores') || document.getElementById('modal-selector-choferes');
  if (modal) modal.classList.add('hidden');
};
window.cerrarSelectorChoferes = window.cerrarSelectorConductores;

window.seleccionarConductorInicio = function(nombre, foto) {
  const input = document.getElementById('fichaje-conductor-input') || document.getElementById('fichaje-chofer-input');
  const prevNombre = document.getElementById('preview-conductor-nombre') || document.getElementById('preview-chofer-nombre');
  const prevImg = document.getElementById('preview-conductor-img') || document.getElementById('preview-chofer-img');

  if (input) input.value = nombre;
  if (prevNombre) prevNombre.innerText = nombre;
  if (prevImg) {
    prevImg.innerHTML = (foto && (typeof esFotoValida !== 'function' || esFotoValida(foto))) 
      ? `<img src="${foto}" class="w-full h-full object-cover" onerror="this.onerror=null; this.parentElement.innerHTML='<span class=\\\'font-bold text-sm\\\'>${nombre.charAt(0)}</span>';">` 
      : `<span class="font-bold text-sm">${nombre.charAt(0)}</span>`;
  }

  cerrarSelectorConductores();
  actualizarSelectorRutasParaConductorInicio(nombre);
};
window.seleccionarChoferInicio = window.seleccionarConductorInicio;

window.abrirSelectorCamionesInicio = function() {
  const modal = document.getElementById('modal-selector-camiones');
  const grid = document.getElementById('grid-modal-camiones-perfiles');
  if (!modal || !grid) return;

  const camionesDisponibles = camiones.filter(c => c.estado === 'Libre' || !c.estado);

  if (camionesDisponibles.length === 0) {
    grid.innerHTML = '<p class="col-span-full text-center text-xs text-slate-500 py-6">No hay vehículos libres disponibles.</p>';
  } else {
    grid.innerHTML = camionesDisponibles.map(c => `
      <div onclick="seleccionarCamionInicio('${c.matricula}', '${c.foto || ''}')" class="light-card light-card-hover rounded-2xl p-4 border border-blue-200 cursor-pointer flex flex-col items-center text-center space-y-2 group">
        <div class="w-16 h-16 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center overflow-hidden border-2 border-blue-200 group-hover:border-blue-600 transition-all shadow-inner">
          ${(c.foto && typeof esFotoValida === 'function' && esFotoValida(c.foto)) ? `<img src="${c.foto}" class="w-full h-full object-cover" alt="${c.matricula}">` : '<i class="fa-solid fa-truck text-2xl"></i>'}
        </div>
        <div>
          <h4 class="font-black text-blue-950 text-sm tracking-tight">${c.matricula}</h4>
          <p class="text-[10px] text-slate-500">${c.tipo}</p>
        </div>
      </div>
    `).join('');
  }

  modal.classList.remove('hidden');
};

window.cerrarSelectorCamiones = function() {
  const modal = document.getElementById('modal-selector-camiones');
  if (modal) modal.classList.add('hidden');
};

window.seleccionarCamionInicio = function(matricula, foto) {
  const input = document.getElementById('fichaje-camion-input');
  const prevMat = document.getElementById('preview-camion-matricula');
  const prevImg = document.getElementById('preview-camion-img');

  if (input) input.value = matricula;
  if (prevMat) prevMat.innerText = matricula;
  if (prevImg) {
    prevImg.innerHTML = (foto && typeof esFotoValida === 'function' && esFotoValida(foto)) ? `<img src="${foto}" class="w-full h-full object-cover">` : `<i class="fa-solid fa-truck text-sm"></i>`;
  }

  cerrarSelectorCamiones();
};

/* --- FLUJO DE INICIO DE RUTA CON SELECCIÓN DE DÍA Y RUTA ESPECÍFICA --- */
let datosInicioPendiente = null;

window.iniciarRutaServicio = function(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  const conductor = (document.getElementById('fichaje-conductor-input') || document.getElementById('fichaje-chofer-input'))?.value;
  const camionMat = document.getElementById('fichaje-camion-input')?.value;

  if (!conductor || !camionMat) {
    alert('Por favor, haz clic para seleccionar un conductor y un vehículo.');
    return;
  }

  // Registrar timestamp exacto de inicio de ruta en localStorage
  localStorage.setItem('routeStartTime', new Date().toISOString());

  datosInicioPendiente = { conductor, chofer: conductor, camionMat };

  // Actualizar badges del modal de inicio
  const badgeCond = document.getElementById('modal-inicio-conductor-badge') || document.getElementById('modal-inicio-chofer-badge');
  const badgeCam = document.getElementById('modal-inicio-camion-badge');
  if (badgeCond) badgeCond.innerText = conductor;
  if (badgeCam) badgeCam.innerText = camionMat;

  // Sincronizar día por defecto al día de la semana actual
  const selectDia = document.getElementById('select-dia-inicio-ruta');
  if (selectDia) {
    const mapaDias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const diaHoy = mapaDias[new Date().getDay()] || 'Lunes';
    selectDia.value = diaHoy;
  }

  const modalDia = document.getElementById('modal-dia-ruta');
  if (modalDia) {
    modalDia.classList.remove('hidden');
    actualizarListadoRutasParaInicio();
  } else {
    ejecutarInicioServicioDefinitivo(conductor, camionMat, 'Lunes', 0);
  }
};

window.cerrarModalDiaRuta = function() {
  const modal = document.getElementById('modal-dia-ruta');
  if (modal) modal.classList.add('hidden');
  datosInicioPendiente = null;
};

window.actualizarListadoRutasParaInicio = function() {
  const container = document.getElementById('contenedor-rutas-disponibles-inicio');
  const badgeCount = document.getElementById('badge-contador-rutas-modal');
  const selectDia = document.getElementById('select-dia-inicio-ruta');
  if (!container) return;

  const conductor = datosInicioPendiente 
    ? (datosInicioPendiente.conductor || datosInicioPendiente.chofer) 
    : ((document.getElementById('fichaje-conductor-input') || document.getElementById('fichaje-chofer-input'))?.value || '');
  const camionMat = datosInicioPendiente ? datosInicioPendiente.camionMat : (document.getElementById('fichaje-camion-input')?.value || '');
  const diaSeleccionado = selectDia ? selectDia.value : 'Lunes';

  if (!conductor) {
    container.innerHTML = '<p class="text-xs text-slate-500 italic p-3 text-center">Selecciona primero un conductor.</p>';
    return;
  }

  // Filtrar EXCLUYENDO las rutas completadas, finalizadas o archivadas
  const rutasDelConductorDia = (typeof rutas !== 'undefined' && Array.isArray(rutas))
    ? rutas.filter(r => 
        (r.conductor || r.chofer) && (r.conductor || r.chofer).trim().toLowerCase() === conductor.trim().toLowerCase() && 
        r.dia && r.dia.trim().toLowerCase() === diaSeleccionado.trim().toLowerCase() &&
        r.status !== 'completed' &&
        r.estado !== 'completada' && r.estado !== 'finalizada' && r.estado !== 'archivada'
      )
    : [];

  // Comprobar si hay rutas ya finalizadas para este día
  const rutasCompletadasHoy = (typeof rutas !== 'undefined' && Array.isArray(rutas))
    ? rutas.filter(r => 
        (r.conductor || r.chofer) && (r.conductor || r.chofer).trim().toLowerCase() === conductor.trim().toLowerCase() && 
        r.dia && r.dia.trim().toLowerCase() === diaSeleccionado.trim().toLowerCase() &&
        (r.status === 'completed' || r.estado === 'completada' || r.estado === 'finalizada' || r.estado === 'archivada')
      )
    : [];

  if (badgeCount) {
    badgeCount.innerText = `${rutasDelConductorDia.length} ${rutasDelConductorDia.length === 1 ? 'ruta disponible' : 'rutas disponibles'}`;
    badgeCount.className = rutasDelConductorDia.length > 0 
      ? "text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200" 
      : (rutasCompletadasHoy.length > 0
          ? "text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200"
          : "text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200");
  }

  if (rutasDelConductorDia.length === 0) {
    if (rutasCompletadasHoy.length > 0) {
      container.innerHTML = `
        <div class="light-card rounded-2xl p-6 text-center space-y-3 border border-emerald-200 bg-emerald-50/50">
          <div class="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-xl">
            <i class="fa-solid fa-circle-check"></i>
          </div>
          <div>
            <h4 class="font-extrabold text-emerald-950 text-sm">Rutas del ${diaSeleccionado} ya completadas</h4>
            <p class="text-xs text-emerald-800 mt-1">El conductor <strong>${conductor}</strong> ya ha finalizado todas sus rutas para este día.</p>
          </div>
          <p class="text-[11px] text-slate-500 max-w-sm mx-auto">
            Puedes consultar el desglose de carros entregados/recogidos en la sección <strong>Historial</strong> o cambiar de día en el desplegable superior.
          </p>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="light-card rounded-2xl p-6 text-center space-y-3 border border-amber-200 bg-amber-50/50">
          <div class="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto text-xl">
            <i class="fa-solid fa-calendar-xmark"></i>
          </div>
          <div>
            <h4 class="font-extrabold text-amber-950 text-sm">Sin rutas asignadas para el ${diaSeleccionado}</h4>
            <p class="text-xs text-amber-800 mt-1">El conductor <strong>${conductor}</strong> no tiene rutas pendientes para este día.</p>
          </div>
          <p class="text-[11px] text-slate-500 max-w-sm mx-auto">
            Cambia de día en el desplegable superior o añade rutas en la sección <strong>Semana</strong>.
          </p>
        </div>
      `;
    }
    return;
  }

  container.innerHTML = rutasDelConductorDia.map((r, idx) => {
    const camionFinal = r.camion || camionMat;
    const numClientes = r.clientes ? r.clientes.length : 0;
    const rId = r.id || '';

    return `
      <div class="light-card rounded-2xl p-4 sm:p-5 border-2 border-blue-200 hover:border-blue-500 transition-all space-y-3.5 bg-white shadow-2xs group">
        <div class="flex flex-wrap justify-between items-center gap-2 border-b border-slate-100 pb-2.5">
          <div class="flex items-center gap-2">
            <span class="px-3 py-1 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-2xs">
              <i class="fa-solid fa-route"></i> Ruta ${idx + 1}
            </span>
            <span class="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 flex items-center gap-1.5">
              <i class="fa-solid fa-truck text-blue-600 text-[11px]"></i> ${camionFinal}
            </span>
            ${r.tipoCliente ? `<span class="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">${r.tipoCliente}</span>` : ''}
          </div>
          <span class="text-xs font-extrabold text-blue-900 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
            ${numClientes} ${numClientes === 1 ? 'establecimiento' : 'establecimientos'}
          </span>
        </div>

        <div>
          <p class="text-[11px] font-extrabold uppercase text-slate-500 tracking-wider mb-2 flex items-center gap-1.5">
            <i class="fa-solid fa-list-ol text-blue-500"></i> Paradas del recorrido:
          </p>
          <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
            ${numClientes === 0 ? '<p class="text-xs text-slate-400 italic">Sin clientes asignados.</p>' : r.clientes.map((cItem, cIdx) => {
              const cNombre = typeof cItem === 'object' && cItem !== null ? (cItem.nombre || cItem.name || '') : String(cItem || '');
              return `
              <div class="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center gap-2.5 shadow-2xs">
                <span class="w-5 h-5 rounded-md bg-blue-100 text-blue-700 font-black flex items-center justify-center text-[10px] shrink-0">${cIdx + 1}</span>
                <p class="font-bold text-slate-800 text-xs whitespace-normal break-words flex-1">${cNombre}</p>
              </div>
            `;}).join('')}
          </div>
        </div>

        <button type="button" onclick="ejecutarInicioServicioDefinitivo('${conductor.replace(/'/g, "\\'")}', '${camionFinal.replace(/'/g, "\\'")}', '${diaSeleccionado}', ${idx}, '${rId}')" class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer">
          <i class="fa-solid fa-play"></i> Iniciar Ruta ${idx + 1}
        </button>
      </div>
    `;
  }).join('');
};

window.ejecutarInicioServicioDefinitivo = function(conductor, camionMat, diaSeleccionado, rutaIdx = 0, rutaIdParam = null) {
  if (typeof asegurarEstadoRutas === 'function') asegurarEstadoRutas();

  const rutasConductorDia = (typeof rutas !== 'undefined' && Array.isArray(rutas))
    ? rutas.filter(r => 
        (r.conductor || r.chofer) && (r.conductor || r.chofer).trim().toLowerCase() === conductor.trim().toLowerCase() && 
        r.dia && r.dia.trim().toLowerCase() === diaSeleccionado.trim().toLowerCase() &&
        r.estado !== 'completada' && r.estado !== 'finalizada' && r.estado !== 'archivada'
      )
    : [];

  let rutaElegida = null;
  if (rutaIdParam) {
    rutaElegida = rutas.find(r => r.id === rutaIdParam);
  }
  if (!rutaElegida && rutasConductorDia.length > 0) {
    rutaElegida = rutasConductorDia[rutaIdx] || rutasConductorDia[0];
  }

  let clientesDeRuta = [];
  let rutaNombre = `Ruta ${rutaIdx + 1}`;
  let camionEfectivo = camionMat;

  if (rutaElegida) {
    clientesDeRuta = rutaElegida.clientes || [];
    if (rutaElegida.camion || rutaElegida.vehiculo) camionEfectivo = rutaElegida.camion || rutaElegida.vehiculo;
    if (rutaElegida.tipoCliente) rutaNombre = `Ruta (${rutaElegida.tipoCliente})`;
    rutaElegida.estado = 'en_curso';
    if (typeof actualizarEstadoRutaSupabase === 'function' && rutaElegida.id) {
      actualizarEstadoRutaSupabase(rutaElegida.id, 'en_curso');
    }
  } else {
    const rutasConductor = (typeof rutas !== 'undefined') ? rutas.filter(r => (r.conductor || r.chofer) && (r.conductor || r.chofer).trim().toLowerCase() === conductor.trim().toLowerCase() && r.estado !== 'completada' && r.estado !== 'finalizada') : [];
    if (rutasConductor.length > 0) {
      rutaElegida = rutasConductor[0];
      clientesDeRuta = rutaElegida.clientes || [];
      if (rutaElegida.camion || rutaElegida.vehiculo) camionEfectivo = rutaElegida.camion || rutaElegida.vehiculo;
      rutaElegida.estado = 'en_curso';
      if (typeof actualizarEstadoRutaSupabase === 'function' && rutaElegida.id) {
        actualizarEstadoRutaSupabase(rutaElegida.id, 'en_curso');
      }
    } else {
      clientesDeRuta = (typeof clientes !== 'undefined') ? clientes.map(c => c.nombre) : [];
    }
  }

  serviciosActivos[conductor] = {
    conductor: conductor,
    chofer: conductor,
    camion: camionEfectivo,
    dia: diaSeleccionado,
    rutaNombre: rutaNombre,
    rutaIndex: rutaIdx,
    rutaId: rutaElegida ? rutaElegida.id : null,
    inicio: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    fechaStr: new Date().toISOString().split('T')[0],
    clientes: [...clientesDeRuta]
  };

  // Guardar timestamp exacto de inicio y referencia de ruta en localStorage
  const timestampInicioExacto = new Date().toISOString();
  localStorage.setItem('routeStartTime', timestampInicioExacto);
  if (rutaElegida && rutaElegida.id) {
    localStorage.setItem('activeRouteId', String(rutaElegida.id));
  }
  console.log('✓ [BugamedApp] Inicio de ruta registrado:', timestampInicioExacto);

  const c = camiones.find(v => v.matricula === camionEfectivo);
  if (c) c.estado = `Ocupado por ${conductor} (${rutaNombre})`;

  conductorAcordeonAbierto = conductor;
  choferAcordeonAbierto = conductor;

  // Limpiar inputs del formulario
  const inpCond = document.getElementById('fichaje-conductor-input') || document.getElementById('fichaje-chofer-input');
  const inpCam = document.getElementById('fichaje-camion-input');
  if (inpCond) inpCond.value = '';
  if (inpCam) inpCam.value = '';

  const prevCondNom = document.getElementById('preview-conductor-nombre') || document.getElementById('preview-chofer-nombre');
  const prevCondImg = document.getElementById('preview-conductor-img') || document.getElementById('preview-chofer-img');
  const prevCamMat = document.getElementById('preview-camion-matricula');
  const prevCamImg = document.getElementById('preview-camion-img');

  if (prevCondNom) prevCondNom.innerText = 'Seleccionar conductor...';
  if (prevCondImg) prevCondImg.innerHTML = '<i class="fa-solid fa-user"></i>';
  if (prevCamMat) prevCamMat.innerText = 'Seleccionar vehículo...';
  if (prevCamImg) prevCamImg.innerHTML = '<i class="fa-solid fa-truck"></i>';

  cerrarModalDiaRuta();
  guardarDatosEnLocal();
  if (typeof actualizarEstadoFichajeInterfaz === 'function') actualizarEstadoFichajeInterfaz();
  if (typeof renderConductores === 'function') {
    renderConductores();
  } else if (typeof renderChoferes === 'function') {
    renderChoferes();
  }
  if (typeof renderCamiones === 'function') renderCamiones();
};

window.confirmarInicioRutaConDia = function() {
  if (!datosInicioPendiente) return;
  const selectDia = document.getElementById('select-dia-inicio-ruta');
  const diaSeleccionado = selectDia ? selectDia.value : 'Lunes';
  const conductor = datosInicioPendiente.conductor || datosInicioPendiente.chofer;
  const camionMat = datosInicioPendiente.camionMat;

  const tieneRuta = verificarSiConductorTieneRuta(conductor, diaSeleccionado);
  if (!tieneRuta) {
    alert(`❌ El conductor ${conductor} no tiene ninguna ruta asignada o pendiente para el ${diaSeleccionado}.`);
    return;
  }

  ejecutarInicioServicioDefinitivo(conductor, camionMat, diaSeleccionado, 0);
};

function verificarSiConductorTieneRuta(nombreConductor, diaSeleccionado) {
  if (typeof rutas === 'undefined' || rutas.length === 0) {
    return false; 
  }

  const tieneAsignacion = rutas.some(r => {
    const coincideConductor = (r.conductor || r.chofer) && (r.conductor || r.chofer).trim().toLowerCase() === nombreConductor.trim().toLowerCase();
    const coincideDia = r.dia && r.dia.trim().toLowerCase() === diaSeleccionado.trim().toLowerCase();
    const noFinalizada = r.estado !== 'completada' && r.estado !== 'finalizada' && r.estado !== 'archivada';
    return coincideConductor && coincideDia && noFinalizada;
  });

  return tieneAsignacion;
}

/* --- GESTIÓN DE ESTADOS Y ACORDEONES ACTIVOS --- */
function actualizarEstadoFichajeInterfaz() {
  const badgeCount = document.getElementById('badge-rutas-activas-count');
  const boxActivasPanel = document.getElementById('box-rutas-activas-panel');
  const iconoCamion = document.getElementById('icono-camion-visual');
  const containerHumo = document.getElementById('container-camion-humo');

  if (!badgeCount) return;

  const conductoresEnRuta = Object.keys(serviciosActivos);
  badgeCount.innerText = `${conductoresEnRuta.length} Ruta(s) Activa(s)`;

  if (conductoresEnRuta.length > 0) {
    if (iconoCamion) iconoCamion.className = "fa-solid fa-truck-front text-xl truck-driving";
    if (containerHumo) {
      containerHumo.innerHTML = `
        <span class="smoke-particle"></span>
        <span class="smoke-particle"></span>
        <span class="smoke-particle"></span>
      `;
    }
    badgeCount.className = "px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200 animate-pulse";
    if (boxActivasPanel) boxActivasPanel.classList.remove('hidden');

    renderAcordeonRutasActivas(conductoresEnRuta);
  } else {
    if (iconoCamion) iconoCamion.className = "fa-solid fa-truck-front text-slate-400 text-xl";
    if (containerHumo) containerHumo.innerHTML = '';
    badgeCount.className = "px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200";
    if (boxActivasPanel) boxActivasPanel.classList.add('hidden');
  }
}

function renderAcordeonRutasActivas(conductoresEnRuta) {
  const container = document.getElementById('contenedor-acordeon-rutas-activas');
  if (!container) return;

  container.innerHTML = conductoresEnRuta.map(conductorNombre => {
    const servicio = serviciosActivos[conductorNombre];
    const condActual = servicio.conductor || servicio.chofer || conductorNombre;
    const estaAbierto = ((conductorAcordeonAbierto || choferAcordeonAbierto) === conductorNombre);

    const totalClientes = servicio.clientes ? servicio.clientes.length : 0;
    const clientesCompletados = servicio.clientes ? servicio.clientes.filter(c => {
      const k = `${condActual}_${c}`;
      return envasesPorClienteRuta[k] && envasesPorClienteRuta[k].completado;
    }).length : 0;
    const porcentajeProgreso = totalClientes > 0 ? Math.round((clientesCompletados / totalClientes) * 100) : 0;

    const totalEntregados = servicio.clientes ? servicio.clientes.reduce((acc, c) => {
      const k = `${condActual}_${c}`;
      return acc + (envasesPorClienteRuta[k]?.entregados || 0);
    }, 0) : 0;

    const totalRecogidos = servicio.clientes ? servicio.clientes.reduce((acc, c) => {
      const k = `${condActual}_${c}`;
      return acc + (envasesPorClienteRuta[k]?.recogidos || 0);
    }, 0) : 0;

    return `
      <div class="border border-indigo-200 rounded-2xl overflow-hidden bg-white shadow-xs">
        <!-- BARRA PRINCIPAL DEL CONDUCTOR EN RUTA (CLICK PARA DESPLEGAR) -->
        <div onclick="toggleAcordeonConductor('${conductorNombre}')" class="p-4 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 hover:from-blue-100/80 hover:to-indigo-100/80 transition-all flex justify-between items-center cursor-pointer select-none">
          <div class="flex items-center gap-3">
            <span class="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
            <div>
              <h4 class="font-black text-blue-950 text-base flex items-center gap-2 flex-wrap">
                <span>RUTA: ${condActual}</span>
                ${servicio.rutaNombre ? `<span class="bg-blue-600 text-white text-xs px-2.5 py-0.5 rounded-lg font-black tracking-wide shadow-2xs">${servicio.rutaNombre}</span>` : ''}
                <span class="text-xs font-bold text-indigo-700 bg-white px-2 py-0.5 rounded-md border border-indigo-200">📅 ${servicio.dia || 'General'}</span>
              </h4>
              <p class="text-xs text-slate-600 font-semibold mt-0.5">
                Vehículo: <strong class="text-blue-900">${servicio.camion}</strong> | Inicio: <strong>${servicio.inicio}</strong>
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2.5">
            <span class="text-xs font-extrabold px-3 py-1 bg-white text-blue-900 rounded-xl border border-blue-200 shadow-2xs">
              ${clientesCompletados}/${totalClientes} paradas
            </span>
            <span class="w-8 h-8 rounded-xl bg-white text-indigo-600 flex items-center justify-center border border-indigo-200 shadow-2xs">
              <i class="fa-solid ${estaAbierto ? 'fa-chevron-up' : 'fa-chevron-down'} text-xs"></i>
            </span>
          </div>
        </div>

        <!-- CONTENIDO DETALLADO DE LA RUTA ACTIVA -->
        <div class="${estaAbierto ? 'block' : 'hidden'} p-4 sm:p-5 bg-slate-50 border-t border-indigo-100 space-y-4">
          
          <!-- ACCIONES SUPERIORES Y FINALIZACIÓN -->
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-3">
            <p class="text-xs font-extrabold uppercase text-blue-950 flex items-center gap-1.5 tracking-wider">
              <i class="fa-solid fa-boxes-packing text-blue-600 text-sm"></i> Registro de Carros por Cliente
            </p>
            <div class="flex items-center gap-2 flex-wrap">
              <button type="button" onclick="finalizarRutaConductor('${servicio.rutaId || ''}', '${conductorNombre}')" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2 shrink-0" title="Finalizar esta ruta y ver resumen de tiempo transcurrido">
                <i class="fa-solid fa-flag-checkered"></i> Finalizar Ruta
              </button>
            </div>
          </div>

          <!-- RESUMEN DE PROGRESO Y CONTADORES DE CARROS -->
          <div class="bg-white p-3.5 rounded-2xl border border-indigo-100 shadow-2xs space-y-2.5">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
              <div class="flex items-center gap-2">
                <span class="font-extrabold text-blue-950 flex items-center gap-1.5">
                  <i class="fa-solid fa-chart-line text-indigo-600"></i> Progreso:
                </span>
                <span class="font-bold text-slate-700">${clientesCompletados} de ${totalClientes} paradas completadas (${porcentajeProgreso}%)</span>
              </div>
              <div class="flex items-center gap-2 text-[11px] font-extrabold">
                <span class="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg border border-blue-200 flex items-center gap-1">
                  <i class="fa-solid fa-arrow-up text-blue-500"></i> Entregados: <strong>${totalEntregados}</strong>
                </span>
                <span class="px-2.5 py-1 bg-purple-50 text-purple-700 rounded-lg border border-purple-200 flex items-center gap-1">
                  <i class="fa-solid fa-arrow-down text-purple-500"></i> Recogidos: <strong>${totalRecogidos}</strong>
                </span>
              </div>
            </div>
            <!-- Barra de progreso visual -->
            <div class="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
              <div class="bg-gradient-to-r from-blue-600 to-emerald-500 h-2.5 rounded-full transition-all duration-500" style="width: ${porcentajeProgreso}%"></div>
            </div>
          </div>

          <!-- REJILLA COMPACTA DE TARJETAS DE CLIENTES DE LA RUTA ACTIVA -->
          <div id="grid-clientes-activos-${conductorNombre}" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[560px] overflow-y-auto custom-scrollbar pr-1">
            ${servicio.clientes.map((clienteItem, idx) => {
              const clienteNombre = typeof clienteItem === 'object' && clienteItem !== null ? (clienteItem.nombre || clienteItem.name || '') : String(clienteItem || '');
              const key = `${condActual}_${clienteNombre}`;
              const env = envasesPorClienteRuta[key] || { entregados: 0, recogidos: 0, completado: false };
              const cliInfo = (typeof clientes !== 'undefined' && Array.isArray(clientes))
                ? clientes.find(c => c.nombre && c.nombre.trim().toLowerCase() === clienteNombre.trim().toLowerCase())
                : null;

              const tipoNorm = cliInfo && cliInfo.tipo ? (typeof normalizarTipoCliente === 'function' ? normalizarTipoCliente(cliInfo.tipo) : cliInfo.tipo) : '';
              let badgeTipoColor = 'bg-slate-100 text-slate-600 border-slate-200';
              if (tipoNorm === 'Hotel') badgeTipoColor = 'bg-purple-100 text-purple-700 border-purple-200';
              if (tipoNorm === 'Restaurante') badgeTipoColor = 'bg-blue-100 text-blue-700 border-blue-200';
              if (tipoNorm === 'Camping') badgeTipoColor = 'bg-amber-100 text-amber-700 border-amber-200';
              if (tipoNorm === 'Mixto') badgeTipoColor = 'bg-emerald-100 text-emerald-700 border-emerald-200';

              return `
                <div data-cliente-card-conductor="${conductorNombre}" data-cliente-card-chofer="${conductorNombre}" data-cliente-nombre="${clienteNombre.toLowerCase()}" data-cliente-dir="${(cliInfo?.direccion || '' + ' ' + cliInfo?.zona || '').toLowerCase()}" class="light-card rounded-2xl p-3.5 border ${env.completado ? 'border-emerald-300 bg-emerald-50/25 shadow-xs' : 'border-slate-200 bg-white hover:border-indigo-300 shadow-2xs'} flex flex-col justify-between gap-3 transition-all group">
                  
                  <!-- CABECERA DE LA TARJETA DEL CLIENTE -->
                  <div class="space-y-1.5">
                    <div class="flex justify-between items-start gap-1.5">
                      <div class="flex items-center gap-1.5 min-w-0 flex-1">
                        <span class="w-6 h-6 rounded-lg ${env.completado ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'} font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
                          ${idx + 1}
                        </span>
                        <h5 class="font-extrabold text-slate-900 text-xs sm:text-sm whitespace-normal break-words leading-tight" title="${clienteNombre}">
                          ${clienteNombre}
                        </h5>
                      </div>
                      ${env.completado 
                        ? '<span class="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-extrabold border border-emerald-200 flex items-center gap-1 shrink-0"><i class="fa-solid fa-check"></i> Hecho</span>' 
                        : ''
                      }
                    </div>

                    <!-- DATOS DE ZONA Y ACCESO GPS -->
                    <div class="flex items-center justify-between gap-1 pt-0.5">
                      <div class="text-[11px] text-slate-500 truncate min-w-0 flex-1">
                        ${cliInfo && (cliInfo.direccion || cliInfo.zona) ? `
                          <p class="truncate" title="${cliInfo.direccion || ''} ${cliInfo.zona || ''}">
                            <i class="fa-solid fa-location-dot text-slate-400 mr-1 text-[10px]"></i>${cliInfo.zona ? cliInfo.zona + ' ' : ''}${cliInfo.direccion ? '• ' + cliInfo.direccion : ''}
                          </p>
                        ` : '<p class="text-slate-400 italic">Sin dirección específica</p>'}
                      </div>
                      <div class="flex items-center gap-1.5 shrink-0">
                        <button type="button" onclick="abrirNavegacionGPSCliente('${clienteNombre.replace(/'/g, "\\'")}')" class="w-6 h-6 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg flex items-center justify-center shadow-2xs transition-all cursor-pointer hover:scale-110 shrink-0" title="Abrir en Google Maps" aria-label="Abrir en Google Maps">
                          <i class="fa-solid fa-location-dot text-xs"></i>
                        </button>
                        ${tipoNorm ? `<span class="text-[9px] px-1.5 py-0.5 rounded font-extrabold border ${badgeTipoColor}">${tipoNorm}</span>` : ''}
                      </div>
                    </div>
                  </div>

                  <!-- CONTROLES COMPACTOS DE CARROS (ENTREGADOS / RECOGIDOS) CON BOTONES +/- Y ENTRADA DIRECTA -->
                  <div class="grid grid-cols-2 gap-2 pt-1">
                    
                    <!-- ENTREGADOS -->
                    <div class="bg-blue-50/70 p-2 rounded-xl border border-blue-200/80 space-y-1 overflow-hidden">
                      <div class="flex justify-between items-center text-[9px] font-extrabold text-blue-900 uppercase">
                        <span>Entreg.</span>
                        <i class="fa-solid fa-arrow-up text-blue-600 text-[9px] shrink-0"></i>
                      </div>
                      <div class="flex items-center justify-center gap-1 mt-1">
                        <input type="text" readonly id="env-entregados-${conductorNombre}-${idx}" value="${env.entregados}" onclick="abrirTecladoNumerico(this, 'Carros Entregados')" title="Toca para abrir teclado" placeholder="0" class="w-full bg-white border border-blue-300 rounded-lg py-1 text-sm text-blue-950 font-black text-center cursor-pointer hover:border-blue-500 focus:outline-none shadow-inner">
                      </div>
                    </div>

                    <!-- RECOGIDOS -->
                    <div class="bg-indigo-50/70 p-2 rounded-xl border border-indigo-200/80 space-y-1 overflow-hidden">
                      <div class="flex justify-between items-center text-[9px] font-extrabold text-indigo-900 uppercase">
                        <span>Recog.</span>
                        <i class="fa-solid fa-arrow-down text-indigo-600 text-[9px] shrink-0"></i>
                      </div>
                      <div class="flex items-center justify-center gap-1 mt-1">
                        <input type="text" readonly id="env-recogidos-${conductorNombre}-${idx}" value="${env.recogidos}" onclick="abrirTecladoNumerico(this, 'Carros Recogidos')" title="Toca para abrir teclado" placeholder="0" class="w-full bg-white border border-indigo-300 rounded-lg py-1 text-sm text-indigo-950 font-black text-center cursor-pointer hover:border-indigo-500 focus:outline-none shadow-inner">
                      </div>
                    </div>

                  </div>

                  <!-- BOTÓN DE GUARDADO RÁPIDO CON RETROALIMENTACIÓN -->
                  <button type="button" onclick="guardarEnvasesCliente('${conductorNombre}', '${clienteNombre.replace(/'/g, "\\'")}', ${idx})" class="w-full py-1.5 ${env.completado ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'} text-xs font-black rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5 active:scale-98">
                    <i class="fa-solid ${env.completado ? 'fa-check' : 'fa-floppy-disk'}"></i>
                    <span>${env.completado ? 'Guardado ✓' : 'Guardar Parada'}</span>
                  </button>

                </div>
              `;
            }).join('')}
          </div>

        </div>
      </div>
    `;
  }).join('');
}

window.ajustarEnvasesPaso = function(conductor, clienteNombre, idx, campo, delta) {
  const el = document.getElementById(`env-${campo}-${conductor}-${idx}`);
  if (!el) return;
  let val = parseInt(el.value || 0, 10);
  if (isNaN(val)) val = 0;
  val += delta;
  if (val < 0) val = 0;
  el.value = val;

  const key = `${conductor}_${clienteNombre}`;
  if (!envasesPorClienteRuta[key]) {
    envasesPorClienteRuta[key] = { entregados: 0, recogidos: 0, completado: false };
  }
  envasesPorClienteRuta[key][campo] = val;
  guardarDatosEnLocal();
};

window.filtrarParadasRutaActiva = function(conductor, texto) {
  const q = (texto || '').toLowerCase().trim();
  const tarjetas = document.querySelectorAll(`[data-cliente-card-conductor="${conductor}"], [data-cliente-card-chofer="${conductor}"]`);
  tarjetas.forEach(tarjeta => {
    const nombre = tarjeta.dataset.clienteNombre || '';
    const dir = tarjeta.dataset.clienteDir || '';
    if (!q || nombre.includes(q) || dir.includes(q)) {
      tarjeta.classList.remove('hidden');
    } else {
      tarjeta.classList.add('hidden');
    }
  });
};

window.mostrarToastLogistica = function(msg) {
  let toastCont = document.getElementById('toast-logistica-container');
  if (!toastCont) {
    toastCont = document.createElement('div');
    toastCont.id = 'toast-logistica-container';
    toastCont.className = 'fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none max-w-sm';
    document.body.appendChild(toastCont);
  }

  const t = document.createElement('div');
  t.className = 'bg-slate-900/95 text-white text-xs font-bold px-4 py-3 rounded-xl shadow-2xl backdrop-blur-sm border border-slate-700/60 flex items-center gap-2.5 transition-all duration-300 transform translate-y-4 opacity-0 pointer-events-auto';
  t.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-400 text-sm shrink-0"></i><span>${msg}</span>`;
  toastCont.appendChild(t);

  requestAnimationFrame(() => {
    t.classList.remove('translate-y-4', 'opacity-0');
  });

  setTimeout(() => {
    t.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => t.remove(), 300);
  }, 3200);
};

window.abrirNavegacionGPSCliente = function(clienteNombre) {
  if (!clienteNombre) return;

  const cli = (typeof clientes !== 'undefined' && Array.isArray(clientes))
    ? clientes.find(c => c.nombre && c.nombre.trim().toLowerCase() === clienteNombre.trim().toLowerCase())
    : null;

  let url = '';

  if (cli && cli.ubicacion && cli.ubicacion.trim()) {
    const u = cli.ubicacion.trim();
    if (u.startsWith('http://') || u.startsWith('https://')) {
      url = u;
    } else {
      url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(u)}`;
    }
  } else {
    const partes = [];
    if (cli) {
      if (cli.nombre) partes.push(cli.nombre);
      if (cli.direccion) partes.push(cli.direccion);
      if (cli.zona) partes.push(cli.zona);
    } else {
      partes.push(clienteNombre);
    }
    const destino = partes.join(', ');
    url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}`;
  }

  window.open(url, '_blank');
};

window.toggleAcordeonConductor = function(conductorNombre) {
  if (conductorAcordeonAbierto === conductorNombre || choferAcordeonAbierto === conductorNombre) {
    conductorAcordeonAbierto = null;
    choferAcordeonAbierto = null;
  } else {
    conductorAcordeonAbierto = conductorNombre;
    choferAcordeonAbierto = conductorNombre;
  }
  const conductoresEnRuta = Object.keys(serviciosActivos);
  renderAcordeonRutasActivas(conductoresEnRuta);
};
window.toggleAcordeonChofer = window.toggleAcordeonConductor;

window.guardarEnvasesCliente = function(conductor, clienteNombre, idx) {
  const elEnt = document.getElementById(`env-entregados-${conductor}-${idx}`);
  const elRec = document.getElementById(`env-recogidos-${conductor}-${idx}`);

  const entregados = elEnt ? parseInt(elEnt.value || 0, 10) || 0 : 0;
  const recogidos = elRec ? parseInt(elRec.value || 0, 10) || 0 : 0;
  const key = `${conductor}_${clienteNombre}`;

  envasesPorClienteRuta[key] = {
    entregados: entregados,
    recogidos: recogidos,
    completado: true
  };

  guardarDatosEnLocal();
  actualizarEstadoFichajeInterfaz();
  mostrarToastLogistica(`✓ Parada guardada (${clienteNombre}): ${entregados} entregados | ${recogidos} recogidos`);
};

window.prepararCierreRutaModal = function(conductorTarget, rutaId = null) {
  const modal = document.getElementById('modal-cierre-final');
  const inputTarget = document.getElementById('cierre-conductor-target') || document.getElementById('cierre-chofer-target');
  let inputRutaId = document.getElementById('cierre-ruta-id');
  const titModal = document.getElementById('cierre-modal-titulo');

  if (modal && inputTarget) {
    inputTarget.value = conductorTarget || '';
    if (!inputRutaId) {
      inputRutaId = document.createElement('input');
      inputRutaId.type = 'hidden';
      inputRutaId.id = 'cierre-ruta-id';
      modal.querySelector('form')?.appendChild(inputRutaId);
    }
    inputRutaId.value = rutaId || '';

    if (titModal) {
      titModal.innerText = conductorTarget ? `Cierre de Ruta - ${conductorTarget}` : 'Cierre de Ruta';
    }
    modal.classList.remove('hidden');
  }
};

window.toggleModalCierreFinal = function(show) {
  const m = document.getElementById('modal-cierre-final');
  if (m) m.classList.toggle('hidden', !show);
};

window.confirmarCierreRutaDefinitivo = async function(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  const conductorTarget = (document.getElementById('cierre-conductor-target') || document.getElementById('cierre-chofer-target'))?.value;
  const rutaIdTarget = document.getElementById('cierre-ruta-id')?.value;

  const kmInput = document.getElementById('cierre-km');
  const obsInput = document.getElementById('cierre-observaciones');

  const km = kmInput ? (kmInput.value.trim() || 'No especificado') : 'No especificado';
  const obs = obsInput ? (obsInput.value.trim() || 'Sin observaciones') : 'Sin observaciones';

  const servicio = (typeof serviciosActivos !== 'undefined' && conductorTarget) ? serviciosActivos[conductorTarget] : null;
  const condKey = servicio?.conductor || servicio?.chofer || conductorTarget;

  // RECOPILAMOS EL DETALLE DE CARROS POR CLIENTE (con valores guardados o en pantalla)
  const detalleClientes = [];
  if (servicio && servicio.clientes && servicio.clientes.length > 0) {
    servicio.clientes.forEach((clienteNombre, cIdx) => {
      const key = `${condKey}_${clienteNombre}`;
      const env = (typeof envasesPorClienteRuta !== 'undefined') ? envasesPorClienteRuta[key] : null;
      const elEnt = document.getElementById(`env-entregados-${conductorTarget}-${cIdx}`) || document.getElementById(`env-entregados-${condKey}-${cIdx}`);
      const elRec = document.getElementById(`env-recogidos-${conductorTarget}-${cIdx}`) || document.getElementById(`env-recogidos-${condKey}-${cIdx}`);
      const entregados = elEnt ? (parseInt(elEnt.value, 10) || 0) : (env?.entregados || 0);
      const recogidos = elRec ? (parseInt(elRec.value, 10) || 0) : (env?.recogidos || 0);
      detalleClientes.push({
        cliente: clienteNombre,
        entregados: entregados,
        recogidos: recogidos
      });
    });
  }

  // Identificar el ID de la ruta
  let targetRutaId = rutaIdTarget || servicio?.rutaId;
  if (!targetRutaId && conductorTarget) {
    const rutaEncontrada = (typeof rutas !== 'undefined' && Array.isArray(rutas))
      ? rutas.find(r => 
          (r.conductor === conductorTarget || r.chofer === conductorTarget) &&
          r.estado !== 'completada' && r.estado !== 'finalizada' && r.estado !== 'archivada'
        )
      : null;
    if (rutaEncontrada) targetRutaId = rutaEncontrada.id;
  }

  if (targetRutaId) {
    await finalizarRuta(targetRutaId, {
      km: km,
      obs: obs,
      detalleClientes: detalleClientes.length > 0 ? detalleClientes : undefined,
      conductor: conductorTarget || condKey,
      chofer: conductorTarget || condKey,
      camion: servicio?.camion,
      dia: servicio?.dia
    });
  } else if (servicio) {
    const fechaHoy = new Date().toISOString().split('T')[0];
    const horaFin = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const rutaFinalizadaHistorial = {
      id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      fecha: fechaHoy,
      dia: servicio.dia || 'General',
      conductor: condKey,
      chofer: condKey,
      camion: servicio.camion,
      rutaNombre: servicio.rutaNombre || 'Ruta Libre',
      km: km,
      obs: obs,
      horaInicio: servicio.inicio || '08:00',
      horaFin: horaFin,
      detalleClientes: detalleClientes,
      estado: 'completada'
    };
    historialFinalizadas.unshift(rutaFinalizadaHistorial);
    if (typeof camiones !== 'undefined') {
      const c = camiones.find(v => v.matricula === servicio.camion);
      if (c) c.estado = 'Libre';
    }
    delete serviciosActivos[conductorTarget];
    if (conductorAcordeonAbierto === conductorTarget || choferAcordeonAbierto === conductorTarget) {
      conductorAcordeonAbierto = null;
      choferAcordeonAbierto = null;
    }
    guardarDatosEnLocal();
    if (typeof refrescarVistasRutas === 'function') refrescarVistasRutas();
  } else {
    alert('No se ha encontrado ninguna ruta para finalizar.');
    return;
  }

  if (kmInput) kmInput.value = '';
  if (obsInput) obsInput.value = '';
  const inputRutaId = document.getElementById('cierre-ruta-id');
  if (inputRutaId) inputRutaId.value = '';

  toggleModalCierreFinal(false);

  // Mostrar modal de finalización con el cálculo exacto de tiempo y sincronización con Supabase
  await finalizarRutaConductor(targetRutaId, conductorTarget);

  renderModuloLogistica();
  if (typeof refrescarVistasRutas === 'function') {
    refrescarVistasRutas();
  }
  mostrarToastLogistica(`✓ Ruta Finalizada para ${conductorTarget || 'el conductor'}. Guardada en su historial y retirada de disponibles.`);
};

window.enviarAlertaUltimaHora = function() {
  const msg = prompt('Introduce la notificación urgente para la PDA:', 'Llevar 3 jaulas vacías a Las Vegas');
  if (msg) alert(`🚨 [NOTIFICACIÓN PUSH ENVIADA]\n\n" ${msg} "`);
};

function actualizarSelectorRutasParaConductorInicio(conductorNombre) {
  const containerRutasAsignadas = document.getElementById('contenedor-selector-ruta-inicio');
  if (!containerRutasAsignadas) return;

  const rutasDelConductor = rutas.filter(r => 
    (r.conductor || r.chofer) && (r.conductor || r.chofer).trim().toLowerCase() === conductorNombre.trim().toLowerCase() &&
    r.estado !== 'completada' && r.estado !== 'finalizada' && r.estado !== 'archivada'
  );

  if (rutasDelConductor.length === 0) {
    containerRutasAsignadas.innerHTML = `<p class="text-xs text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-200">El conductor no tiene rutas específicas asignadas o todas han sido finalizadas.</p>`;
    const inputRutaOculto = document.getElementById('fichaje-ruta-seleccionada-idx');
    if (inputRutaOculto) inputRutaOculto.value = '';
    return;
  }

  containerRutasAsignadas.innerHTML = `
    <div class="space-y-3">
      <label class="block text-xs font-extrabold text-blue-900 uppercase">Selecciona la Ruta y Jornada Asignada:</label>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
        ${rutasDelConductor.map((r, idx) => `
          <div onclick="fijarRutaInicioSeleccionada(${idx}, '${r.dia}', '${r.camion || ''}')" class="bg-white p-3 rounded-xl border border-slate-200 hover:border-blue-500 cursor-pointer transition-all space-y-1 shadow-2xs group">
            <div class="flex justify-between items-center">
              <span class="font-extrabold text-xs text-blue-900 uppercase bg-blue-50 px-2 py-0.5 rounded">📅 ${r.dia} - Ruta ${idx + 1}</span>
              <span class="text-[11px] font-bold text-slate-600">🚛 ${r.camion || 'Sin vehículo fijo'}</span>
            </div>
            <div class="text-[11px] text-slate-600 pt-1">
              <p class="font-semibold text-slate-700">Clientes (${r.clientes ? r.clientes.length : 0}):</p>
              <p class="italic text-slate-500 truncate">${r.clientes && r.clientes.length > 0 ? r.clientes.map(c => typeof c === 'object' && c !== null ? (c.nombre || c.name || '') : c).join(', ') : 'Ninguno'}</p>
            </div>
          </div>
        `).join('')}
      </div>
      <input type="hidden" id="fichaje-ruta-seleccionada-idx" value="">
    </div>
  `;
}
window.actualizarSelectorRutasParaConductorInicio = actualizarSelectorRutasParaConductorInicio;
window.actualizarSelectorRutasParaChoferInicio = actualizarSelectorRutasParaConductorInicio;

window.fijarRutaInicioSeleccionada = function(idxRuta, dia, camionSugerido) {
  const conductorInput = document.getElementById('fichaje-conductor-input') || document.getElementById('fichaje-chofer-input');
  if (!conductorInput) return;

  const rutasConductorActual = rutas.filter(r => 
    ((r.conductor || r.chofer || '').trim().toLowerCase() === (conductorInput.value || '').trim().toLowerCase()) && 
    r.estado !== 'completada' && r.estado !== 'finalizada' && r.estado !== 'archivada'
  );
  const rutaElegida = rutasConductorActual[idxRuta];
  if (!rutaElegida) return;

  const inputOculto = document.getElementById('fichaje-ruta-seleccionada-idx');
  if (inputOculto) inputOculto.value = idxRuta;

  if (camionSugerido && camionSugerido !== '') {
    seleccionarCamionInicio(camionSugerido, '');
  }

  mostrarToastLogistica(`✓ Ruta seleccionada (${dia}): ${rutaElegida.clientes ? rutaElegida.clientes.length : 0} clientes cargados.`);
};

/* --- VISUALIZACIÓN DE RUTAS POR CONDUCTOR (CUADRÍCULA & PANEL DETALLADO POR DÍAS) --- */
let conductorRutasSeleccionado = null;
let choferRutasSeleccionado = null;
let filtroDiaRutasConductor = 'Todos';
let filtroDiaRutasChofer = 'Todos';

window.filtrarDiaDetalleRutas = function(dia) {
  filtroDiaRutasConductor = dia;
  filtroDiaRutasChofer = dia;
  const sel = conductorRutasSeleccionado || choferRutasSeleccionado;
  if (sel) {
    verDetalleRutasConductor(sel);
  }
};

window.iniciarRutaDirectaDesdePortal = function(conductorNombre, dia, rutaIdx, rutaIdParam = null) {
  if (serviciosActivos && serviciosActivos[conductorNombre]) {
    alert(`El conductor ${conductorNombre} ya tiene una ruta activa en curso (${serviciosActivos[conductorNombre].rutaNombre || 'Ruta'}). Debes finalizarla antes de iniciar otra.`);
    return;
  }

  let rutaElegida = null;
  if (rutaIdParam) {
    rutaElegida = rutas.find(r => r.id === rutaIdParam);
  }
  if (!rutaElegida) {
    const rutasDelConductorDia = (typeof rutas !== 'undefined' && Array.isArray(rutas))
      ? rutas.filter(r => 
          (r.conductor || r.chofer) && (r.conductor || r.chofer).trim().toLowerCase() === conductorNombre.trim().toLowerCase() && 
          r.dia && r.dia.trim().toLowerCase() === dia.trim().toLowerCase()
        )
      : [];
    rutaElegida = rutasDelConductorDia[rutaIdx];
  }

  if (!rutaElegida) {
    alert('No se ha encontrado la ruta seleccionada.');
    return;
  }

  if (rutaElegida.estado === 'completada' || rutaElegida.estado === 'finalizada') {
    alert('Esta ruta ya ha sido finalizada y no se puede volver a iniciar.');
    return;
  }

  const camionFinal = rutaElegida.camion || (camiones.find(c => c.estado === 'Libre' || !c.estado)?.matricula) || '4589-KLL';

  ejecutarInicioServicioDefinitivo(conductorNombre, camionFinal, dia, rutaIdx, rutaElegida.id);
  if (typeof switchTab === 'function') switchTab('logistica');
  mostrarToastLogistica(`🚀 Ruta iniciada para ${conductorNombre}: ${dia} - Ruta ${rutaIdx + 1}`);
};

function asegurarEstructuraVisualizacionRutas() {
  const seccion = document.getElementById('section-vista-conductor') || document.getElementById('section-vista-chofer');
  if (!seccion) return null;

  let grid = document.getElementById('grid-conductores-rutas') || document.getElementById('grid-choferes-rutas');
  let panel = document.getElementById('panel-detalle-rutas-conductor') || document.getElementById('panel-detalle-rutas-chofer');

  // Si no existen los contenedores nuevos (por ejemplo, si aún estuviese el select anterior), los creamos dinámicamente
  if (!grid || !panel) {
    seccion.innerHTML = `
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 class="text-xl sm:text-2xl font-extrabold text-blue-950 flex items-center gap-2.5">
            <i class="fa-solid fa-route text-indigo-600"></i> Visualización de Rutas por Conductor
          </h2>
          <p class="text-sm text-slate-500 mt-0.5">Selecciona la tarjeta de un conductor para consultar su planificación semanal de rutas por días.</p>
        </div>
      </div>

      <!-- CUADRÍCULA (GRID) CON LAS TARJETAS DE TODOS LOS CONDUCTORES -->
      <div id="grid-conductores-rutas" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"></div>

      <!-- PANEL DETALLADO DE RUTAS DEL CONDUCTOR POR DÍAS -->
      <div id="panel-detalle-rutas-conductor" class="hidden light-card rounded-2xl p-6 sm:p-8 border border-indigo-200 space-y-6">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
          <div class="flex items-center gap-4">
            <button onclick="cerrarDetalleRutasConductor()" class="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center text-base transition-colors cursor-pointer" title="Volver a la cuadrícula de conductores">
              <i class="fa-solid fa-arrow-left"></i>
            </button>
            <div id="detalle-conductor-avatar-container" class="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg overflow-hidden border border-indigo-200 shrink-0">
              <i class="fa-solid fa-user"></i>
            </div>
            <div>
              <h3 id="detalle-conductor-nombre-titulo" class="text-2xl font-extrabold text-blue-950">Nombre Conductor</h3>
              <p id="detalle-conductor-info-subtitulo" class="text-xs sm:text-sm text-slate-500">DNI: - | Tel: -</p>
            </div>
          </div>
          <span id="badge-total-rutas-conductor-semana" class="px-4 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs sm:text-sm font-bold">
            0 Rutas Asignadas
          </span>
        </div>

        <!-- SELECTOR INTERACTIVO POR DÍAS DE LA SEMANA -->
        <div id="filtro-dias-semana-conductor-container" class="flex flex-wrap gap-1.5 border-b border-slate-100 pb-4"></div>

        <div id="contenedor-desglose-rutas-por-dias" class="space-y-6"></div>
      </div>
    `;
    grid = document.getElementById('grid-conductores-rutas') || document.getElementById('grid-choferes-rutas');
    panel = document.getElementById('panel-detalle-rutas-conductor') || document.getElementById('panel-detalle-rutas-chofer');
  }

  return { grid, panel };
}

window.renderVisualizacionRutasConductores = function() {
  const containers = asegurarEstructuraVisualizacionRutas();
  if (!containers) return;
  const { grid, panel } = containers;

  const sel = conductorRutasSeleccionado || choferRutasSeleccionado;
  // Si no hay un conductor seleccionado actualmente para ver detalles, mostramos la cuadrícula
  if (!sel) {
    if (grid) grid.classList.remove('hidden');
    if (panel) panel.classList.add('hidden');
  } else {
    // Si ya había uno seleccionado, refrescamos su panel detallado
    verDetalleRutasConductor(sel);
    return;
  }

  if (!grid) return;

  const lista = (typeof conductores !== 'undefined' && Array.isArray(conductores)) ? conductores : ((typeof choferes !== 'undefined') ? choferes : []);
  if (!lista || lista.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full light-card rounded-2xl p-10 text-center space-y-3 border border-slate-200">
        <div class="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-2xl">
          <i class="fa-solid fa-users-slash"></i>
        </div>
        <h4 class="font-bold text-slate-700 text-base">No hay conductores registrados</h4>
        <p class="text-xs text-slate-400">Registra conductores desde la pestaña de Conductores / Personal para asignarles rutas semanales.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = lista.map(ch => {
    const esRutaFinalizada = r => Boolean(
      r && (
        r.status === 'completed' ||
        r.estado === 'completada' ||
        r.estado === 'finalizada' ||
        r.estado === 'archivada' ||
        r.status === 'finalizada'
      )
    );

    const rutasDelConductor = (typeof rutas !== 'undefined' && Array.isArray(rutas)) 
      ? rutas.filter(r => 
          (r.conductor || r.chofer) && 
          (r.conductor || r.chofer).trim().toLowerCase() === ch.nombre.trim().toLowerCase() &&
          !esRutaFinalizada(r)
        ) 
      : [];
    const diasConRuta = new Set(rutasDelConductor.map(r => r.dia)).size;
    const estaEnRuta = !!(serviciosActivos && serviciosActivos[ch.nombre]);

    // Mini-resumen de días con ruta asignada
    const diasAbreviados = { 'Lunes': 'L', 'Martes': 'M', 'Miércoles': 'X', 'Jueves': 'J', 'Viernes': 'V', 'Sábado': 'S', 'Domingo': 'D' };
    const diasActivos = new Set(rutasDelConductor.map(r => r.dia));
    const totalClientes = rutasDelConductor.reduce((sum, r) => sum + (r.clientes ? r.clientes.length : 0), 0);

    return `
      <div onclick="verDetalleRutasConductor('${ch.nombre.replace(/'/g, "\\'")}')" class="light-card light-card-hover rounded-2xl p-4 border ${estaEnRuta ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200'} cursor-pointer hover:border-indigo-400 hover:shadow-md transition-all group flex flex-col justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-xl ${estaEnRuta ? 'bg-emerald-100 text-emerald-600 border-emerald-200' : 'bg-indigo-50 text-indigo-600 border-indigo-100'} flex items-center justify-center overflow-hidden border-2 group-hover:border-indigo-500 transition-all shadow-inner shrink-0">
            ${(ch.foto && (typeof esFotoValida !== 'function' || esFotoValida(ch.foto))) 
              ? `<img src="${ch.foto}" class="w-full h-full object-cover" alt="${ch.nombre}" onerror="this.onerror=null; this.parentElement.innerHTML='<i class=\\\'fa-solid fa-user text-lg\\\'></i>';">` 
              : '<i class="fa-solid fa-user text-lg"></i>'}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <h3 class="font-extrabold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors truncate">${ch.nombre}</h3>
              ${estaEnRuta ? '<span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" title="En ruta activa"></span>' : ''}
            </div>
            <p class="text-[11px] text-slate-500 truncate">DNI: <span class="font-semibold text-slate-700">${ch.dni || '-'}</span>${ch.telefono ? ' · ' + ch.telefono : ''}</p>
          </div>
          <span class="w-7 h-7 rounded-lg bg-slate-50 group-hover:bg-indigo-50 text-slate-400 group-hover:text-indigo-600 flex items-center justify-center transition-all shrink-0">
            <i class="fa-solid fa-chevron-right text-[10px]"></i>
          </span>
        </div>

        <!-- Mini calendario semanal compacto -->
        <div class="flex items-center justify-between gap-2">
          <div class="flex gap-0.5">
            ${['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'].map(d => {
              const activo = diasActivos.has(d);
              return `<span class="w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center ${activo ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}" title="${d}">${diasAbreviados[d]}</span>`;
            }).join('')}
          </div>
          <div class="flex items-center gap-1.5 text-[10px]">
            <span class="font-bold text-indigo-700">${rutasDelConductor.length}r</span>
            <span class="text-slate-300">·</span>
            <span class="font-bold text-slate-600">${totalClientes}c</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
};
window.renderVisualizacionRutasChoferes = window.renderVisualizacionRutasConductores;

window.verDetalleRutasConductor = function(nombreConductor) {
  conductorRutasSeleccionado = nombreConductor;
  choferRutasSeleccionado = nombreConductor;
  const containers = asegurarEstructuraVisualizacionRutas();
  if (!containers) return;
  const { grid, panel } = containers;

  if (grid) grid.classList.add('hidden');
  if (panel) panel.classList.remove('hidden');

  const lista = (typeof conductores !== 'undefined' && Array.isArray(conductores)) ? conductores : ((typeof choferes !== 'undefined') ? choferes : []);
  const ch = (lista.find(c => c.nombre.trim().toLowerCase() === nombreConductor.trim().toLowerCase()) || null) || {
    nombre: nombreConductor,
    dni: 'No especificado',
    foto: '',
    telefono: ''
  };

  // Actualizar cabecera del panel detallado
  const titNombre = document.getElementById('detalle-conductor-nombre-titulo') || document.getElementById('detalle-chofer-nombre-titulo');
  const subInfo = document.getElementById('detalle-conductor-info-subtitulo') || document.getElementById('detalle-chofer-info-subtitulo');
  const avatarCont = document.getElementById('detalle-conductor-avatar-container') || document.getElementById('detalle-chofer-avatar-container');
  const badgeTotal = document.getElementById('badge-total-rutas-conductor-semana') || document.getElementById('badge-total-rutas-chofer-semana');

  if (titNombre) titNombre.innerText = ch.nombre;
  if (subInfo) subInfo.innerText = `DNI: ${ch.dni || 'No especificado'}${ch.telefono ? ' | Tel: ' + ch.telefono : ''}`;
  if (avatarCont) {
    avatarCont.innerHTML = (ch.foto && (typeof esFotoValida !== 'function' || esFotoValida(ch.foto))) 
      ? `<img src="${ch.foto}" class="w-full h-full object-cover" alt="${ch.nombre}" onerror="this.onerror=null; this.parentElement.innerHTML='<i class=\\\'fa-solid fa-user text-xl\\\'></i>';">` 
      : `<i class="fa-solid fa-user text-xl"></i>`;
  }

  const contenedorDias = document.getElementById('contenedor-desglose-rutas-por-dias');
  if (!contenedorDias) return;

  const diasOrdenados = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const esRutaFinalizada = r => Boolean(
    r && (
      r.status === 'completed' ||
      r.estado === 'completada' ||
      r.estado === 'finalizada' ||
      r.estado === 'archivada' ||
      r.status === 'finalizada'
    )
  );

  const rutasDelConductor = (typeof rutas !== 'undefined' && Array.isArray(rutas))
    ? rutas.filter(r => 
        (r.conductor || r.chofer) && 
        (r.conductor || r.chofer).trim().toLowerCase() === nombreConductor.trim().toLowerCase() &&
        !esRutaFinalizada(r)
      )
    : [];

  if (badgeTotal) {
    badgeTotal.innerText = `${rutasDelConductor.length} ${rutasDelConductor.length === 1 ? 'Ruta Asignada' : 'Rutas Asignadas en Total'}`;
  }

  // Comprobar días con rutas asignadas
  const diasConRutas = diasOrdenados.filter(dia => 
    rutasDelConductor.some(r => r.dia && r.dia.trim().toLowerCase() === dia.trim().toLowerCase())
  );

  // Renderizar pills de selector de días de la semana
  const mapaDiasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const diaHoy = mapaDiasSemana[new Date().getDay()];
  const contenedorPills = document.getElementById('filtro-dias-semana-conductor-container') || document.getElementById('filtro-dias-semana-chofer-container');

  const filtroActual = filtroDiaRutasConductor || filtroDiaRutasChofer || 'Todos';

  if (contenedorPills) {
    contenedorPills.innerHTML = `
      <button onclick="filtrarDiaDetalleRutas('Todos')" class="px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${filtroActual === 'Todos' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}">
        Todos (${rutasDelConductor.length})
      </button>
      ${diasOrdenados.map(d => {
        const numRutasDia = rutasDelConductor.filter(r => r.dia && r.dia.trim().toLowerCase() === d.trim().toLowerCase()).length;
        const esHoy = (d === diaHoy);
        const estaSeleccionado = (filtroActual === d);

        return `
          <button onclick="filtrarDiaDetalleRutas('${d}')" class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${estaSeleccionado ? 'bg-indigo-600 text-white shadow-xs' : (numRutasDia > 0 ? 'bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100' : 'bg-slate-50 text-slate-400 border border-slate-200')}">
            <span>${d}</span>
            ${esHoy ? '<span class="text-[9px] px-1 bg-amber-400 text-amber-950 font-black rounded">HOY</span>' : ''}
            <span class="text-[10px] font-black ${estaSeleccionado ? 'text-indigo-200' : 'text-indigo-600'}">(${numRutasDia})</span>
          </button>
        `;
      }).join('')}
    `;
  }

  // Filtrar los días a mostrar según la pestaña activa
  let diasParaMostrar = diasConRutas;
  if (filtroActual !== 'Todos') {
    diasParaMostrar = diasConRutas.filter(d => d.trim().toLowerCase() === filtroActual.trim().toLowerCase());
  }

  if (diasConRutas.length === 0) {
    contenedorDias.innerHTML = `
      <div class="light-card rounded-2xl p-10 text-center space-y-3 border border-slate-200">
        <div class="w-16 h-16 rounded-full bg-indigo-50 text-indigo-400 flex items-center justify-center mx-auto text-2xl">
          <i class="fa-solid fa-calendar-xmark"></i>
        </div>
        <h4 class="font-extrabold text-slate-800 text-base">Sin rutas asignadas</h4>
        <p class="text-xs text-slate-500 max-w-md mx-auto">
          El conductor <strong>${ch.nombre}</strong> no tiene rutas asignadas para ningún día de la semana.
          Puedes añadirle rutas desde la sección <strong>Planificación de la Semana</strong>.
        </p>
      </div>
    `;
    return;
  }

  if (diasParaMostrar.length === 0 && filtroActual !== 'Todos') {
    contenedorDias.innerHTML = `
      <div class="light-card rounded-2xl p-8 text-center space-y-3 border border-slate-200">
        <div class="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-xl">
          <i class="fa-solid fa-calendar-day"></i>
        </div>
        <h4 class="font-extrabold text-slate-700 text-sm">Sin rutas para el ${filtroActual}</h4>
        <p class="text-xs text-slate-400">El conductor no tiene recorridos programados para este día de la semana.</p>
        <button onclick="filtrarDiaDetalleRutas('Todos')" class="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 cursor-pointer">
          Ver todos los días
        </button>
      </div>
    `;
    return;
  }

  // Renderizar las rutas organizadas y separadas por días de la semana
  contenedorDias.innerHTML = diasParaMostrar.map(dia => {
    const rutasDelDia = rutasDelConductor.filter(r => r.dia && r.dia.trim().toLowerCase() === dia.trim().toLowerCase());
    const esDiaHoy = (dia === diaHoy);

    return `
      <div class="light-card rounded-2xl p-5 sm:p-6 border ${esDiaHoy ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-indigo-200'} space-y-4 bg-white shadow-xs">
        
        <!-- CABECERA DEL DÍA CON DISTINTIVO -->
        <div class="flex justify-between items-center border-b border-indigo-100 pb-3">
          <div class="flex items-center gap-3">
            <span class="w-3.5 h-3.5 rounded-full ${esDiaHoy ? 'bg-amber-500 animate-pulse' : 'bg-indigo-600'} shrink-0"></span>
            <div class="flex items-center gap-2">
              <h4 class="font-black text-blue-950 text-base uppercase tracking-wide flex items-center gap-2">
                <i class="fa-solid fa-calendar-day text-indigo-600"></i> ${dia}
              </h4>
              ${esDiaHoy ? '<span class="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-black">JORNADA DE HOY</span>' : ''}
            </div>
          </div>
          <span class="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-extrabold">
            ${rutasDelDia.length} ${rutasDelDia.length === 1 ? 'Ruta Asignada' : 'Rutas Asignadas'}
          </span>
        </div>

        <!-- LISTADO DE RUTAS DE ESTE DÍA (SEPARADAS Y ETIQUETADAS COMO 'Ruta 1', 'Ruta 2', etc.) -->
        <div class="space-y-4">
          ${rutasDelDia.map((r, rIdx) => {
            const tipoRutaNorm = r.tipoCliente ? (typeof normalizarTipoCliente === 'function' ? normalizarTipoCliente(r.tipoCliente) : r.tipoCliente) : '';
            return `
            <div class="bg-slate-50/90 rounded-2xl p-4 sm:p-5 border border-slate-200 space-y-3.5 hover:border-indigo-300 transition-all shadow-2xs">
              
              <!-- ENCABEZADO DE LA RUTA Y ACCIÓN DE INICIO DIRECTO -->
              <div class="flex flex-wrap justify-between items-center gap-2 border-b border-slate-200/80 pb-3">
                <div class="flex items-center gap-2.5 flex-wrap">
                  <span class="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
                    <i class="fa-solid fa-route"></i> Ruta ${rIdx + 1}
                  </span>
                  <span class="px-3 py-1.5 bg-white text-slate-800 rounded-xl text-xs font-bold border border-slate-200 flex items-center gap-1.5 shadow-2xs">
                    <i class="fa-solid fa-truck text-blue-600"></i> Vehículo: <strong class="text-blue-950">${r.camion || 'No asignado'}</strong>
                  </span>
                  ${tipoRutaNorm ? `<span class="px-2.5 py-1 bg-purple-50 text-purple-700 rounded-lg text-xs font-semibold border border-purple-200">${tipoRutaNorm}</span>` : ''}
                  <span class="text-xs font-bold text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                    <i class="fa-solid fa-shop text-slate-400 mr-1"></i>${r.clientes ? r.clientes.length : 0} ${r.clientes && r.clientes.length === 1 ? 'establecimiento' : 'establecimientos'}
                  </span>
                </div>

                <!-- BOTÓN PARA INICIAR ESTA RUTA DIRECTAMENTE DESDE EL PORTAL -->
                <button type="button" onclick="iniciarRutaDirectaDesdePortal('${ch.nombre.replace(/'/g, "\\'")}', '${dia}', ${rIdx}, '${r.id || ''}')" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer hover:scale-105 active:scale-95" title="Iniciar esta ruta en el Terminal de Logística">
                  <i class="fa-solid fa-play text-[10px]"></i> Iniciar Esta Ruta
                </button>
              </div>

              <!-- PARADAS / ESTABLECIMIENTOS ASIGNADOS A ESTA RUTA EN REJILLA COMPACTA -->
              <div>
                <p class="text-[11px] font-extrabold uppercase text-slate-500 tracking-wider mb-2.5 flex items-center gap-1.5">
                  <i class="fa-solid fa-list-check text-indigo-500"></i> Paradas y Establecimientos en esta ruta:
                </p>
                ${(!r.clientes || r.clientes.length === 0) 
                  ? '<p class="text-xs text-slate-400 italic py-2">No hay establecimientos asignados a esta ruta.</p>'
                  : `
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                      ${r.clientes.map((clienteItem, cIdx) => {
                        const clienteNombre = typeof clienteItem === 'object' && clienteItem !== null ? (clienteItem.nombre || clienteItem.name || '') : String(clienteItem || '');
                        const cliInfo = (typeof clientes !== 'undefined' && Array.isArray(clientes)) 
                          ? clientes.find(c => c.nombre && c.nombre.trim().toLowerCase() === clienteNombre.trim().toLowerCase()) 
                          : null;

                        const tipoNorm = cliInfo && cliInfo.tipo 
                          ? (typeof normalizarTipoCliente === 'function' ? normalizarTipoCliente(cliInfo.tipo) : cliInfo.tipo) 
                          : (r.tipoCliente ? (typeof normalizarTipoCliente === 'function' ? normalizarTipoCliente(r.tipoCliente) : r.tipoCliente) : '');
                        let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
                        if (tipoNorm === 'Hotel') badgeColor = 'bg-purple-100 text-purple-700 border-purple-200';
                        if (tipoNorm === 'Restaurante') badgeColor = 'bg-blue-100 text-blue-700 border-blue-200';
                        if (tipoNorm === 'Camping') badgeColor = 'bg-amber-100 text-amber-700 border-amber-200';
                        if (tipoNorm === 'Mixto') badgeColor = 'bg-emerald-100 text-emerald-700 border-emerald-200';

                        return `
                          <div class="bg-white p-3 rounded-xl border border-slate-200 hover:border-indigo-300 transition-all flex flex-col justify-between gap-2 shadow-2xs group">
                            
                            <!-- INFORMACIÓN DEL CLIENTE -->
                            <div class="space-y-1">
                              <div class="flex items-center justify-between gap-1">
                                <span class="w-5 h-5 rounded-md bg-blue-100 text-blue-800 font-black flex items-center justify-center text-[10px] shrink-0">
                                  ${cIdx + 1}
                                </span>
                                ${tipoNorm ? `<span class="text-[9px] px-1.5 py-0.5 rounded font-extrabold border ${badgeColor}">${tipoNorm}</span>` : ''}
                              </div>
                              <p class="font-extrabold text-slate-800 text-xs truncate" title="${clienteNombre}">
                                ${clienteNombre}
                              </p>
                              ${cliInfo && (cliInfo.zona || cliInfo.direccion) ? `
                                <p class="text-[10px] text-slate-400 truncate" title="${cliInfo.zona || ''} ${cliInfo.direccion || ''}">
                                  <i class="fa-solid fa-location-dot text-slate-300 mr-1"></i>${cliInfo.zona ? cliInfo.zona + ' ' : ''}${cliInfo.direccion ? '• ' + cliInfo.direccion : ''}
                                </p>
                              ` : '<p class="text-[10px] text-slate-300 italic">Sin dirección</p>'}
                            </div>

                            <!-- ACCIONES DIRECTAS (GPS COMPACTO Y TELÉFONO) -->
                            <div class="flex items-center justify-end gap-1.5 pt-1.5 border-t border-slate-100">
                              <button type="button" onclick="abrirNavegacionGPSCliente('${clienteNombre.replace(/'/g, "\\'")}')" class="w-6 h-6 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg flex items-center justify-center shadow-2xs transition-all cursor-pointer hover:scale-110 shrink-0" title="Abrir en Google Maps" aria-label="Abrir en Google Maps">
                                <i class="fa-solid fa-location-dot text-xs"></i>
                              </button>
                              ${cliInfo && cliInfo.telefono ? `
                                <a href="tel:${cliInfo.telefono}" class="w-6 h-6 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center border border-blue-200 transition-colors shadow-2xs hover:scale-110 shrink-0" title="Llamar: ${cliInfo.telefono}" aria-label="Llamar">
                                  <i class="fa-solid fa-phone text-[10px]"></i>
                                </a>
                              ` : ''}
                            </div>

                          </div>
                        `;
                      }).join('')}
                    </div>
                  `
                }
              </div>

            </div>
          `;
        }).join('')}
        </div>
      </div>
    `;
  }).join('');
};
window.verDetalleRutasChofer = window.verDetalleRutasConductor;

window.cerrarDetalleRutasConductor = function() {
  conductorRutasSeleccionado = null;
  choferRutasSeleccionado = null;
  filtroDiaRutasConductor = 'Todos';
  filtroDiaRutasChofer = 'Todos';
  const grid = document.getElementById('grid-conductores-rutas') || document.getElementById('grid-choferes-rutas');
  const panel = document.getElementById('panel-detalle-rutas-conductor') || document.getElementById('panel-detalle-rutas-chofer');
  if (grid) grid.classList.remove('hidden');
  if (panel) panel.classList.add('hidden');
};
window.cerrarDetalleRutasChofer = window.cerrarDetalleRutasConductor;

// Aliases para compatibilidad con llamadas existentes en el proyecto
window.actualizarSelectPortalConductores = window.renderVisualizacionRutasConductores;
window.actualizarSelectPortalChoferes = window.renderVisualizacionRutasConductores;
window.mostrarRutasConductor = window.verDetalleRutasConductor;
window.mostrarRutasChofer = window.verDetalleRutasConductor;
window.seleccionarConductorCentral = window.verDetalleRutasConductor;
window.abrirModalSelectorConductorCentralRutas = window.renderVisualizacionRutasConductores;

/* --- TECLADO NUMÉRICO TÁCTIL PARA CARROS --- */
let inputActivoTeclado = null;

window.abrirTecladoNumerico = function(inputEl, titulo) {
  inputActivoTeclado = inputEl;
  const modal = document.getElementById('modal-teclado-numerico');
  const spanValor = document.getElementById('teclado-valor-actual');
  const titEl = document.getElementById('teclado-titulo-input');

  if (titEl) titEl.innerText = titulo;
  if (spanValor) {
    spanValor.innerText = (inputEl.value === '' || inputEl.value === '0') ? '0' : inputEl.value;
  }
  if (modal) modal.classList.remove('hidden');
};

window.cerrarTecladoNumerico = function() {
  const modal = document.getElementById('modal-teclado-numerico');
  if (modal) modal.classList.add('hidden');
  inputActivoTeclado = null;
};

window.tecladoBotonClick = function(digito) {
  if (!inputActivoTeclado) return;
  const spanValor = document.getElementById('teclado-valor-actual');
  let actual = spanValor.innerText;

  if (actual === '0') {
    actual = digito;
  } else {
    actual += digito;
  }

  spanValor.innerText = actual;
  inputActivoTeclado.value = actual;
};

window.tecladoBotonBorrar = function() {
  if (!inputActivoTeclado) return;
  const spanValor = document.getElementById('teclado-valor-actual');
  let actual = spanValor.innerText;

  if (actual.length > 1) {
    actual = actual.slice(0, -1);
  } else {
    actual = '0';
  }

  spanValor.innerText = actual;
  inputActivoTeclado.value = actual;
};

window.tecladoBotonLimpiar = function() {
  if (!inputActivoTeclado) return;
  const spanValor = document.getElementById('teclado-valor-actual');
  spanValor.innerText = '0';
  inputActivoTeclado.value = '0';
};

/* --- HISTORIAL DE RUTAS FINALIZADAS Y DESPLIEGUE POR CONDUCTOR --- */
// La lógica completa de agrupación jerárquica por meses, rendimiento optimizado y renderizado
// está centralizada en js/admin.js (window.renderizarRutasFinalizadasConductor y window.toggleHistorialConductorDetalle).
if (typeof window.renderizarRutasFinalizadasConductor !== 'function') {
  window.renderizarRutasFinalizadasConductor = function(rutas) {
    const sel = window.conductorSeleccionadoActual || window.choferSeleccionadoActual;
    if (typeof verDetalleHistorialConductor === 'function' && sel) {
      verDetalleHistorialConductor(sel);
    } else if (typeof verDetalleHistorialChofer === 'function' && sel) {
      verDetalleHistorialChofer(sel);
    }
  };
}
window.renderizarRutasFinalizadasChofer = window.renderizarRutasFinalizadasConductor;

/* --- CONTROL DESPLEGABLE PERSONALIZADO DE MATRÍCULAS --- */
window.toggleDropdownCamiones = function() {
  const menu = document.getElementById('menu-dropdown-camion');
  if (menu) {
    menu.classList.toggle('hidden');
  }
};

window.seleccionarCamionRepostaje = function(matricula) {
  const inputHidden = document.getElementById('rep-camion');
  if (inputHidden) {
    inputHidden.value = matricula;
  }
  const spanTexto = document.getElementById('text-rep-camion');
  if (spanTexto) {
    spanTexto.textContent = matricula;
    spanTexto.classList.remove('text-slate-400', 'text-slate-500');
    spanTexto.classList.add('font-bold', 'text-blue-950');
  }
  const menu = document.getElementById('menu-dropdown-camion');
  if (menu && !menu.classList.contains('hidden')) {
    menu.classList.add('hidden');
  }
};

/* --- CONTROL DESPLEGABLE PERSONALIZADO DE CONDUCTORES --- */
window.toggleDropdownConductores = function() {
  const menu = document.getElementById('menu-dropdown-conductor') || document.getElementById('menu-dropdown-chofer');
  if (menu) {
    menu.classList.toggle('hidden');
  }
};
window.toggleDropdownChoferes = window.toggleDropdownConductores;

window.seleccionarConductorRepostaje = function(nombre) {
  const inputHidden = document.getElementById('rep-conductor') || document.getElementById('rep-chofer');
  if (inputHidden) {
    inputHidden.value = nombre;
  }
  const spanTexto = document.getElementById('text-rep-conductor') || document.getElementById('text-rep-chofer');
  if (spanTexto) {
    spanTexto.textContent = nombre;
    spanTexto.classList.remove('text-slate-400', 'text-slate-500');
    spanTexto.classList.add('font-bold', 'text-indigo-950');
  }
  const menu = document.getElementById('menu-dropdown-conductor') || document.getElementById('menu-dropdown-chofer');
  if (menu && !menu.classList.contains('hidden')) {
    menu.classList.add('hidden');
  }
};
window.seleccionarChoferRepostaje = window.seleccionarConductorRepostaje;

document.addEventListener('click', function(e) {
  const container = document.getElementById('dropdown-camion-container');
  const menu = document.getElementById('menu-dropdown-camion');
  if (container && menu && !container.contains(e.target)) {
    menu.classList.add('hidden');
  }

  const containerConductor = document.getElementById('dropdown-conductor-container') || document.getElementById('dropdown-chofer-container');
  const menuConductor = document.getElementById('menu-dropdown-conductor') || document.getElementById('menu-dropdown-chofer');
  if (containerConductor && menuConductor && !containerConductor.contains(e.target)) {
    menuConductor.classList.add('hidden');
  }
});

/* ==========================================================================
   GESTIÓN DE TIEMPO Y FINALIZACIÓN DE RUTA DEL CONDUCTOR (BUGAMEDAPP)
   ========================================================================== */

/**
 * 1. REGISTRO DE INICIO DE RUTA
 * Guarda el timestamp exacto de inicio en localStorage ('routeStartTime')
 * y opcionalmente el identificador de la ruta activa ('activeRouteId').
 */
window.iniciarRuta = function(routeId = null) {
  const timestamp = new Date().toISOString();
  localStorage.setItem('routeStartTime', timestamp);
  if (routeId) {
    localStorage.setItem('activeRouteId', String(routeId));
  }
  console.log('✓ [BugamedApp] Timestamp de inicio de ruta guardado:', timestamp);
  return timestamp;
};

/**
 * Función auxiliar para calcular el tiempo transcurrido exacto.
 * Retorna totalSegundos y el formato legible "00h 00m 00s".
 */
function calcularTiempoTranscurrido(fechaInicioISO) {
  let inicio;
  if (fechaInicioISO) {
    inicio = new Date(fechaInicioISO);
    if (isNaN(inicio.getTime())) inicio = new Date();
  } else {
    inicio = new Date();
  }

  const fin = new Date();
  const diffMs = Math.max(0, fin.getTime() - inicio.getTime());
  const totalSegundos = Math.floor(diffMs / 1000);

  const horas = Math.floor(totalSegundos / 3600);
  const minutos = Math.floor((totalSegundos % 3600) / 60);
  const segundos = totalSegundos % 60;

  const formateado = `${String(horas).padStart(2, '0')}h ${String(minutos).padStart(2, '0')}m ${String(segundos).padStart(2, '0')}s`;

  return {
    totalSegundos,
    formateado,
    horas,
    minutos,
    segundos,
    inicio,
    fin,
    inicioStr: inicio.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    finStr: fin.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  };
}
window.calcularTiempoTranscurrido = calcularTiempoTranscurrido;

/**
 * 2. CÁLCULO Y MODAL AL FINALIZAR RUTA
 * - Calcula el tiempo exacto transcurrido desde el inicio.
 * - Actualiza el estado en Supabase (tabla 'routes'): status: 'completed', completed_at, duration_seconds.
 * - Abre el modal flotante con Tailwind CSS obligando a presionar "Aceptar".
 */
window.finalizarRutaConductor = async function(routeId = null, conductorNombre = null) {
  // 1. Obtener timestamp guardado al inicio
  const routeStartTime = localStorage.getItem('routeStartTime');
  const tiempo = calcularTiempoTranscurrido(routeStartTime);
  const completedAt = new Date().toISOString();

  // 2. Determinar ID de la ruta activa
  let targetId = routeId || localStorage.getItem('activeRouteId');
  if (!targetId && typeof serviciosActivos !== 'undefined') {
    const servicio = conductorNombre ? serviciosActivos[conductorNombre] : Object.values(serviciosActivos)[0];
    if (servicio && servicio.rutaId) targetId = servicio.rutaId;
  }

  // 3. Actualizar en Supabase en la tabla 'rutas'
  const clientSupabase = window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);
  if (clientSupabase && targetId && !String(targetId).startsWith('temp_') && !String(targetId).startsWith('ruta_init_')) {
    try {
      const { data, error } = await clientSupabase
        .from('rutas')
        .update({ estado: 'finalizada' })
        .eq('id', targetId)
        .select();

      if (error) {
        console.error("Error al actualizar ruta en tabla 'rutas':", error.message);
      } else {
        console.log(`✓ [BugamedApp] Ruta ${targetId} finalizada exitosamente en tabla 'rutas'.`);
      }
    } catch (err) {
      console.error('Error al actualizar ruta en Supabase:', err);
    }
  }

  // 4. Actualizar estado en memoria local si la ruta aún no estaba marcada
  if (targetId && typeof finalizarRuta === 'function') {
    const rutaEnMemoria = (typeof rutas !== 'undefined' && Array.isArray(rutas))
      ? rutas.find(r => String(r.id) === String(targetId))
      : null;
    if (rutaEnMemoria && rutaEnMemoria.estado !== 'completada' && rutaEnMemoria.estado !== 'finalizada') {
      try {
        await finalizarRuta(targetId, {
          duracionFormateada: tiempo.formateado,
          duration_seconds: tiempo.totalSegundos,
          completed_at: completedAt
        });
      } catch (e) {
        console.warn('Aviso en finalizarRuta local:', e);
      }
    }
  } else if (conductorNombre && typeof serviciosActivos !== 'undefined' && serviciosActivos[conductorNombre]) {
    delete serviciosActivos[conductorNombre];
    if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
  }

  // 5. Mostrar ventana modal flotante
  const modal = document.getElementById('modal-fin-ruta');
  if (modal) {
    const elDuracion = document.getElementById('modal-fin-ruta-duracion');
    const elInicio = document.getElementById('modal-fin-ruta-hora-inicio');
    const elFin = document.getElementById('modal-fin-ruta-hora-fin');

    if (elDuracion) elDuracion.innerText = tiempo.formateado;
    if (elInicio) elInicio.innerText = tiempo.inicioStr;
    if (elFin) elFin.innerText = tiempo.finStr;

    // Ocultar cualquier otro modal que estuviera abierto (ej: cierre o repostaje)
    const modalCierrePrevio = document.getElementById('modal-cierre-final');
    if (modalCierrePrevio) modalCierrePrevio.classList.add('hidden');

    modal.classList.remove('hidden');
  } else {
    alert(`¡Ruta finalizada con éxito!\nTiempo invertido: ${tiempo.formateado}`);
  }

  return {
    totalSegundos: tiempo.totalSegundos,
    duracionFormateada: tiempo.formateado,
    completedAt: completedAt
  };
};

/**
 * 3. ACCIÓN DEL BOTÓN ACEPTAR
 * - Oculta la ventana modal.
 * - Borra el registro temporal de inicio ('routeStartTime').
 * - Redirige o actualiza la vista del panel del conductor.
 */
window.cerrarModalFinRutaYAceptar = function() {
  const modal = document.getElementById('modal-fin-ruta');
  if (modal) {
    modal.classList.add('hidden');
  }

  // Borrar el registro temporal de inicio y activeRouteId
  localStorage.removeItem('routeStartTime');
  localStorage.removeItem('activeRouteId');

  // Redirigir o actualizar la vista del panel del conductor
  if (typeof switchTab === 'function') {
    switchTab('logistica');
  }
  if (typeof renderModuloLogistica === 'function') {
    renderModuloLogistica();
  }
  if (typeof refrescarVistasRutas === 'function') {
    refrescarVistasRutas();
  }
  if (typeof actualizarKPIs === 'function') {
    actualizarKPIs();
  }

  console.log('✓ [BugamedApp] Ruta finalizada aceptada, storage temporal limpiado y vista actualizada.');
};

// Asegurar que el modal obligue al usuario a pulsar el botón Aceptar (evitar escape key)
document.addEventListener('keydown', function(e) {
  const modal = document.getElementById('modal-fin-ruta');
  if (modal && !modal.classList.contains('hidden') && e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
  }
});

