/* --- REPOSTAJES --- */
window.toggleModalRepostaje = function(show) { 
  const m = document.getElementById('modal-repostaje');
  if (m) {
    if (show) {
      const listaOpciones = document.getElementById('lista-opciones-camiones');
      const listaOpcionesChoferes = document.getElementById('lista-opciones-choferes');
      if (((listaOpciones && (!listaOpciones.children || listaOpciones.children.length === 0)) ||
           (listaOpcionesChoferes && (!listaOpcionesChoferes.children || listaOpcionesChoferes.children.length === 0))) && typeof camiones !== 'undefined') {
        renderModuloLogistica();
      }
    } else {
      const menu = document.getElementById('menu-dropdown-camion');
      if (menu) menu.classList.add('hidden');
      const menuChofer = document.getElementById('menu-dropdown-chofer');
      if (menuChofer) menuChofer.classList.add('hidden');
    }
    m.classList.toggle('hidden', !show); 
  }
};

window.guardarRepostaje = function(e) {
  if (e) e.preventDefault();
  const inputChofer = document.getElementById('rep-chofer');
  const chofer = (inputChofer && inputChofer.value && inputChofer.value.trim()) ? inputChofer.value.trim() : 'General';
  const camion = document.getElementById('rep-camion')?.value || '';

  if (!camion) {
    alert('Por favor, selecciona una matrícula de vehículo.');
    return;
  }

  repostajes.unshift({
    fecha: new Date().toISOString().split('T')[0],
    camion: camion,
    litros: document.getElementById('rep-litros')?.value || '',
    euros: document.getElementById('rep-euros')?.value || '',
    km: document.getElementById('rep-km')?.value || '',
    adblue: document.getElementById('rep-adblue')?.value || '',
    chofer: chofer
  });
  guardarDatosEnLocal();
  toggleModalRepostaje(false);
  if (e && e.target && typeof e.target.reset === 'function') {
    e.target.reset();
  } else {
    const form = document.querySelector('#modal-repostaje form');
    if (form) form.reset();
  }
  const inputCamion = document.getElementById('rep-camion');
  if (inputCamion) inputCamion.value = '';
  const textRepCamion = document.getElementById('text-rep-camion');
  if (textRepCamion) {
    textRepCamion.textContent = 'Seleccionar vehículo...';
    textRepCamion.classList.remove('font-bold', 'text-blue-950');
    textRepCamion.classList.add('text-slate-500');
  }
  const menuCam = document.getElementById('menu-dropdown-camion');
  if (menuCam) menuCam.classList.add('hidden');

  const inputChoferElem = document.getElementById('rep-chofer');
  if (inputChoferElem) inputChoferElem.value = '';
  const textRepChofer = document.getElementById('text-rep-chofer');
  if (textRepChofer) {
    textRepChofer.textContent = 'Seleccionar conductor...';
    textRepChofer.classList.remove('font-bold', 'text-indigo-950');
    textRepChofer.classList.add('text-slate-500');
  }
  const menuChofer = document.getElementById('menu-dropdown-chofer');
  if (menuChofer) menuChofer.classList.add('hidden');

  renderRepostajes();
  if (typeof renderAdminCombustible === 'function') renderAdminCombustible();
};

function renderRepostajes() {
  const container = document.getElementById('lista-repostajes');
  if (!container) return;
  if (repostajes.length === 0) {
    container.innerHTML = '<p class="text-xs text-slate-500 italic">Sin repostajes.</p>';
    return;
  }
  container.innerHTML = repostajes.map((r, index) => `
    <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
      <div>
        <p class="font-bold text-slate-800"><i class="fa-solid fa-gas-pump text-indigo-600"></i> ${r.tipo ? `${r.tipo} - ` : ''}${r.camion}</p>
        <p class="text-slate-500">${r.fecha} | ${r.litros} L${r.km ? ` | ${r.km} KM` : ''} | <span class="font-semibold text-slate-700">${r.chofer || 'General'}</span></p>
      </div>
      <div class="flex items-center gap-3">
        <span class="font-bold text-indigo-700 text-sm">${r.euros} €</span>
        <button onclick="eliminarRepostajeAdmin(${index})" class="text-slate-400 hover:text-red-500 p-1 cursor-pointer" title="Eliminar suministro por error"><i class="fa-solid fa-trash-can"></i></button>
      </div>
    </div>
  `).join('');
}

window.eliminarRepostajeAdmin = function(index) {
  if (confirm('¿Estás seguro de eliminar este registro de suministro de combustible añadido por error?')) {
    repostajes.splice(index, 1);
    guardarDatosEnLocal();
    renderRepostajes();
    if (typeof renderAdminCombustible === 'function') renderAdminCombustible();
  }
};

/* --- LOGÍSTICA & INICIO DE RUTA CON TARJETAS DE PERFIL --- */
function renderModuloLogistica() {
  const listaOpcionesCamiones = document.getElementById('lista-opciones-camiones');
  const listaOpcionesChoferes = document.getElementById('lista-opciones-choferes');
  const selIncCamion = document.getElementById('inc-camion');

  if (listaOpcionesCamiones && typeof camiones !== 'undefined') {
    listaOpcionesCamiones.innerHTML = camiones.map(c => `
      <li onclick="seleccionarCamionRepostaje('${c.matricula.replace(/'/g, "\\'")}')" class="px-4 py-2.5 cursor-pointer border-l-4 border-transparent hover:border-blue-600 hover:bg-blue-50 text-sm text-slate-700 transition-colors flex items-center justify-between">
        <span class="font-semibold text-slate-800">${c.matricula}</span>
        ${c.modelo ? `<span class="text-xs text-slate-400 font-normal">${c.modelo}</span>` : ''}
      </li>
    `).join('');
  }

  if (listaOpcionesChoferes && typeof choferes !== 'undefined') {
    listaOpcionesChoferes.innerHTML = choferes.map(ch => `
      <li onclick="seleccionarChoferRepostaje('${ch.nombre.replace(/'/g, "\\'")}')" class="px-4 py-2.5 cursor-pointer border-l-4 border-transparent hover:border-indigo-600 hover:bg-indigo-50 text-sm text-slate-700 transition-colors flex items-center justify-between">
        <span class="font-semibold text-slate-800">${ch.nombre}</span>
        ${ch.dni ? `<span class="text-xs text-slate-400 font-normal">${ch.dni}</span>` : ''}
      </li>
    `).join('');
  }

  if (selIncCamion) selIncCamion.innerHTML = camiones.map(c => `<option value="${c.matricula}">${c.matricula}</option>`).join('');

  renderRepostajes();
  renderIncidencias();
  actualizarEstadoFichajeInterfaz();
  if (typeof renderVisualizacionRutasChoferes === 'function') renderVisualizacionRutasChoferes();
}

window.abrirSelectorChoferesInicio = function() {
  const modal = document.getElementById('modal-selector-choferes');
  const grid = document.getElementById('grid-modal-choferes-perfiles');
  if (!modal || !grid) return;

  const choferesDisponibles = choferes.filter(ch => !serviciosActivos[ch.nombre]);

  if (choferesDisponibles.length === 0) {
    grid.innerHTML = '<p class="col-span-full text-center text-xs text-slate-500 py-6">Todos los conductores están en ruta actualmente.</p>';
  } else {
    grid.innerHTML = choferesDisponibles.map(ch => `
      <div onclick="seleccionarChoferInicio('${ch.nombre.replace(/'/g, "\\'")}', '${ch.foto || ''}')" class="light-card light-card-hover rounded-2xl p-4 border border-slate-200 cursor-pointer flex flex-col items-center text-center space-y-2 group">
        <div class="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center overflow-hidden border-2 border-blue-200 group-hover:border-blue-600 transition-all shadow-inner">
          ${ch.foto ? `<img src="${ch.foto}" class="w-full h-full object-cover" alt="${ch.nombre}">` : '<i class="fa-solid fa-user text-2xl"></i>'}
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

window.cerrarSelectorChoferes = function() {
  const modal = document.getElementById('modal-selector-choferes');
  if (modal) modal.classList.add('hidden');
};

window.seleccionarChoferInicio = function(nombre, foto) {
  const input = document.getElementById('fichaje-chofer-input');
  const prevNombre = document.getElementById('preview-chofer-nombre');
  const prevImg = document.getElementById('preview-chofer-img');

  if (input) input.value = nombre;
  if (prevNombre) prevNombre.innerText = nombre;
  if (prevImg) {
    prevImg.innerHTML = foto ? `<img src="${foto}" class="w-full h-full object-cover">` : `<span class="font-bold text-sm">${nombre.charAt(0)}</span>`;
  }

  cerrarSelectorChoferes();
  actualizarSelectorRutasParaChoferInicio(nombre);
};

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
          ${c.foto ? `<img src="${c.foto}" class="w-full h-full object-cover" alt="${c.matricula}">` : '<i class="fa-solid fa-truck text-2xl"></i>'}
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
    prevImg.innerHTML = foto ? `<img src="${foto}" class="w-full h-full object-cover">` : `<i class="fa-solid fa-truck text-sm"></i>`;
  }

  cerrarSelectorCamiones();
};

/* --- FLUJO DE INICIO DE RUTA CON SELECCIÓN DE DÍA Y RUTA ESPECÍFICA --- */
let datosInicioPendiente = null;

window.iniciarRutaServicio = function(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  const chofer = document.getElementById('fichaje-chofer-input')?.value;
  const camionMat = document.getElementById('fichaje-camion-input')?.value;

  if (!chofer || !camionMat) {
    alert('Por favor, haz clic para seleccionar un conductor y un vehículo.');
    return;
  }

  datosInicioPendiente = { chofer, camionMat };

  // Actualizar badges del modal de inicio
  const badgeChof = document.getElementById('modal-inicio-chofer-badge');
  const badgeCam = document.getElementById('modal-inicio-camion-badge');
  if (badgeChof) badgeChof.innerText = chofer;
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
    ejecutarInicioServicioDefinitivo(chofer, camionMat, 'Lunes', 0);
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

  const chofer = datosInicioPendiente ? datosInicioPendiente.chofer : (document.getElementById('fichaje-chofer-input')?.value || '');
  const camionMat = datosInicioPendiente ? datosInicioPendiente.camionMat : (document.getElementById('fichaje-camion-input')?.value || '');
  const diaSeleccionado = selectDia ? selectDia.value : 'Lunes';

  if (!chofer) {
    container.innerHTML = '<p class="text-xs text-slate-500 italic p-3 text-center">Selecciona primero un conductor.</p>';
    return;
  }

  // Filtrar EXCLUYENDO las rutas completadas, finalizadas o archivadas
  const rutasDelChoferDia = (typeof rutas !== 'undefined' && Array.isArray(rutas))
    ? rutas.filter(r => 
        r.chofer && r.chofer.trim().toLowerCase() === chofer.trim().toLowerCase() && 
        r.dia && r.dia.trim().toLowerCase() === diaSeleccionado.trim().toLowerCase() &&
        r.estado !== 'completada' && r.estado !== 'finalizada' && r.estado !== 'archivada'
      )
    : [];

  // Comprobar si hay rutas ya finalizadas para este día
  const rutasCompletadasHoy = (typeof rutas !== 'undefined' && Array.isArray(rutas))
    ? rutas.filter(r => 
        r.chofer && r.chofer.trim().toLowerCase() === chofer.trim().toLowerCase() && 
        r.dia && r.dia.trim().toLowerCase() === diaSeleccionado.trim().toLowerCase() &&
        (r.estado === 'completada' || r.estado === 'finalizada' || r.estado === 'archivada')
      )
    : [];

  if (badgeCount) {
    badgeCount.innerText = `${rutasDelChoferDia.length} ${rutasDelChoferDia.length === 1 ? 'ruta disponible' : 'rutas disponibles'}`;
    badgeCount.className = rutasDelChoferDia.length > 0 
      ? "text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200" 
      : (rutasCompletadasHoy.length > 0
          ? "text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200"
          : "text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200");
  }

  if (rutasDelChoferDia.length === 0) {
    if (rutasCompletadasHoy.length > 0) {
      container.innerHTML = `
        <div class="light-card rounded-2xl p-6 text-center space-y-3 border border-emerald-200 bg-emerald-50/50">
          <div class="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-xl">
            <i class="fa-solid fa-circle-check"></i>
          </div>
          <div>
            <h4 class="font-extrabold text-emerald-950 text-sm">Rutas del ${diaSeleccionado} ya completadas</h4>
            <p class="text-xs text-emerald-800 mt-1">El conductor <strong>${chofer}</strong> ya ha finalizado todas sus rutas para este día.</p>
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
            <p class="text-xs text-amber-800 mt-1">El conductor <strong>${chofer}</strong> no tiene rutas pendientes para este día.</p>
          </div>
          <p class="text-[11px] text-slate-500 max-w-sm mx-auto">
            Cambia de día en el desplegable superior o añade rutas en la sección <strong>Semana</strong>.
          </p>
        </div>
      `;
    }
    return;
  }

  container.innerHTML = rutasDelChoferDia.map((r, idx) => {
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
            ${numClientes === 0 ? '<p class="text-xs text-slate-400 italic">Sin clientes asignados.</p>' : r.clientes.map((cNombre, cIdx) => `
              <div class="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center gap-2.5 shadow-2xs">
                <span class="w-5 h-5 rounded-md bg-blue-100 text-blue-700 font-black flex items-center justify-center text-[10px] shrink-0">${cIdx + 1}</span>
                <p class="font-bold text-slate-800 text-xs whitespace-normal break-words flex-1">${cNombre}</p>
              </div>
            `).join('')}
          </div>
        </div>

        <button type="button" onclick="ejecutarInicioServicioDefinitivo('${chofer.replace(/'/g, "\\'")}', '${camionFinal.replace(/'/g, "\\'")}', '${diaSeleccionado}', ${idx}, '${rId}')" class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer">
          <i class="fa-solid fa-play"></i> Iniciar Ruta ${idx + 1}
        </button>
      </div>
    `;
  }).join('');
};

window.ejecutarInicioServicioDefinitivo = function(chofer, camionMat, diaSeleccionado, rutaIdx = 0, rutaIdParam = null) {
  if (typeof asegurarEstadoRutas === 'function') asegurarEstadoRutas();

  const rutasChoferDia = (typeof rutas !== 'undefined' && Array.isArray(rutas))
    ? rutas.filter(r => 
        r.chofer && r.chofer.trim().toLowerCase() === chofer.trim().toLowerCase() && 
        r.dia && r.dia.trim().toLowerCase() === diaSeleccionado.trim().toLowerCase() &&
        r.estado !== 'completada' && r.estado !== 'finalizada' && r.estado !== 'archivada'
      )
    : [];

  let rutaElegida = null;
  if (rutaIdParam) {
    rutaElegida = rutas.find(r => r.id === rutaIdParam);
  }
  if (!rutaElegida && rutasChoferDia.length > 0) {
    rutaElegida = rutasChoferDia[rutaIdx] || rutasChoferDia[0];
  }

  let clientesDeRuta = [];
  let rutaNombre = `Ruta ${rutaIdx + 1}`;
  let camionEfectivo = camionMat;

  if (rutaElegida) {
    clientesDeRuta = rutaElegida.clientes || [];
    if (rutaElegida.camion) camionEfectivo = rutaElegida.camion;
    if (rutaElegida.tipoCliente) rutaNombre = `Ruta (${rutaElegida.tipoCliente})`;
    rutaElegida.estado = 'en_curso';
  } else {
    const rutasChofer = (typeof rutas !== 'undefined') ? rutas.filter(r => r.chofer && r.chofer.trim().toLowerCase() === chofer.trim().toLowerCase() && r.estado !== 'completada' && r.estado !== 'finalizada') : [];
    if (rutasChofer.length > 0) {
      rutaElegida = rutasChofer[0];
      clientesDeRuta = rutaElegida.clientes || [];
      if (rutaElegida.camion) camionEfectivo = rutaElegida.camion;
      rutaElegida.estado = 'en_curso';
    } else {
      clientesDeRuta = (typeof clientes !== 'undefined') ? clientes.map(c => c.nombre) : [];
    }
  }

  serviciosActivos[chofer] = {
    chofer: chofer,
    camion: camionEfectivo,
    dia: diaSeleccionado,
    rutaNombre: rutaNombre,
    rutaIndex: rutaIdx,
    rutaId: rutaElegida ? rutaElegida.id : null,
    inicio: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    fechaStr: new Date().toISOString().split('T')[0],
    clientes: [...clientesDeRuta]
  };

  const c = camiones.find(v => v.matricula === camionEfectivo);
  if (c) c.estado = `Ocupado por ${chofer} (${rutaNombre})`;

  choferAcordeonAbierto = chofer;

  // Limpiar inputs del formulario
  const inpChof = document.getElementById('fichaje-chofer-input');
  const inpCam = document.getElementById('fichaje-camion-input');
  if (inpChof) inpChof.value = '';
  if (inpCam) inpCam.value = '';

  const prevChofNom = document.getElementById('preview-chofer-nombre');
  const prevChofImg = document.getElementById('preview-chofer-img');
  const prevCamMat = document.getElementById('preview-camion-matricula');
  const prevCamImg = document.getElementById('preview-camion-img');

  if (prevChofNom) prevChofNom.innerText = 'Seleccionar conductor...';
  if (prevChofImg) prevChofImg.innerHTML = '<i class="fa-solid fa-user"></i>';
  if (prevCamMat) prevCamMat.innerText = 'Seleccionar vehículo...';
  if (prevCamImg) prevCamImg.innerHTML = '<i class="fa-solid fa-truck"></i>';

  cerrarModalDiaRuta();
  guardarDatosEnLocal();
  if (typeof actualizarEstadoFichajeInterfaz === 'function') actualizarEstadoFichajeInterfaz();
  if (typeof renderChoferes === 'function') renderChoferes();
  if (typeof renderCamiones === 'function') renderCamiones();
};

window.confirmarInicioRutaConDia = function() {
  if (!datosInicioPendiente) return;
  const selectDia = document.getElementById('select-dia-inicio-ruta');
  const diaSeleccionado = selectDia ? selectDia.value : 'Lunes';
  const { chofer, camionMat } = datosInicioPendiente;

  const tieneRuta = verificarSiConductorTieneRuta(chofer, diaSeleccionado);
  if (!tieneRuta) {
    alert(`❌ El conductor ${chofer} no tiene ninguna ruta asignada o pendiente para el ${diaSeleccionado}.`);
    return;
  }

  ejecutarInicioServicioDefinitivo(chofer, camionMat, diaSeleccionado, 0);
};

function verificarSiConductorTieneRuta(nombreChofer, diaSeleccionado) {
  if (typeof rutas === 'undefined' || rutas.length === 0) {
    return false; 
  }

  const tieneAsignacion = rutas.some(r => {
    const coincideChofer = r.chofer && r.chofer.trim().toLowerCase() === nombreChofer.trim().toLowerCase();
    const coincideDia = r.dia && r.dia.trim().toLowerCase() === diaSeleccionado.trim().toLowerCase();
    const noFinalizada = r.estado !== 'completada' && r.estado !== 'finalizada' && r.estado !== 'archivada';
    return coincideChofer && coincideDia && noFinalizada;
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

  const choferesEnRuta = Object.keys(serviciosActivos);
  badgeCount.innerText = `${choferesEnRuta.length} Ruta(s) Activa(s)`;

  if (choferesEnRuta.length > 0) {
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

    renderAcordeonRutasActivas(choferesEnRuta);
  } else {
    if (iconoCamion) iconoCamion.className = "fa-solid fa-truck-front text-slate-400 text-xl";
    if (containerHumo) containerHumo.innerHTML = '';
    badgeCount.className = "px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200";
    if (boxActivasPanel) boxActivasPanel.classList.add('hidden');
  }
}

function renderAcordeonRutasActivas(choferesEnRuta) {
  const container = document.getElementById('contenedor-acordeon-rutas-activas');
  if (!container) return;

  container.innerHTML = choferesEnRuta.map(choferNombre => {
    const servicio = serviciosActivos[choferNombre];
    const estaAbierto = (choferAcordeonAbierto === choferNombre);

    const totalClientes = servicio.clientes ? servicio.clientes.length : 0;
    const clientesCompletados = servicio.clientes ? servicio.clientes.filter(c => {
      const k = `${servicio.chofer}_${c}`;
      return envasesPorClienteRuta[k] && envasesPorClienteRuta[k].completado;
    }).length : 0;
    const porcentajeProgreso = totalClientes > 0 ? Math.round((clientesCompletados / totalClientes) * 100) : 0;

    const totalEntregados = servicio.clientes ? servicio.clientes.reduce((acc, c) => {
      const k = `${servicio.chofer}_${c}`;
      return acc + (envasesPorClienteRuta[k]?.entregados || 0);
    }, 0) : 0;

    const totalRecogidos = servicio.clientes ? servicio.clientes.reduce((acc, c) => {
      const k = `${servicio.chofer}_${c}`;
      return acc + (envasesPorClienteRuta[k]?.recogidos || 0);
    }, 0) : 0;

    return `
      <div class="border border-indigo-200 rounded-2xl overflow-hidden bg-white shadow-xs">
        <!-- BARRA PRINCIPAL DEL CONDUCTOR EN RUTA (CLICK PARA DESPLEGAR) -->
        <div onclick="toggleAcordeonChofer('${choferNombre}')" class="p-4 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 hover:from-blue-100/80 hover:to-indigo-100/80 transition-all flex justify-between items-center cursor-pointer select-none">
          <div class="flex items-center gap-3">
            <span class="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
            <div>
              <h4 class="font-black text-blue-950 text-base flex items-center gap-2 flex-wrap">
                <span>RUTA: ${servicio.chofer}</span>
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
            <button onclick="prepararCierreRutaModal('${servicio.chofer}')" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2 shrink-0">
              <i class="fa-solid fa-flag-checkered"></i> Finalizar Esta Ruta
            </button>
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

          <!-- BUSCADOR RÁPIDO DENTRO DE LA RUTA -->
          <div class="relative">
            <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-slate-400 text-xs"></i>
            <input type="text" oninput="filtrarParadasRutaActiva('${choferNombre}', this.value)" placeholder="Buscar cliente o dirección en esta ruta activa..." class="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs">
          </div>

          <!-- REJILLA COMPACTA DE TARJETAS DE CLIENTES DE LA RUTA ACTIVA -->
          <div id="grid-clientes-activos-${choferNombre}" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[560px] overflow-y-auto custom-scrollbar pr-1">
            ${servicio.clientes.map((clienteNombre, idx) => {
              const key = `${servicio.chofer}_${clienteNombre}`;
              const env = envasesPorClienteRuta[key] || { entregados: 0, recogidos: 0, completado: false };
              const cliInfo = (typeof clientes !== 'undefined' && Array.isArray(clientes))
                ? clientes.find(c => c.nombre && c.nombre.trim().toLowerCase() === clienteNombre.trim().toLowerCase())
                : null;

              let badgeTipoColor = 'bg-slate-100 text-slate-600 border-slate-200';
              if (cliInfo && cliInfo.tipo === 'Hoteles') badgeTipoColor = 'bg-purple-100 text-purple-700 border-purple-200';
              if (cliInfo && cliInfo.tipo === 'Restaurantes') badgeTipoColor = 'bg-blue-100 text-blue-700 border-blue-200';
              if (cliInfo && cliInfo.tipo === 'Camping') badgeTipoColor = 'bg-amber-100 text-amber-700 border-amber-200';
              if (cliInfo && cliInfo.tipo === 'Mixto') badgeTipoColor = 'bg-emerald-100 text-emerald-700 border-emerald-200';

              return `
                <div data-cliente-card-chofer="${choferNombre}" data-cliente-nombre="${clienteNombre.toLowerCase()}" data-cliente-dir="${(cliInfo?.direccion || '' + ' ' + cliInfo?.zona || '').toLowerCase()}" class="light-card rounded-2xl p-3.5 border ${env.completado ? 'border-emerald-300 bg-emerald-50/25 shadow-xs' : 'border-slate-200 bg-white hover:border-indigo-300 shadow-2xs'} flex flex-col justify-between gap-3 transition-all group">
                  
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
                        : '<span class="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-bold shrink-0">Pendiente</span>'
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
                      <div class="flex items-center gap-1 shrink-0">
                        <button type="button" onclick="abrirNavegacionGPSCliente('${clienteNombre.replace(/'/g, "\\'")}')" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-[10px] font-black flex items-center gap-1 shadow-2xs transition-all cursor-pointer hover:scale-105" title="Abrir navegación GPS en Google Maps">
                          <i class="fa-solid fa-diamond-turn-right text-[10px]"></i> GPS
                        </button>
                        ${cliInfo && cliInfo.tipo ? `<span class="text-[9px] px-1.5 py-0.5 rounded font-extrabold border ${badgeTipoColor}">${cliInfo.tipo}</span>` : ''}
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
                        <input type="text" readonly id="env-entregados-${choferNombre}-${idx}" value="${env.entregados}" onclick="abrirTecladoNumerico(this, 'Carros Entregados')" title="Toca para abrir teclado" placeholder="0" class="w-full bg-white border border-blue-300 rounded-lg py-1 text-sm text-blue-950 font-black text-center cursor-pointer hover:border-blue-500 focus:outline-none shadow-inner">
                      </div>
                    </div>

                    <!-- RECOGIDOS -->
                    <div class="bg-indigo-50/70 p-2 rounded-xl border border-indigo-200/80 space-y-1 overflow-hidden">
                      <div class="flex justify-between items-center text-[9px] font-extrabold text-indigo-900 uppercase">
                        <span>Recog.</span>
                        <i class="fa-solid fa-arrow-down text-indigo-600 text-[9px] shrink-0"></i>
                      </div>
                      <div class="flex items-center justify-center gap-1 mt-1">
                        <input type="text" readonly id="env-recogidos-${choferNombre}-${idx}" value="${env.recogidos}" onclick="abrirTecladoNumerico(this, 'Carros Recogidos')" title="Toca para abrir teclado" placeholder="0" class="w-full bg-white border border-indigo-300 rounded-lg py-1 text-sm text-indigo-950 font-black text-center cursor-pointer hover:border-indigo-500 focus:outline-none shadow-inner">
                      </div>
                    </div>

                  </div>

                  <!-- BOTÓN DE GUARDADO RÁPIDO CON RETROALIMENTACIÓN -->
                  <button type="button" onclick="guardarEnvasesCliente('${servicio.chofer}', '${clienteNombre.replace(/'/g, "\\'")}', ${idx})" class="w-full py-1.5 ${env.completado ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'} text-xs font-black rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5 active:scale-98">
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

window.ajustarEnvasesPaso = function(chofer, clienteNombre, idx, campo, delta) {
  const el = document.getElementById(`env-${campo}-${chofer}-${idx}`);
  if (!el) return;
  let val = parseInt(el.value || 0, 10);
  if (isNaN(val)) val = 0;
  val += delta;
  if (val < 0) val = 0;
  el.value = val;

  const key = `${chofer}_${clienteNombre}`;
  if (!envasesPorClienteRuta[key]) {
    envasesPorClienteRuta[key] = { entregados: 0, recogidos: 0, completado: false };
  }
  envasesPorClienteRuta[key][campo] = val;
  guardarDatosEnLocal();
};

window.filtrarParadasRutaActiva = function(chofer, texto) {
  const q = (texto || '').toLowerCase().trim();
  const tarjetas = document.querySelectorAll(`[data-cliente-card-chofer="${chofer}"]`);
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

window.toggleAcordeonChofer = function(choferNombre) {
  if (choferAcordeonAbierto === choferNombre) {
    choferAcordeonAbierto = null;
  } else {
    choferAcordeonAbierto = choferNombre;
  }
  const choferesEnRuta = Object.keys(serviciosActivos);
  renderAcordeonRutasActivas(choferesEnRuta);
};

window.guardarEnvasesCliente = function(chofer, clienteNombre, idx) {
  const elEnt = document.getElementById(`env-entregados-${chofer}-${idx}`);
  const elRec = document.getElementById(`env-recogidos-${chofer}-${idx}`);

  const entregados = elEnt ? parseInt(elEnt.value || 0, 10) || 0 : 0;
  const recogidos = elRec ? parseInt(elRec.value || 0, 10) || 0 : 0;
  const key = `${chofer}_${clienteNombre}`;

  envasesPorClienteRuta[key] = {
    entregados: entregados,
    recogidos: recogidos,
    completado: true
  };

  guardarDatosEnLocal();
  actualizarEstadoFichajeInterfaz();
  mostrarToastLogistica(`✓ Parada guardada (${clienteNombre}): ${entregados} entregados | ${recogidos} recogidos`);
};

window.prepararCierreRutaModal = function(choferTarget) {
  const modal = document.getElementById('modal-cierre-final');
  const inputTarget = document.getElementById('cierre-chofer-target');
  if (modal && inputTarget) {
    inputTarget.value = choferTarget;
    modal.classList.remove('hidden');
  }
};

window.toggleModalCierreFinal = function(show) {
  const m = document.getElementById('modal-cierre-final');
  if (m) m.classList.toggle('hidden', !show);
};

window.confirmarCierreRutaDefinitivo = function(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  const choferTarget = document.getElementById('cierre-chofer-target')?.value;
  if (!choferTarget || !serviciosActivos[choferTarget]) {
    alert('No se ha encontrado el servicio activo para este conductor.');
    return;
  }

  const servicio = serviciosActivos[choferTarget];
  const kmInput = document.getElementById('cierre-km');
  const obsInput = document.getElementById('cierre-observaciones');

  const km = kmInput ? (kmInput.value.trim() || 'No especificado') : 'No especificado';
  const obs = obsInput ? (obsInput.value.trim() || 'Sin observaciones') : 'Sin observaciones';

  // RECOPILAMOS EL DETALLE DE CARROS POR CLIENTE (con valores guardados o en pantalla)
  const detalleClientes = [];
  if (servicio.clientes && servicio.clientes.length > 0) {
    servicio.clientes.forEach((clienteNombre, cIdx) => {
      const key = `${servicio.chofer}_${clienteNombre}`;
      const env = envasesPorClienteRuta[key];
      const elEnt = document.getElementById(`env-entregados-${servicio.chofer}-${cIdx}`);
      const elRec = document.getElementById(`env-recogidos-${servicio.chofer}-${cIdx}`);
      const entregados = elEnt ? (parseInt(elEnt.value, 10) || 0) : (env?.entregados || 0);
      const recogidos = elRec ? (parseInt(elRec.value, 10) || 0) : (env?.recogidos || 0);
      detalleClientes.push({
        cliente: clienteNombre,
        entregados: entregados,
        recogidos: recogidos
      });
    });
  }

  const c = camiones.find(v => v.matricula === servicio.camion);
  if (c) c.estado = 'Libre';

  // 1. Marcar la ruta como 'completada' de forma permanente en el listado de rutas
  let rutaOriginal = null;
  if (servicio.rutaId) {
    rutaOriginal = rutas.find(r => r.id === servicio.rutaId);
  }
  if (!rutaOriginal) {
    rutaOriginal = rutas.find(r => 
      r.chofer && r.chofer.trim().toLowerCase() === servicio.chofer.trim().toLowerCase() &&
      r.dia && r.dia.trim().toLowerCase() === (servicio.dia || '').trim().toLowerCase() &&
      r.estado !== 'completada' && r.estado !== 'finalizada'
    );
  }

  const fechaHoy = new Date().toISOString().split('T')[0];
  const horaFin = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (rutaOriginal) {
    rutaOriginal.estado = 'completada';
    rutaOriginal.fechaCompletada = fechaHoy;
    rutaOriginal.horaInicio = servicio.inicio;
    rutaOriginal.horaFin = horaFin;
    rutaOriginal.km = km;
    rutaOriginal.obs = obs;
    rutaOriginal.detalleClientes = detalleClientes;
  }

  // 2. Mover / guardar en el historial específico de rutas completadas de ese chofer
  const rutaFinalizadaHistorial = {
    id: servicio.rutaId || ('hist_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6)),
    fecha: fechaHoy,
    dia: servicio.dia || 'General',
    chofer: servicio.chofer,
    camion: servicio.camion,
    rutaNombre: servicio.rutaNombre || 'Ruta 1',
    km: km,
    obs: obs,
    horaInicio: servicio.inicio,
    horaFin: horaFin,
    detalleClientes: detalleClientes,
    estado: 'completada'
  };

  historialFinalizadas.unshift(rutaFinalizadaHistorial);

  // Limpiar envases temporales del servicio activo
  if (servicio.clientes) {
    servicio.clientes.forEach(clienteNombre => {
      const key = `${servicio.chofer}_${clienteNombre}`;
      delete envasesPorClienteRuta[key];
    });
  }

  delete serviciosActivos[choferTarget];
  if (choferAcordeonAbierto === choferTarget) choferAcordeonAbierto = null;

  if (kmInput) kmInput.value = '';
  if (obsInput) obsInput.value = '';
  
  // Guardar permanente en localStorage
  guardarDatosEnLocal();
  toggleModalCierreFinal(false);
  renderModuloLogistica();
  if (typeof renderHistorialChoferesGrid === 'function') renderHistorialChoferesGrid();
  if (typeof verDetalleHistorialChofer === 'function' && window.choferSeleccionadoActual === servicio.chofer) {
    verDetalleHistorialChofer(servicio.chofer);
  }
  mostrarToastLogistica(`✓ Ruta Finalizada para ${servicio.chofer}. Guardada en su historial y retirada de disponibles.`);
};

window.enviarAlertaUltimaHora = function() {
  const msg = prompt('Introduce la notificación urgente para la PDA:', 'Llevar 3 jaulas vacías a Las Vegas');
  if (msg) alert(`🚨 [NOTIFICACIÓN PUSH ENVIADA]\n\n" ${msg} "`);
};

function actualizarSelectorRutasParaChoferInicio(choferNombre) {
  const containerRutasAsignadas = document.getElementById('contenedor-selector-ruta-inicio');
  if (!containerRutasAsignadas) return;

  const rutasDelChofer = rutas.filter(r => 
    r.chofer && r.chofer.trim().toLowerCase() === choferNombre.trim().toLowerCase() &&
    r.estado !== 'completada' && r.estado !== 'finalizada' && r.estado !== 'archivada'
  );

  if (rutasDelChofer.length === 0) {
    containerRutasAsignadas.innerHTML = `<p class="text-xs text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-200">El conductor no tiene rutas específicas asignadas o todas han sido finalizadas.</p>`;
    const inputRutaOculto = document.getElementById('fichaje-ruta-seleccionada-idx');
    if (inputRutaOculto) inputRutaOculto.value = '';
    return;
  }

  containerRutasAsignadas.innerHTML = `
    <div class="space-y-3">
      <label class="block text-xs font-extrabold text-blue-900 uppercase">Selecciona la Ruta y Jornada Asignada:</label>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
        ${rutasDelChofer.map((r, idx) => `
          <div onclick="fijarRutaInicioSeleccionada(${idx}, '${r.dia}', '${r.camion || ''}')" class="bg-white p-3 rounded-xl border border-slate-200 hover:border-blue-500 cursor-pointer transition-all space-y-1 shadow-2xs group">
            <div class="flex justify-between items-center">
              <span class="font-extrabold text-xs text-blue-900 uppercase bg-blue-50 px-2 py-0.5 rounded">📅 ${r.dia} - Ruta ${idx + 1}</span>
              <span class="text-[11px] font-bold text-slate-600">🚛 ${r.camion || 'Sin vehículo fijo'}</span>
            </div>
            <div class="text-[11px] text-slate-600 pt-1">
              <p class="font-semibold text-slate-700">Clientes (${r.clientes ? r.clientes.length : 0}):</p>
              <p class="italic text-slate-500 truncate">${r.clientes ? r.clientes.join(', ') : 'Ninguno'}</p>
            </div>
          </div>
        `).join('')}
      </div>
      <input type="hidden" id="fichaje-ruta-seleccionada-idx" value="">
    </div>
  `;
}

window.fijarRutaInicioSeleccionada = function(idxRuta, dia, camionSugerido) {
  const choferInput = document.getElementById('fichaje-chofer-input');
  if (!choferInput) return;

  const rutasChoferActual = rutas.filter(r => 
    r.chofer === choferInput.value && 
    r.estado !== 'completada' && r.estado !== 'finalizada' && r.estado !== 'archivada'
  );
  const rutaElegida = rutasChoferActual[idxRuta];
  if (!rutaElegida) return;

  const inputOculto = document.getElementById('fichaje-ruta-seleccionada-idx');
  if (inputOculto) inputOculto.value = idxRuta;

  if (camionSugerido && camionSugerido !== '') {
    seleccionarCamionInicio(camionSugerido, '');
  }

  mostrarToastLogistica(`✓ Ruta seleccionada (${dia}): ${rutaElegida.clientes ? rutaElegida.clientes.length : 0} clientes cargados.`);
};

/* --- VISUALIZACIÓN DE RUTAS POR CHÓFER (CUADRÍCULA & PANEL DETALLADO POR DÍAS) --- */
let choferRutasSeleccionado = null;
let filtroDiaRutasChofer = 'Todos';

window.filtrarDiaDetalleRutas = function(dia) {
  filtroDiaRutasChofer = dia;
  if (choferRutasSeleccionado) {
    verDetalleRutasChofer(choferRutasSeleccionado);
  }
};

window.iniciarRutaDirectaDesdePortal = function(choferNombre, dia, rutaIdx, rutaIdParam = null) {
  if (serviciosActivos && serviciosActivos[choferNombre]) {
    alert(`El conductor ${choferNombre} ya tiene una ruta activa en curso (${serviciosActivos[choferNombre].rutaNombre || 'Ruta'}). Debes finalizarla antes de iniciar otra.`);
    return;
  }

  let rutaElegida = null;
  if (rutaIdParam) {
    rutaElegida = rutas.find(r => r.id === rutaIdParam);
  }
  if (!rutaElegida) {
    const rutasDelChoferDia = (typeof rutas !== 'undefined' && Array.isArray(rutas))
      ? rutas.filter(r => 
          r.chofer && r.chofer.trim().toLowerCase() === choferNombre.trim().toLowerCase() && 
          r.dia && r.dia.trim().toLowerCase() === dia.trim().toLowerCase()
        )
      : [];
    rutaElegida = rutasDelChoferDia[rutaIdx];
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

  ejecutarInicioServicioDefinitivo(choferNombre, camionFinal, dia, rutaIdx, rutaElegida.id);
  if (typeof switchTab === 'function') switchTab('logistica');
  mostrarToastLogistica(`🚀 Ruta iniciada para ${choferNombre}: ${dia} - Ruta ${rutaIdx + 1}`);
};

function asegurarEstructuraVisualizacionRutas() {
  const seccion = document.getElementById('section-vista-chofer');
  if (!seccion) return null;

  let grid = document.getElementById('grid-choferes-rutas');
  let panel = document.getElementById('panel-detalle-rutas-chofer');

  // Si no existen los contenedores nuevos (por ejemplo, si aún estuviese el select anterior), los creamos dinámicamente
  if (!grid || !panel) {
    seccion.innerHTML = `
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 class="text-xl sm:text-2xl font-extrabold text-blue-950 flex items-center gap-2.5">
            <i class="fa-solid fa-route text-indigo-600"></i> Visualización de Rutas por Chofer
          </h2>
          <p class="text-sm text-slate-500 mt-0.5">Selecciona la tarjeta de un conductor para consultar su planificación semanal de rutas por días.</p>
        </div>
      </div>

      <!-- CUADRÍCULA (GRID) CON LAS TARJETAS DE TODOS LOS CHÓFERES -->
      <div id="grid-choferes-rutas" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"></div>

      <!-- PANEL DETALLADO DE RUTAS DEL CHÓFER POR DÍAS -->
      <div id="panel-detalle-rutas-chofer" class="hidden light-card rounded-2xl p-6 sm:p-8 border border-indigo-200 space-y-6">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
          <div class="flex items-center gap-4">
            <button onclick="cerrarDetalleRutasChofer()" class="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center text-base transition-colors cursor-pointer" title="Volver a la cuadrícula de conductores">
              <i class="fa-solid fa-arrow-left"></i>
            </button>
            <div id="detalle-chofer-avatar-container" class="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg overflow-hidden border border-indigo-200 shrink-0">
              <i class="fa-solid fa-user"></i>
            </div>
            <div>
              <h3 id="detalle-chofer-nombre-titulo" class="text-2xl font-extrabold text-blue-950">Nombre Conductor</h3>
              <p id="detalle-chofer-info-subtitulo" class="text-xs sm:text-sm text-slate-500">DNI: - | Tel: -</p>
            </div>
          </div>
          <span id="badge-total-rutas-chofer-semana" class="px-4 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs sm:text-sm font-bold">
            0 Rutas Asignadas
          </span>
        </div>

        <!-- SELECTOR INTERACTIVO POR DÍAS DE LA SEMANA -->
        <div id="filtro-dias-semana-chofer-container" class="flex flex-wrap gap-1.5 border-b border-slate-100 pb-4"></div>

        <div id="contenedor-desglose-rutas-por-dias" class="space-y-6"></div>
      </div>
    `;
    grid = document.getElementById('grid-choferes-rutas');
    panel = document.getElementById('panel-detalle-rutas-chofer');
  }

  return { grid, panel };
}

window.renderVisualizacionRutasChoferes = function() {
  const containers = asegurarEstructuraVisualizacionRutas();
  if (!containers) return;
  const { grid, panel } = containers;

  // Si no hay un chofer seleccionado actualmente para ver detalles, mostramos la cuadrícula
  if (!choferRutasSeleccionado) {
    if (grid) grid.classList.remove('hidden');
    if (panel) panel.classList.add('hidden');
  } else {
    // Si ya había uno seleccionado, refrescamos su panel detallado
    verDetalleRutasChofer(choferRutasSeleccionado);
    return;
  }

  if (!grid) return;

  if (!choferes || choferes.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full light-card rounded-2xl p-10 text-center space-y-3 border border-slate-200">
        <div class="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-2xl">
          <i class="fa-solid fa-users-slash"></i>
        </div>
        <h4 class="font-bold text-slate-700 text-base">No hay chóferes registrados</h4>
        <p class="text-xs text-slate-400">Registra conductores desde la pestaña de Choferes / Personal para asignarles rutas semanales.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = choferes.map(ch => {
    const rutasDelChofer = (typeof rutas !== 'undefined' && Array.isArray(rutas)) 
      ? rutas.filter(r => r.chofer && r.chofer.trim().toLowerCase() === ch.nombre.trim().toLowerCase()) 
      : [];
    const diasConRuta = new Set(rutasDelChofer.map(r => r.dia)).size;
    const estaEnRuta = !!(serviciosActivos && serviciosActivos[ch.nombre]);

    // Mini-resumen de días con ruta asignada
    const diasAbreviados = { 'Lunes': 'L', 'Martes': 'M', 'Miércoles': 'X', 'Jueves': 'J', 'Viernes': 'V', 'Sábado': 'S', 'Domingo': 'D' };
    const diasActivos = new Set(rutasDelChofer.map(r => r.dia));
    const totalClientes = rutasDelChofer.reduce((sum, r) => sum + (r.clientes ? r.clientes.length : 0), 0);

    return `
      <div onclick="verDetalleRutasChofer('${ch.nombre.replace(/'/g, "\\'")}')" class="light-card light-card-hover rounded-2xl p-4 border ${estaEnRuta ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200'} cursor-pointer hover:border-indigo-400 hover:shadow-md transition-all group flex flex-col justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-xl ${estaEnRuta ? 'bg-emerald-100 text-emerald-600 border-emerald-200' : 'bg-indigo-50 text-indigo-600 border-indigo-100'} flex items-center justify-center overflow-hidden border-2 group-hover:border-indigo-500 transition-all shadow-inner shrink-0">
            ${ch.foto ? `<img src="${ch.foto}" class="w-full h-full object-cover" alt="${ch.nombre}">` : '<i class="fa-solid fa-user text-lg"></i>'}
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
            <span class="font-bold text-indigo-700">${rutasDelChofer.length}r</span>
            <span class="text-slate-300">·</span>
            <span class="font-bold text-slate-600">${totalClientes}c</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
};

window.verDetalleRutasChofer = function(nombreChofer) {
  choferRutasSeleccionado = nombreChofer;
  const containers = asegurarEstructuraVisualizacionRutas();
  if (!containers) return;
  const { grid, panel } = containers;

  if (grid) grid.classList.add('hidden');
  if (panel) panel.classList.remove('hidden');

  const ch = (typeof choferes !== 'undefined' ? choferes.find(c => c.nombre.trim().toLowerCase() === nombreChofer.trim().toLowerCase()) : null) || {
    nombre: nombreChofer,
    dni: 'No especificado',
    foto: '',
    telefono: ''
  };

  // Actualizar cabecera del panel detallado
  const titNombre = document.getElementById('detalle-chofer-nombre-titulo');
  const subInfo = document.getElementById('detalle-chofer-info-subtitulo');
  const avatarCont = document.getElementById('detalle-chofer-avatar-container');
  const badgeTotal = document.getElementById('badge-total-rutas-chofer-semana');

  if (titNombre) titNombre.innerText = ch.nombre;
  if (subInfo) subInfo.innerText = `DNI: ${ch.dni || 'No especificado'}${ch.telefono ? ' | Tel: ' + ch.telefono : ''}`;
  if (avatarCont) {
    avatarCont.innerHTML = ch.foto 
      ? `<img src="${ch.foto}" class="w-full h-full object-cover" alt="${ch.nombre}">` 
      : `<i class="fa-solid fa-user text-xl"></i>`;
  }

  const contenedorDias = document.getElementById('contenedor-desglose-rutas-por-dias');
  if (!contenedorDias) return;

  const diasOrdenados = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const rutasDelChofer = (typeof rutas !== 'undefined' && Array.isArray(rutas))
    ? rutas.filter(r => r.chofer && r.chofer.trim().toLowerCase() === nombreChofer.trim().toLowerCase())
    : [];

  if (badgeTotal) {
    badgeTotal.innerText = `${rutasDelChofer.length} ${rutasDelChofer.length === 1 ? 'Ruta Asignada' : 'Rutas Asignadas en Total'}`;
  }

  // Comprobar días con rutas asignadas
  const diasConRutas = diasOrdenados.filter(dia => 
    rutasDelChofer.some(r => r.dia && r.dia.trim().toLowerCase() === dia.trim().toLowerCase())
  );

  // Renderizar pills de selector de días de la semana
  const mapaDiasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const diaHoy = mapaDiasSemana[new Date().getDay()];
  const contenedorPills = document.getElementById('filtro-dias-semana-chofer-container');

  if (contenedorPills) {
    contenedorPills.innerHTML = `
      <button onclick="filtrarDiaDetalleRutas('Todos')" class="px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${filtroDiaRutasChofer === 'Todos' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}">
        Todos (${rutasDelChofer.length})
      </button>
      ${diasOrdenados.map(d => {
        const numRutasDia = rutasDelChofer.filter(r => r.dia && r.dia.trim().toLowerCase() === d.trim().toLowerCase()).length;
        const esHoy = (d === diaHoy);
        const estaSeleccionado = (filtroDiaRutasChofer === d);

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
  if (filtroDiaRutasChofer !== 'Todos') {
    diasParaMostrar = diasConRutas.filter(d => d.trim().toLowerCase() === filtroDiaRutasChofer.trim().toLowerCase());
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

  if (diasParaMostrar.length === 0 && filtroDiaRutasChofer !== 'Todos') {
    contenedorDias.innerHTML = `
      <div class="light-card rounded-2xl p-8 text-center space-y-3 border border-slate-200">
        <div class="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-xl">
          <i class="fa-solid fa-calendar-day"></i>
        </div>
        <h4 class="font-extrabold text-slate-700 text-sm">Sin rutas para el ${filtroDiaRutasChofer}</h4>
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
    const rutasDelDia = rutasDelChofer.filter(r => r.dia && r.dia.trim().toLowerCase() === dia.trim().toLowerCase());
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
            const estaCompletada = (r.estado === 'completada' || r.estado === 'finalizada');
            return `
            <div class="bg-slate-50/90 rounded-2xl p-4 sm:p-5 border ${estaCompletada ? 'border-emerald-300 bg-emerald-50/20' : 'border-slate-200'} space-y-3.5 hover:border-indigo-300 transition-all shadow-2xs">
              
              <!-- ENCABEZADO DE LA RUTA Y ACCIÓN DE INICIO DIRECTO -->
              <div class="flex flex-wrap justify-between items-center gap-2 border-b border-slate-200/80 pb-3">
                <div class="flex items-center gap-2.5 flex-wrap">
                  <span class="px-3 py-1.5 ${estaCompletada ? 'bg-emerald-600' : 'bg-blue-600'} text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
                    <i class="fa-solid fa-route"></i> Ruta ${rIdx + 1}
                  </span>
                  <span class="px-3 py-1.5 bg-white text-slate-800 rounded-xl text-xs font-bold border border-slate-200 flex items-center gap-1.5 shadow-2xs">
                    <i class="fa-solid fa-truck text-blue-600"></i> Vehículo: <strong class="text-blue-950">${r.camion || 'No asignado'}</strong>
                  </span>
                  ${r.tipoCliente ? `<span class="px-2.5 py-1 bg-purple-50 text-purple-700 rounded-lg text-xs font-semibold border border-purple-200">${r.tipoCliente}</span>` : ''}
                  <span class="text-xs font-bold text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                    <i class="fa-solid fa-shop text-slate-400 mr-1"></i>${r.clientes ? r.clientes.length : 0} ${r.clientes && r.clientes.length === 1 ? 'establecimiento' : 'establecimientos'}
                  </span>
                </div>

                <!-- BOTÓN PARA INICIAR ESTA RUTA DIRECTAMENTE DESDE EL PORTAL O DISTINTIVO SI YA ESTÁ COMPLETADA -->
                ${estaCompletada ? `
                  <span class="px-3.5 py-1.5 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-black flex items-center gap-1.5 border border-emerald-300 shadow-2xs">
                    <i class="fa-solid fa-check-double text-emerald-600"></i> Finalizada
                  </span>
                ` : `
                  <button type="button" onclick="iniciarRutaDirectaDesdePortal('${ch.nombre.replace(/'/g, "\\'")}', '${dia}', ${rIdx}, '${r.id || ''}')" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer hover:scale-105 active:scale-95" title="Iniciar esta ruta en el Terminal de Logística">
                    <i class="fa-solid fa-play text-[10px]"></i> Iniciar Esta Ruta
                  </button>
                `}
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
                      ${r.clientes.map((clienteNombre, cIdx) => {
                        const cliInfo = (typeof clientes !== 'undefined' && Array.isArray(clientes)) 
                          ? clientes.find(c => c.nombre && c.nombre.trim().toLowerCase() === clienteNombre.trim().toLowerCase()) 
                          : null;

                        let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
                        if (cliInfo && cliInfo.tipo === 'Hoteles') badgeColor = 'bg-purple-100 text-purple-700 border-purple-200';
                        if (cliInfo && cliInfo.tipo === 'Restaurantes') badgeColor = 'bg-blue-100 text-blue-700 border-blue-200';
                        if (cliInfo && cliInfo.tipo === 'Camping') badgeColor = 'bg-amber-100 text-amber-700 border-amber-200';
                        if (cliInfo && cliInfo.tipo === 'Mixto') badgeColor = 'bg-emerald-100 text-emerald-700 border-emerald-200';

                        return `
                          <div class="bg-white p-3 rounded-xl border border-slate-200 hover:border-indigo-300 transition-all flex flex-col justify-between gap-2 shadow-2xs group">
                            
                            <!-- INFORMACIÓN DEL CLIENTE -->
                            <div class="space-y-1">
                              <div class="flex items-center justify-between gap-1">
                                <span class="w-5 h-5 rounded-md bg-blue-100 text-blue-800 font-black flex items-center justify-center text-[10px] shrink-0">
                                  ${cIdx + 1}
                                </span>
                                ${cliInfo && cliInfo.tipo ? `<span class="text-[9px] px-1.5 py-0.5 rounded font-extrabold border ${badgeColor}">${cliInfo.tipo}</span>` : ''}
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

                            <!-- ACCIONES DIRECTAS (GPS Y TELÉFONO) -->
                            <div class="flex items-center gap-1.5 pt-1.5 border-t border-slate-100">
                              <button type="button" onclick="abrirNavegacionGPSCliente('${clienteNombre.replace(/'/g, "\\'")}')" class="flex-1 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs" title="Navegar en Google Maps">
                                <i class="fa-solid fa-diamond-turn-right text-[9px]"></i> GPS
                              </button>
                              ${cliInfo && cliInfo.telefono ? `
                                <a href="tel:${cliInfo.telefono}" class="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[10px] font-bold flex items-center gap-1 border border-blue-200 transition-colors" title="Llamar: ${cliInfo.telefono}">
                                  <i class="fa-solid fa-phone text-[9px]"></i>
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

window.cerrarDetalleRutasChofer = function() {
  choferRutasSeleccionado = null;
  filtroDiaRutasChofer = 'Todos';
  const grid = document.getElementById('grid-choferes-rutas');
  const panel = document.getElementById('panel-detalle-rutas-chofer');
  if (grid) grid.classList.remove('hidden');
  if (panel) panel.classList.add('hidden');
};

// Aliases para compatibilidad con llamadas existentes en el proyecto
window.actualizarSelectPortalChoferes = window.renderVisualizacionRutasChoferes;
window.mostrarRutasChofer = window.verDetalleRutasChofer;
window.seleccionarConductorCentral = window.verDetalleRutasChofer;
window.abrirModalSelectorConductorCentralRutas = window.renderVisualizacionRutasChoferes;

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

/* --- HISTORIAL DE RUTAS FINALIZADAS Y DESPLIEGUE POR CHOFER --- */
// La lógica completa de agrupación jerárquica por meses, rendimiento optimizado y renderizado
// está centralizada en js/admin.js (window.renderizarRutasFinalizadasChofer y window.toggleHistorialChoferDetalle).
if (typeof window.renderizarRutasFinalizadasChofer !== 'function') {
  window.renderizarRutasFinalizadasChofer = function(rutas) {
    if (typeof verDetalleHistorialChofer === 'function' && window.choferSeleccionadoActual) {
      verDetalleHistorialChofer(window.choferSeleccionadoActual);
    }
  };
}

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
  toggleDropdownCamiones();
};

/* --- CONTROL DESPLEGABLE PERSONALIZADO DE CONDUCTORES --- */
window.toggleDropdownChoferes = function() {
  const menu = document.getElementById('menu-dropdown-chofer');
  if (menu) {
    menu.classList.toggle('hidden');
  }
};

window.seleccionarChoferRepostaje = function(nombre) {
  const inputHidden = document.getElementById('rep-chofer');
  if (inputHidden) {
    inputHidden.value = nombre;
  }
  const spanTexto = document.getElementById('text-rep-chofer');
  if (spanTexto) {
    spanTexto.textContent = nombre;
    spanTexto.classList.remove('text-slate-400', 'text-slate-500');
    spanTexto.classList.add('font-bold', 'text-indigo-950');
  }
  toggleDropdownChoferes();
};

document.addEventListener('click', function(e) {
  const container = document.getElementById('dropdown-camion-container');
  const menu = document.getElementById('menu-dropdown-camion');
  if (container && menu && !container.contains(e.target)) {
    menu.classList.add('hidden');
  }

  const containerChofer = document.getElementById('dropdown-chofer-container');
  const menuChofer = document.getElementById('menu-dropdown-chofer');
  if (containerChofer && menuChofer && !containerChofer.contains(e.target)) {
    menuChofer.classList.add('hidden');
  }
});
