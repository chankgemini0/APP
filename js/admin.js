/* --- REPOSTAJES & ADMIN GASOLINA --- */
window.toggleModalRepostaje = function(show) { 
  const m = document.getElementById('modal-repostaje');
  if (m) {
    if (show) {
      const selRepCamion = document.getElementById('rep-camion');
      if (selRepCamion && selRepCamion.tagName === 'SELECT' && (!selRepCamion.children || selRepCamion.children.length === 0) && typeof camiones !== 'undefined') {
        selRepCamion.innerHTML = camiones.map(c => `<option value="${c.matricula}">${c.matricula}</option>`).join('');
      }
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
  renderAdminCombustible();
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
    renderAdminCombustible();
  }
};

let filtroTiempoCombustible = 'todos';

window.setFiltroTiempoCombustible = function(filtro) {
  filtroTiempoCombustible = filtro;
  const botones = ['todos', 'diario', 'semanal', 'mensual', 'anual'];
  botones.forEach(b => {
    const el = document.getElementById(`filtro-rep-${b}`);
    if (el) {
      if (b === filtro) {
        el.className = 'px-3 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white border border-indigo-600 cursor-pointer transition-all shadow-sm';
      } else {
        el.className = 'px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200 cursor-pointer transition-all';
      }
    }
  });
  renderAdminCombustible();
};

function cumpleFiltroTiempoCombustible(fechaStr, filtro) {
  if (!filtro || filtro === 'todos') return true;
  if (!fechaStr) return false;

  const now = new Date();
  const cleanDateStr = fechaStr.split('T')[0];
  const parts = cleanDateStr.split('-');
  if (parts.length !== 3) return false;

  const anio = parseInt(parts[0], 10);
  const mes = parseInt(parts[1], 10) - 1; // 0 indexado
  const dia = parseInt(parts[2], 10);

  const fechaObj = new Date(anio, mes, dia);
  if (isNaN(fechaObj.getTime())) return false;

  const anioActual = now.getFullYear();
  const mesActual = now.getMonth();
  const diaActual = now.getDate();

  if (filtro === 'diario') {
    return anio === anioActual && mes === mesActual && dia === diaActual;
  }

  if (filtro === 'semanal') {
    const diaSemana = (now.getDay() + 6) % 7; // 0 = Lunes, ..., 6 = Domingo
    const lunes = new Date(anioActual, mesActual, diaActual - diaSemana, 0, 0, 0, 0);
    const domingo = new Date(anioActual, mesActual, diaActual - diaSemana + 6, 23, 59, 59, 999);
    return fechaObj >= lunes && fechaObj <= domingo;
  }

  if (filtro === 'mensual') {
    return anio === anioActual && mes === mesActual;
  }

  if (filtro === 'anual') {
    return anio === anioActual;
  }

  return true;
}

function renderAdminCombustible() {
  const container = document.getElementById('contenedor-resumen-combustible-admin');
  if (!container) return;

  const inputBusqueda = document.getElementById('buscar-repostaje');
  const textoBusqueda = inputBusqueda ? inputBusqueda.value.toLowerCase().trim() : '';

  const listaRepostajes = typeof repostajes !== 'undefined' ? repostajes : [];

  // Mapeamos con índice original para poder gestionar/eliminar si fuese necesario
  const repostajesConIndex = listaRepostajes.map((r, idx) => ({ ...r, originalIndex: idx }));

  // 1. Filtrado por texto (chofer o camión) y por filtro temporal activo
  const filtrados = repostajesConIndex.filter(r => {
    const chofer = (r.chofer || 'General').toLowerCase();
    const camion = (r.camion || '').toLowerCase();
    const coincideTexto = !textoBusqueda || chofer.includes(textoBusqueda) || camion.includes(textoBusqueda);
    const coincideTiempo = cumpleFiltroTiempoCombustible(r.fecha, filtroTiempoCombustible);
    return coincideTexto && coincideTiempo;
  });

  // 2. Agrupación por conductor
  const resumenPorChofer = {};
  filtrados.forEach(r => {
    const choferNombre = (r.chofer && r.chofer.trim()) ? r.chofer.trim() : 'General';
    if (!resumenPorChofer[choferNombre]) {
      resumenPorChofer[choferNombre] = {
        litros: 0,
        euros: 0,
        tickets: 0,
        items: []
      };
    }
    const l = parseFloat(r.litros || 0) || 0;
    const e = parseFloat(r.euros || 0) || 0;
    resumenPorChofer[choferNombre].litros += l;
    resumenPorChofer[choferNombre].euros += e;
    resumenPorChofer[choferNombre].tickets += 1;
    resumenPorChofer[choferNombre].items.push(r);
  });

  const conductores = Object.keys(resumenPorChofer);

  // Si no hay datos tras aplicar los filtros
  if (conductores.length === 0) {
    container.innerHTML = `
      <div class="col-span-full light-card p-10 rounded-2xl text-center text-slate-500 space-y-3 border border-slate-200">
        <div class="w-14 h-14 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto text-2xl border border-indigo-100">
          <i class="fa-solid fa-gas-pump"></i>
        </div>
        <div class="space-y-1">
          <h4 class="font-extrabold text-slate-800 text-base">No hay repostajes registrados</h4>
          <p class="text-xs text-slate-500 max-w-md mx-auto">
            ${textoBusqueda 
              ? `No se encontraron tickets que coincidan con "${textoBusqueda}" en el periodo ${filtroTiempoCombustible}.` 
              : `No existen registros de repostaje para el filtro temporal seleccionado (${filtroTiempoCombustible}).`}
          </p>
        </div>
      </div>
    `;
    return;
  }

  // 3. Renderizado de tarjetas visualmente atractivas por conductor
  container.innerHTML = conductores.map(nombre => {
    const data = resumenPorChofer[nombre];
    // Ordenar tickets más recientes primero
    data.items.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

    // Buscar si el chofer tiene foto registrada
    const choferObj = (typeof choferes !== 'undefined') ? choferes.find(c => c.nombre === nombre) : null;
    const avatarHtml = (choferObj && choferObj.foto)
      ? `<img src="${choferObj.foto}" alt="${nombre}" class="w-11 h-11 rounded-xl object-cover border border-indigo-200 shadow-sm">`
      : `<div class="w-11 h-11 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-bold text-lg border border-indigo-100 shadow-sm"><i class="fa-solid fa-user-gear"></i></div>`;

    return `
      <div class="light-card light-card-hover rounded-2xl p-5 sm:p-6 border border-indigo-100 space-y-4 shadow-sm flex flex-col justify-between">
        <!-- Cabecera de la tarjeta del conductor -->
        <div class="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div class="flex items-center gap-3 min-w-0">
            ${avatarHtml}
            <div class="min-w-0">
              <h3 class="font-extrabold text-slate-800 text-lg truncate">${nombre}</h3>
              <p class="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mt-0.5">
                <span class="w-2 h-2 rounded-full bg-indigo-500 inline-block"></span>
                ${data.tickets} ${data.tickets === 1 ? 'ticket registrado' : 'tickets registrados'}
              </p>
            </div>
          </div>
          <span class="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[11px] font-black uppercase rounded-lg border border-indigo-100 shrink-0">
            ${filtroTiempoCombustible}
          </span>
        </div>

        <!-- Dos recuadros grandes y destacados con los TOTALES: Litros (L) y Euros (€) -->
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-indigo-50/70 p-3.5 sm:p-4 rounded-xl border border-indigo-100 text-center">
            <span class="text-[11px] font-extrabold uppercase text-indigo-700 tracking-wider flex items-center justify-center gap-1.5">
              <i class="fa-solid fa-gas-pump"></i> Litros
            </span>
            <p class="text-2xl sm:text-3xl font-black text-indigo-950 mt-1">
              ${data.litros.toFixed(2)} <span class="text-xs sm:text-sm font-bold text-indigo-600">L</span>
            </p>
          </div>
          <div class="bg-emerald-50/70 p-3.5 sm:p-4 rounded-xl border border-emerald-100 text-center">
            <span class="text-[11px] font-extrabold uppercase text-emerald-700 tracking-wider flex items-center justify-center gap-1.5">
              <i class="fa-solid fa-euro-sign"></i> Importe
            </span>
            <p class="text-2xl sm:text-3xl font-black text-emerald-950 mt-1">
              ${data.euros.toFixed(2)} <span class="text-xs sm:text-sm font-bold text-emerald-600">€</span>
            </p>
          </div>
        </div>

        <!-- Historial detallado con scroll para cada repostaje -->
        <div class="space-y-2 pt-2 border-t border-slate-100 flex-1 flex flex-col min-h-0">
          <div class="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
            <span class="flex items-center gap-1.5">
              <i class="fa-solid fa-clock-rotate-left text-slate-400"></i> Historial Detallado
            </span>
            <span class="text-[11px] font-medium text-slate-400 lowercase">${data.items.length} ${data.items.length === 1 ? 'ticket' : 'tickets'}</span>
          </div>

          <div class="max-h-56 overflow-y-auto custom-scrollbar space-y-2 pr-1">
            ${data.items.map(r => `
              <div class="bg-slate-50 hover:bg-indigo-50/40 transition-colors p-3 rounded-xl border border-slate-200/80 flex items-center justify-between gap-3 text-xs">
                <div class="space-y-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-extrabold text-slate-800 flex items-center gap-1.5">
                      <i class="fa-solid fa-truck-side text-indigo-600 text-xs"></i> ${r.camion || 'Sin matrícula'}
                    </span>
                    ${r.tipo ? `<span class="px-1.5 py-0.5 bg-slate-200/70 text-slate-600 rounded text-[10px] font-semibold">${r.tipo}</span>` : ''}
                  </div>
                  <div class="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                    <span><i class="fa-regular fa-calendar text-slate-400"></i> ${r.fecha || 'Sin fecha'}</span>
                    ${r.km ? `<span class="text-slate-400">• ${r.km} KM</span>` : ''}
                    ${r.adblue ? `<span class="text-blue-500 font-medium">• ${r.adblue}L AdBlue</span>` : ''}
                  </div>
                </div>
                <div class="flex items-center gap-2.5 shrink-0">
                  <div class="text-right">
                    <p class="font-extrabold text-emerald-700 text-sm sm:text-base">${parseFloat(r.euros || 0).toFixed(2)} €</p>
                    <p class="text-xs font-bold text-indigo-700">${parseFloat(r.litros || 0).toFixed(2)} L</p>
                  </div>
                  <button onclick="eliminarRepostajeAdmin(${r.originalIndex})" class="text-slate-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer" title="Eliminar ticket añadido por error">
                    <i class="fa-solid fa-trash-can text-xs"></i>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.renderAdminCombustible = renderAdminCombustible;

/* --- INCIDENCIAS --- */
window.toggleModalIncidencia = function(show) { 
  const m = document.getElementById('modal-incidencia');
  if (m) m.classList.toggle('hidden', !show); 
};

window.guardarIncidencia = function(e) {
  if (e) e.preventDefault();
  incidencias.unshift({
    fecha: new Date().toISOString().split('T')[0],
    categoria: document.getElementById('inc-categoria').value,
    camion: document.getElementById('inc-camion').value,
    nota: document.getElementById('inc-nota').value,
    resuelto: false
  });
  guardarDatosEnLocal();
  toggleModalIncidencia(false);
  renderIncidencias();
  if (document.getElementById('section-incidencias') && !document.getElementById('section-incidencias').classList.contains('hidden')) {
    renderSeccionIncidencias();
  }
};

function renderIncidencias() {
  const container = document.getElementById('lista-incidencias');
  if (!container) return;
  const enCurso = incidencias.filter(i => !i.resuelto);
  if (enCurso.length === 0) {
    container.innerHTML = '<p class="text-xs text-slate-500 italic">Sin incidencias en curso.</p>';
    return;
  }
  container.innerHTML = enCurso.slice(0, 3).map((i, index) => {
    const originalIndex = incidencias.indexOf(i);
    return `
      <div class="bg-red-50/50 p-3 rounded-xl border border-red-200 text-xs space-y-1">
        <div class="flex justify-between font-bold text-slate-800">
          <span class="text-red-600"><i class="fa-solid fa-triangle-exclamation"></i> ${i.categoria} (${i.camion})</span>
          <span class="text-slate-500">${i.fecha}</span>
        </div>
        <p class="text-slate-600">${i.nota}</p>
        <button onclick="resolverIncidencia(${originalIndex})" class="mt-1 text-[10px] font-bold bg-emerald-600 text-white px-2.5 py-1 rounded-lg hover:bg-emerald-700 cursor-pointer">✓ Marcar Resuelta</button>
      </div>
    `;
  }).join('');
}

/* --- FLOTA BUGAMED --- */
function renderCamiones() {
  const container = document.getElementById('lista-camiones');
  if (!container) return;

  const grandes = camiones.filter(c => c.tipo === 'Grande');
  const pequenos = camiones.filter(c => c.tipo === 'Pequeño');

  const elG = document.getElementById('cnt-camiones-grandes');
  const elP = document.getElementById('cnt-camiones-pequenos');
  if (elG) elG.innerText = `${grandes.length} vehículo(s) registrado(s)`;
  if (elP) elP.innerText = `${pequenos.length} vehículo(s) registrado(s)`;

  let filtrados = camiones;
  const titFiltro = document.getElementById('titulo-filtro-camion');
  
  if (typeof filtroCamionActual !== 'undefined' && filtroCamionActual && filtroCamionActual !== 'Todos') {
    filtrados = camiones.filter(c => c.tipo === filtroCamionActual);
    if (titFiltro) titFiltro.innerText = `Vehículos Categoría: ${filtroCamionActual}`;
  } else {
    if (titFiltro) titFiltro.innerText = 'Todos los Vehículos';
  }

  if (filtrados.length === 0) {
    container.innerHTML = '<p class="text-slate-500 text-xs italic col-span-full text-center py-6">No hay vehículos registrados.</p>';
    return;
  }

  container.innerHTML = filtrados.map((c) => {
    const indexOriginal = camiones.indexOf(c);
    const bgStyle = c.foto ? `background-image: linear-gradient(to bottom, rgba(15, 23, 42, 0.7), rgba(15, 23, 42, 0.9)), url('${c.foto}'); background-size: cover; background-position: center;` : '';
    
    return `
      <div class="light-card light-card-hover rounded-2xl p-6 border border-slate-200 flex justify-between items-start relative overflow-hidden" style="${bgStyle}">
        <div class="space-y-2 z-10">
          <span class="px-2.5 py-0.5 rounded text-[10px] font-bold ${c.tipo === 'Grande' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'} mb-2 inline-block">
            ${c.tipo === 'Grande' ? 'CAMIONES GRANDES' : 'CAMIONES PEQUEÑOS'}
          </span>
          <h4 class="font-extrabold ${c.foto ? 'text-white' : 'text-slate-800'} text-xl">${c.matricula}</h4>
          <p class="text-sm ${c.foto ? 'text-slate-200' : 'text-slate-600'} mb-2">${c.modelo}</p>
          <span class="text-xs px-2.5 py-1 rounded-lg font-bold ${c.estado && c.estado.includes('Ocupado') ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}">
            ${c.estado || 'Libre'}
          </span>
        </div>
        <div class="flex items-center gap-2 z-10">
          <button onclick="abrirModalEditarCamion(${indexOriginal})" class="${c.foto ? 'text-white hover:text-blue-300' : 'text-slate-400 hover:text-blue-600'} p-2 cursor-pointer" title="Modificar vehículo"><i class="fa-solid fa-pen-to-square"></i></button>
          <button onclick="eliminarCamion(${indexOriginal})" class="${c.foto ? 'text-white hover:text-red-300' : 'text-slate-400 hover:text-red-500'} p-2 cursor-pointer" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button>
        </div>
      </div>
    `;
  }).join('');
}

window.eliminarCamion = function(index) {
  if (typeof camiones === 'undefined' || !camiones[index]) return;
  const vehiculo = camiones[index];
  
  if (confirm(`¿Estás seguro de que deseas eliminar el vehículo con matrícula ${vehiculo.matricula}?`)) {
    camiones.splice(index, 1);
    if (typeof guardarDatosEnLocal === 'function') guardarDatosEnLocal();
    if (typeof renderCamiones === 'function') renderCamiones();
  }
};

window.agregarCamion = function(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();

  const modal = document.getElementById('modal-camion');
  const editIndex = modal ? modal.dataset.editIndex : null;

  const inputMat = document.getElementById('camion-matricula');
  const inputMod = document.getElementById('camion-modelo');
  const inputTip = document.getElementById('camion-tipo');
  const inputFoto = document.getElementById('camion-foto-input');

  if (!inputMat || !inputMat.value.trim()) {
    alert("Por favor, introduce la matrícula del vehículo.");
    if (inputMat) inputMat.focus();
    return;
  }

  const camionData = {
    matricula: inputMat.value.trim(),
    modelo: inputMod ? inputMod.value.trim() : 'Sin modelo',
    tipo: inputTip ? inputTip.value : 'Pequeño',
    estado: 'Libre',
    foto: inputFoto ? inputFoto.value.trim() : ''
  };

  if (editIndex !== undefined && editIndex !== null && editIndex !== '') {
    camionData.estado = camiones[editIndex].estado || 'Libre';
    camiones[editIndex] = camionData;
  } else {
    camiones.push(camionData);
  }

  guardarDatosEnLocal();
  if (modal) modal.classList.add('hidden');
  if (modal) delete modal.dataset.editIndex;
  if (typeof renderCamiones === 'function') renderCamiones();
};

window.manejarSubidaImagenCamion = function(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const inputFoto = document.getElementById('camion-foto-input');
    if (inputFoto) inputFoto.value = e.target.result;
    const preview = document.getElementById('preview-camion-subida');
    if (preview) preview.innerHTML = `<img src="${e.target.result}" class="w-full h-24 object-cover rounded-xl border border-blue-300">`;
  };
  reader.readAsDataURL(file);
};

window.filtrarIncidenciasTab = function(tipo) {
  filtroIncidenciasTab = tipo;
  const btnCurso = document.getElementById('btn-tab-inc-curso');
  const btnResueltas = document.getElementById('btn-tab-inc-resueltas');

  if (btnCurso) btnCurso.className = "px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-white transition-all cursor-pointer flex items-center gap-2";
  if (btnResueltas) btnResueltas.className = "px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-white transition-all cursor-pointer flex items-center gap-2";

  if (tipo === 'curso' && btnCurso) {
    btnCurso.className = "px-5 py-2.5 rounded-xl text-xs font-bold bg-red-600 text-white shadow-md transition-all cursor-pointer flex items-center gap-2";
  } else if (tipo === 'resueltas' && btnResueltas) {
    btnResueltas.className = "px-5 py-2.5 rounded-xl text-xs font-bold bg-purple-600 text-white shadow-md transition-all cursor-pointer flex items-center gap-2";
  }

  renderSeccionIncidencias();
};

function renderSeccionIncidencias() {
  const container = document.getElementById('lista-completa-incidencias');
  const badgeCurso = document.getElementById('badge-count-curso');
  const badgeResueltas = document.getElementById('badge-count-resueltas');
  if (!container) return;

  const enCurso = incidencias.filter(i => !i.resuelto);
  const resueltas = incidencias.filter(i => i.resuelto);

  if (badgeCurso) badgeCurso.innerText = enCurso.length;
  if (badgeResueltas) badgeResueltas.innerText = resueltas.length;

  const listaActual = (filtroIncidenciasTab === 'curso') ? enCurso : resueltas;

  if (listaActual.length === 0) {
    container.innerHTML = `<div class="col-span-full light-card p-10 rounded-2xl text-center text-slate-500 font-medium">No hay incidencias ${filtroIncidenciasTab === 'curso' ? 'en curso' : 'resueltas'}.</div>`;
    return;
  }

  container.innerHTML = listaActual.map((i) => {
    const originalIndex = incidencias.indexOf(i);
    const esResuelto = i.resuelto;

    return `
      <div class="light-card rounded-2xl p-6 border ${esResuelto ? 'border-emerald-200 bg-emerald-50/20' : 'border-red-200 bg-red-50/10'} space-y-3">
        <div class="flex justify-between items-start">
          <span class="px-3 py-1 rounded-full text-xs font-bold ${esResuelto ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">
            ${esResuelto ? '✓ Resuelta' : '⚠️ En Curso'}
          </span>
          <span class="text-xs text-slate-500 font-medium">${i.fecha}</span>
        </div>
        <div>
          <h4 class="font-extrabold text-slate-800 text-lg">${i.categoria} <span class="text-sm font-semibold text-slate-500">(${i.camion})</span></h4>
          <p class="text-xs text-slate-600 mt-1">${i.nota}</p>
        </div>
        <div class="pt-2 border-t border-slate-100 flex justify-between items-center">
          ${!esResuelto ? `
            <button onclick="resolverIncidencia(${originalIndex})" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-2xs cursor-pointer flex items-center gap-1.5">
              <i class="fa-solid fa-check"></i> Marcar Resuelta
            </button>
          ` : `
            <button onclick="resolverIncidencia(${originalIndex})" class="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl cursor-pointer">
              ↺ Reabrir Incidencia
            </button>
          `}
          <button onclick="eliminarIncidencia(${originalIndex})" class="text-slate-400 hover:text-red-500 text-xs p-1 cursor-pointer" title="Eliminar registro">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

window.resolverIncidencia = function(index) {
  if (incidencias[index]) {
    incidencias[index].resuelto = !incidencias[index].resuelto;
    guardarDatosEnLocal();
    renderIncidencias();
    if (document.getElementById('section-incidencias') && !document.getElementById('section-incidencias').classList.contains('hidden')) {
      renderSeccionIncidencias();
    }
  }
};

window.eliminarIncidencia = function(index) {
  if (confirm('¿Eliminar definitivamente este registro de incidencia?')) {
    incidencias.splice(index, 1);
    guardarDatosEnLocal();
    renderIncidencias();
    if (document.getElementById('section-incidencias') && !document.getElementById('section-incidencias').classList.contains('hidden')) {
      renderSeccionIncidencias();
    }
  }
};

/* --- CLIENTES (ADMIN) --- */
function renderClientes() {
  const container = document.getElementById('lista-clientes-por-zona');
  const elBusqueda = document.getElementById('buscar-cliente');
  if (!container) return;

  const textoBusqueda = elBusqueda ? elBusqueda.value.toLowerCase() : '';
  container.innerHTML = '';

  let filtrados = clientes.filter(c => {
    const coincide = c.nombre.toLowerCase().includes(textoBusqueda) ||
                     (c.zona && c.zona.toLowerCase().includes(textoBusqueda)) ||
                     (c.direccion && c.direccion.toLowerCase().includes(textoBusqueda));
    const coincideTipo = (filtroClienteActual === 'Todos') || (c.tipo === filtroClienteActual);
    return coincide && coincideTipo;
  });

  if (filtrados.length === 0) {
    container.innerHTML = `<div class="text-center py-12 light-card rounded-2xl border border-slate-200"><p class="text-slate-500 font-semibold">No se encontraron clientes.</p></div>`;
    return;
  }

  const zonas = {};
  filtrados.forEach(c => {
    const z = c.zona || 'Sin Zona Asignada';
    if (!zonas[z]) zonas[z] = [];
    zonas[z].push(c);
  });

  Object.keys(zonas).sort().forEach(zonaNom => {
    const clientesZona = zonas[zonaNom];
    container.innerHTML += `
      <div class="light-card rounded-2xl p-6 border border-purple-200 space-y-4">
        <div class="flex justify-between items-center border-b border-slate-100 pb-3">
          <h3 class="text-lg font-extrabold text-purple-900 flex items-center gap-2">
            <i class="fa-solid fa-location-dot text-purple-600"></i> Zona: ${zonaNom}
          </h3>
          <span class="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-bold border border-purple-200">
            ${clientesZona.length} cliente(s)
          </span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          ${clientesZona.map(c => {
            const idxOriginal = clientes.indexOf(c);
            let badgeColor = 'bg-purple-100 text-purple-700';
            if (c.tipo === 'Restaurantes') badgeColor = 'bg-blue-100 text-blue-700';
            if (c.tipo === 'Mixto') badgeColor = 'bg-emerald-100 text-emerald-700';
            if (c.tipo === 'Camping') badgeColor = 'bg-amber-100 text-amber-700';

            return `
              <div class="bg-slate-50 rounded-xl p-4 border border-slate-200 flex justify-between items-start gap-2 shadow-2xs hover:border-purple-300 transition-all">
                <div class="space-y-1.5 min-w-0 flex-1">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="px-2.5 py-0.5 rounded text-[10px] font-bold ${badgeColor}">
                      ${c.tipo}
                    </span>
                    ${c.ubicacion ? `
                      <a href="${c.ubicacion.startsWith('http') ? c.ubicacion : 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(c.ubicacion)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 transition-colors shadow-2xs" title="Abrir ubicación en Google Maps">
                        <i class="fa-solid fa-location-dot"></i> GPS Vinculado
                      </a>
                    ` : `
                      <span class="inline-flex items-center gap-1 text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded" title="Sin enlace directo de Google Maps">
                        <i class="fa-solid fa-map-pin text-slate-300"></i> Dirección genérica
                      </span>
                    `}
                  </div>
                  <h4 class="font-extrabold text-slate-800 text-base">${c.nombre}</h4>
                  ${c.direccion ? `<p class="text-xs text-slate-500"><i class="fa-solid fa-map-pin text-slate-400"></i> ${c.direccion}</p>` : ''}
                  ${c.telefono ? `<p class="text-xs text-blue-600 font-semibold"><i class="fa-solid fa-phone"></i> ${c.telefono}</p>` : ''}
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  <button onclick="abrirModalEditarCliente(${idxOriginal})" class="text-slate-400 hover:text-purple-600 p-1.5 cursor-pointer rounded-lg hover:bg-purple-50 transition-colors" title="Modificar cliente y ubicación GPS"><i class="fa-solid fa-pen-to-square"></i></button>
                  <button onclick="eliminarClienteAdmin(${idxOriginal})" class="text-slate-400 hover:text-red-500 p-1.5 cursor-pointer rounded-lg hover:bg-red-50 transition-colors" title="Admin: Eliminar cliente"><i class="fa-solid fa-trash-can"></i></button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  });
}

window.filtrarTipoCliente = function(tipo) {
  filtroClienteActual = tipo;
  ['Todos', 'Hoteles', 'Restaurantes', 'Mixto', 'Camping'].forEach(t => {
    const btn = document.getElementById(`filtro-cli-${t.toLowerCase()}`);
    if (btn) {
      if (t === tipo) {
        btn.className = "px-3 py-2 rounded-xl text-xs font-bold bg-purple-600 text-white border border-purple-600 cursor-pointer";
      } else {
        btn.className = "px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200 cursor-pointer";
      }
    }
  });

  renderClientes();
};

window.toggleModalCliente = function(show, editIndex = null) { 
  const modal = document.getElementById('modal-cliente');
  const form = document.getElementById('form-cliente');
  const inputEditIndex = document.getElementById('cli-edit-index');
  const tit = document.getElementById('modal-cliente-titulo');
  const sub = document.getElementById('modal-cliente-subtitulo');
  const btn = document.getElementById('btn-guardar-cliente');

  if (!modal) return;

  if (show) {
    if (editIndex !== null && editIndex !== undefined && editIndex !== '' && !isNaN(editIndex)) {
      const idx = parseInt(editIndex, 10);
      const c = clientes[idx];
      if (c) {
        if (inputEditIndex) inputEditIndex.value = idx;
        const inNombre = document.getElementById('cli-nombre');
        const inZona = document.getElementById('cli-zona');
        const inTipo = document.getElementById('cli-tipo');
        const inDireccion = document.getElementById('cli-direccion');
        const inTelefono = document.getElementById('cli-telefono');
        const inUbicacion = document.getElementById('cli-ubicacion');

        if (inNombre) inNombre.value = c.nombre || '';
        if (inZona) inZona.value = c.zona || '';
        if (inTipo) inTipo.value = c.tipo || 'Hoteles';
        if (inDireccion) inDireccion.value = c.direccion || '';
        if (inTelefono) inTelefono.value = c.telefono || '';
        if (inUbicacion) inUbicacion.value = c.ubicacion || '';

        if (tit) tit.innerHTML = '<i class="fa-solid fa-pen-to-square text-purple-600"></i> Modificar Cliente';
        if (sub) sub.innerText = 'Edita los datos del establecimiento o actualiza su ubicación en Google Maps';
        if (btn) btn.innerText = 'Guardar Cambios';
      }
    } else {
      if (inputEditIndex) inputEditIndex.value = '';
      if (form) form.reset();
      const inUbicacion = document.getElementById('cli-ubicacion');
      if (inUbicacion) inUbicacion.value = '';

      if (tit) tit.innerHTML = '<i class="fa-solid fa-hotel text-purple-600"></i> Registrar Nuevo Cliente';
      if (sub) sub.innerText = 'Completa la información del establecimiento y su ubicación exacta';
      if (btn) btn.innerText = 'Guardar Cliente';
    }
  }

  modal.classList.toggle('hidden', !show); 
};

window.abrirModalEditarCliente = function(index) {
  window.toggleModalCliente(true, index);
};

window.agregarClienteDirecto = function(e) {
  if (e) e.preventDefault();

  const inputEditIndex = document.getElementById('cli-edit-index');
  const editIndexVal = inputEditIndex ? inputEditIndex.value : '';

  const clienteData = {
    nombre: document.getElementById('cli-nombre')?.value.trim() || '',
    zona: document.getElementById('cli-zona')?.value.trim() || '',
    tipo: document.getElementById('cli-tipo')?.value || 'Hoteles',
    direccion: document.getElementById('cli-direccion')?.value.trim() || '',
    telefono: document.getElementById('cli-telefono')?.value.trim() || '',
    ubicacion: document.getElementById('cli-ubicacion')?.value.trim() || ''
  };

  if (!clienteData.nombre) {
    alert('Introduce el nombre del cliente o establecimiento.');
    return;
  }

  if (editIndexVal !== '' && !isNaN(editIndexVal)) {
    const idx = parseInt(editIndexVal, 10);
    if (idx >= 0 && idx < clientes.length) {
      clientes[idx] = clienteData;
    } else {
      clientes.push(clienteData);
    }
  } else {
    clientes.push(clienteData);
  }

  guardarDatosEnLocal();
  if (inputEditIndex) inputEditIndex.value = '';
  document.getElementById('form-cliente')?.reset();
  toggleModalCliente(false);
  renderClientes();
};

window.buscarUbicacionEnMapsForm = function() {
  const nombre = document.getElementById('cli-nombre')?.value.trim() || '';
  const direccion = document.getElementById('cli-direccion')?.value.trim() || '';
  const zona = document.getElementById('cli-zona')?.value.trim() || '';

  if (!nombre && !direccion) {
    alert('Introduce al menos el nombre del cliente o la dirección para buscar en Google Maps.');
    return;
  }

  const query = [nombre, direccion, zona].filter(Boolean).join(', ');
  const mapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

  const inputUbicacion = document.getElementById('cli-ubicacion');
  if (inputUbicacion && !inputUbicacion.value.trim()) {
    inputUbicacion.value = mapsSearchUrl;
  }

  window.open(mapsSearchUrl, '_blank');
};

window.capturarCoordenadasActualesForm = function() {
  if (!navigator.geolocation) {
    alert('Tu navegador no soporta geolocalización GPS.');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude.toFixed(6);
      const lon = pos.coords.longitude.toFixed(6);
      const coords = `${lat}, ${lon}`;
      const inputUbicacion = document.getElementById('cli-ubicacion');
      if (inputUbicacion) {
        inputUbicacion.value = coords;
      }
      alert(`📍 Coordenadas GPS actuales obtenidas correctamente:\n${coords}`);
    },
    (err) => {
      alert(`No se pudo obtener la posición GPS: ${err.message}`);
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
};

window.probarUbicacionMapsForm = function() {
  const inputUbicacion = document.getElementById('cli-ubicacion')?.value.trim();
  const nombre = document.getElementById('cli-nombre')?.value.trim() || '';
  const direccion = document.getElementById('cli-direccion')?.value.trim() || '';
  const zona = document.getElementById('cli-zona')?.value.trim() || '';

  let url = '';
  if (inputUbicacion) {
    if (inputUbicacion.startsWith('http://') || inputUbicacion.startsWith('https://')) {
      url = inputUbicacion;
    } else {
      url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(inputUbicacion)}`;
    }
  } else if (nombre || direccion) {
    const destino = [nombre, direccion, zona].filter(Boolean).join(', ');
    url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}`;
  } else {
    alert('Introduce una ubicación, enlace o dirección para probar la navegación.');
    return;
  }

  window.open(url, '_blank');
};

window.eliminarClienteAdmin = function(index) { 
  if (confirm('¿Admin: Deseas eliminar este cliente de forma permanente?')) {
    clientes.splice(index, 1); 
    guardarDatosEnLocal(); 
    renderClientes(); 
  }
};

/* --- CHOFERES / PERSONAL --- */
function renderChoferes() {
  const container = document.getElementById('lista-choferes');
  if (!container) return;
  
  if (choferes.length === 0) {
    container.innerHTML = '<p class="text-slate-500 text-xs italic col-span-full">No hay personal registrado.</p>';
    return;
  }

  container.innerHTML = choferes.map((ch, index) => {
    const enRuta = serviciosActivos[ch.nombre];
    let badgeHtml = '';
    if (enRuta) {
      badgeHtml = `<span class="px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 bg-purple-50 text-purple-700 border border-purple-200 animate-pulse">
        <i class="fa-solid fa-truck-fast"></i> En Ruta (${enRuta.camion})
      </span>`;
    } else if (ch.forzarNoDisponible) {
      badgeHtml = `<div data-accion="toggle-estado" data-index="${index}" class="px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200 cursor-pointer hover:bg-red-100 transition-colors shadow-xs select-none" title="Hacer clic para cambiar a Disponible">
        <i class="fa-solid fa-circle-xmark pointer-events-none"></i> No disponible
      </div>`;
    } else {
      badgeHtml = `<div data-accion="toggle-estado" data-index="${index}" class="px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-pointer hover:bg-emerald-100 transition-colors shadow-xs select-none" title="Hacer clic para cambiar a No disponible">
        <i class="fa-solid fa-circle-check pointer-events-none"></i> Disponible
      </div>`;
    }

    return `
      <div class="light-card light-card-hover rounded-2xl p-6 border border-slate-200 flex justify-between items-start">
        <div class="flex items-center gap-4">
          <div class="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center overflow-hidden border-2 border-blue-300 shadow-inner flex-shrink-0">
            ${ch.foto ? `<img src="${ch.foto}" class="w-full h-full object-cover" alt="${ch.nombre}">` : '<i class="fa-solid fa-user text-2xl"></i>'}
          </div>
          <div class="space-y-1">
            <div class="flex items-center gap-2">${badgeHtml}</div>
            <div>
              <h4 class="font-extrabold text-slate-900 text-lg">${ch.nombre}</h4>
              <p class="text-xs text-slate-500">DNI: ${ch.dni}</p>
            </div>
            <p class="text-xs text-blue-600 font-semibold"><i class="fa-solid fa-phone"></i> ${ch.telefono}</p>
          </div>
        </div>
        <div class="flex items-center gap-1">
          <button type="button" onclick="window.abrirModalEditarChofer(${index})" class="text-slate-400 hover:text-blue-600 p-2 cursor-pointer" title="Modificar personal"><i class="fa-solid fa-pen-to-square"></i></button>
          <button type="button" onclick="window.eliminarChofer(${index})" class="text-slate-400 hover:text-red-500 p-2 cursor-pointer" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button>
        </div>
      </div>
    `;
  }).join('');
  if (typeof renderVisualizacionRutasChoferes === 'function') renderVisualizacionRutasChoferes();
}

document.addEventListener('click', function(e) {
  const target = e.target.closest('[data-accion="toggle-estado"]');
  if (target) {
    const index = parseInt(target.getAttribute('data-index'), 10);
    window.toggleEstadoChofer(index);
  }
});

window.toggleEstadoChofer = function(index) {
  const ch = choferes[index];
  if (!ch) return;
  if (serviciosActivos[ch.nombre]) {
    alert("Este conductor se encuentra actualmente en ruta asignada.");
    return;
  }
  ch.forzarNoDisponible = !ch.forzarNoDisponible;
  guardarDatosEnLocal();
  renderChoferes();
};

window.toggleModalChofer = function(show, editIndex = null) { 
  const modal = document.getElementById('modal-chofer');
  const form = document.getElementById('form-chofer') || document.querySelector('#modal-chofer form');
  const preview = document.getElementById('preview-chofer-subida');
  const inputEditIndex = document.getElementById('chofer-edit-index');
  if (!modal) return;

  if (show) {
    if (editIndex !== null && editIndex !== undefined && editIndex !== '' && !isNaN(editIndex)) {
      const idx = parseInt(editIndex, 10);
      if (inputEditIndex) inputEditIndex.value = idx;
      const ch = choferes[idx];
      if (ch) {
        document.getElementById('chofer-nombre').value = ch.nombre || '';
        document.getElementById('chofer-dni').value = ch.dni || '';
        document.getElementById('chofer-telefono').value = ch.telefono || '';
        document.getElementById('chofer-foto-input').value = ch.foto || '';
        if (preview) {
          preview.innerHTML = ch.foto ? `<img src="${ch.foto}" class="w-16 h-16 object-cover rounded-full border-2 border-blue-400 mx-auto">` : '<span class="text-xs text-slate-400">Sin foto</span>';
        }
      }
    } else {
      if (inputEditIndex) inputEditIndex.value = '';
      if (form) form.reset();
      document.getElementById('chofer-foto-input').value = '';
      if (preview) preview.innerHTML = '<span class="text-xs text-slate-400">Ninguna imagen seleccionada</span>';
    }
  }
  modal.classList.toggle('hidden', !show); 
};

window.abrirModalEditarChofer = function(index) {
  window.toggleModalChofer(true, index);
};

window.agregarChofer = function(e) {
  if (e) e.preventDefault();
  const inputEditIndex = document.getElementById('chofer-edit-index');
  const editIndexVal = inputEditIndex ? inputEditIndex.value : '';

  const choferData = {
    nombre: document.getElementById('chofer-nombre').value,
    dni: document.getElementById('chofer-dni').value,
    telefono: document.getElementById('chofer-telefono').value,
    foto: document.getElementById('chofer-foto-input').value || ''
  };

  if (editIndexVal !== '' && !isNaN(editIndexVal)) {
    const idx = parseInt(editIndexVal, 10);
    if (idx >= 0 && idx < choferes.length) {
      choferes[idx] = choferData; 
    } else {
      choferes.push(choferData);
    }
  } else {
    choferes.push(choferData);
  }

  if (inputEditIndex) inputEditIndex.value = '';
  guardarDatosEnLocal();
  window.toggleModalChofer(false);
  renderChoferes();
};

window.manejarSubidaImagenChofer = function(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById('chofer-foto-input').value = e.target.result;
    const preview = document.getElementById('preview-chofer-subida');
    if (preview) {
      preview.innerHTML = `<img src="${e.target.result}" class="w-16 h-16 object-cover rounded-full border-2 border-blue-400 mx-auto">`;
    }
  };
  reader.readAsDataURL(file);
};

window.eliminarChofer = function(index) {
  if (confirm('¿Estás seguro de que deseas eliminar este conductor?')) {
    choferes.splice(index, 1);
    guardarDatosEnLocal();
    renderChoferes();
  }
};

/* --- HISTORIAL Y SEMANA (CON MODAL DE CARROS INCLUIDO) --- */
function renderHistorialChoferesGrid() {
  const grid = document.getElementById('grid-choferes-historial');
  if (!grid) return;
  const panel = document.getElementById('panel-detalle-historial-chofer');
  if (panel) panel.classList.add('hidden');
  grid.classList.remove('hidden');

  grid.innerHTML = choferes.map(ch => {
    const rutasFin = historialFinalizadas.filter(h => h.chofer === ch.nombre);
    return `
      <div onclick="verDetalleHistorialChofer('${ch.nombre}')" class="light-card light-card-hover rounded-2xl p-6 border border-slate-200 cursor-pointer space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center font-bold text-lg border border-purple-100">
              <i class="fa-solid fa-id-badge"></i>
            </div>
            <div>
              <h3 class="font-extrabold text-slate-800 text-lg">${ch.nombre}</h3>
              <p class="text-xs text-slate-500">DNI: ${ch.dni}</p>
            </div>
          </div>
        </div>
        <div class="border-t border-slate-100 pt-3 flex justify-between items-center text-xs text-slate-500">
          <span><i class="fa-solid fa-check-double text-emerald-600"></i> ${rutasFin.length} Rutas Finalizadas</span>
          <span class="text-purple-700 font-bold flex items-center gap-1">Ver Historial <i class="fa-solid fa-chevron-right text-[10px]"></i></span>
        </div>
      </div>
    `;
  }).join('');
}

window.abrirModalCarrosRuta = function(target) {
  let r = null;
  if (typeof target === 'number') {
    r = historialFinalizadas[target];
  } else if (typeof target === 'string') {
    r = historialFinalizadas.find(h => String(h.id) === String(target)) || historialFinalizadas[parseInt(target, 10)];
  }
  if (!r) return;

  let modal = document.getElementById('modal-detalle-carros-dinamico');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-detalle-carros-dinamico';
    modal.className = 'fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 hidden';
    document.body.appendChild(modal);
  }

  const clientesDetalle = (r.detalleClientes && Array.isArray(r.detalleClientes)) ? r.detalleClientes : [];
  const totalEntregados = clientesDetalle.reduce((acc, c) => acc + (parseInt(c.entregados, 10) || 0), 0);
  const totalRecogidos = clientesDetalle.reduce((acc, c) => acc + (parseInt(c.recogidos, 10) || 0), 0);

  modal.innerHTML = `
    <div class="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
      <div class="flex justify-between items-start border-b border-slate-100 pb-3">
        <div>
          <h3 class="font-extrabold text-slate-900 text-sm flex items-center gap-2">
            <i class="fa-solid fa-truck-ramp-box text-blue-600"></i> Desglose de Carros por Cliente
          </h3>
          <p class="text-[11px] text-slate-500 mt-0.5">Ruta del <strong>${r.fecha}</strong> — ${r.rutaNombre || r.dia || 'Ruta'} (${r.camion})</p>
        </div>
        <button onclick="document.getElementById('modal-detalle-carros-dinamico').classList.add('hidden')" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center text-sm font-black transition-colors cursor-pointer">&times;</button>
      </div>

      <div class="flex justify-between items-center text-xs px-1">
        <span class="text-slate-500 font-medium">Resumen general:</span>
        <div class="flex gap-2">
          <span class="bg-blue-50 text-blue-800 font-extrabold px-2.5 py-1 rounded-lg border border-blue-100">
            Total Entregados: ${totalEntregados}
          </span>
          <span class="bg-indigo-50 text-indigo-800 font-extrabold px-2.5 py-1 rounded-lg border border-indigo-100">
            Total Recogidos: ${totalRecogidos}
          </span>
        </div>
      </div>

      <div class="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
        ${clientesDetalle.length > 0 ? clientesDetalle.map(d => `
          <div class="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex justify-between items-center text-xs">
            <span class="font-bold text-slate-800 flex items-center gap-1.5 truncate pr-2">
              <i class="fa-solid fa-location-dot text-indigo-500 text-xs"></i> ${d.cliente}
            </span>
            <div class="flex gap-2.5 text-[11px] shrink-0">
              <span class="text-blue-700 font-semibold bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                Entregados: <strong class="text-blue-900">${d.entregados || 0}</strong>
              </span>
              <span class="text-indigo-700 font-semibold bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                Recogidos: <strong class="text-indigo-900">${d.recogidos || 0}</strong>
              </span>
            </div>
          </div>
        `).join('') : '<p class="text-xs text-slate-400 italic text-center py-6 bg-slate-50 rounded-2xl border border-slate-200">No hay detalle de carros registrado para esta ruta.</p>'}
      </div>

      <div class="pt-2 flex justify-end">
        <button onclick="document.getElementById('modal-detalle-carros-dinamico').classList.add('hidden')" class="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-all">
          Cerrar Ventana
        </button>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
};

/* --- HISTORIAL JERÁRQUICO POR MESES (OPTIMIZADO Y ORDENADO CRONOLÓGICAMENTE) --- */

const NOMBRES_MESES_HISTORIAL = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

window.historialMesesAbiertos = window.historialMesesAbiertos || new Set();
window.historialLimiteRenderPorMes = window.historialLimiteRenderPorMes || {};
window._rutasActualesChofer = [];
window._gruposMesesActuales = [];
window._filtroHistorialTexto = '';

/**
 * Parsea fechas en formatos YYYY-MM-DD, DD/MM/YYYY, ISO, etc.
 */
function parsearFechaRutaHistorial(fechaStr) {
  if (!fechaStr) return new Date();
  if (fechaStr instanceof Date) return isNaN(fechaStr.getTime()) ? new Date() : fechaStr;
  
  const str = String(fechaStr).trim().split('T')[0];
  
  // YYYY-MM-DD o YYYY/MM/DD
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(str)) {
    const parts = str.split(/[-/]/).map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  
  // DD/MM/YYYY o DD-MM-YYYY
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(str)) {
    const parts = str.split(/[-/]/).map(Number);
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }
  
  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Extrae metadatos del mes, año y ordenación.
 */
function extraerInfoFechaRuta(fechaStr) {
  const d = parsearFechaRutaHistorial(fechaStr);
  const anio = d.getFullYear() || 2026;
  const mesIndex = d.getMonth();
  const mesNombre = NOMBRES_MESES_HISTORIAL[mesIndex] || 'Mes';
  const clave = `${anio}-${String(mesIndex + 1).padStart(2, '0')}`;
  const etiqueta = `${mesNombre} ${anio}`;
  
  return {
    d,
    anio,
    mesIndex,
    mesNombre,
    clave,
    etiqueta,
    timestamp: d.getTime()
  };
}

/**
 * Agrupa rutas por mes y las ordena estrictamente de más reciente a más antigua.
 */
function agruparRutasPorMesHistorial(rutas) {
  if (!rutas || rutas.length === 0) return [];

  // Mapear con metadatos calculados
  const rutasProcesadas = rutas.map((r, idx) => {
    const info = extraerInfoFechaRuta(r.fecha);
    const idSeguro = r.id || ('hist_' + (Date.now() + idx) + '_' + Math.random().toString(36).substr(2, 6));
    return {
      ...r,
      id: idSeguro,
      _fechaObj: info.d,
      _timestamp: info.timestamp,
      _mesClave: info.clave,
      _mesEtiqueta: info.etiqueta,
      _anio: info.anio,
      _mesIndex: info.mesIndex
    };
  });

  // Orden cronológico estricto: De más reciente a más antigua
  rutasProcesadas.sort((a, b) => {
    if (b._timestamp !== a._timestamp) {
      return b._timestamp - a._timestamp;
    }
    const horaB = (b.horaFin || b.horaInicio || '00:00').replace(':', '');
    const horaA = (a.horaFin || a.horaInicio || '00:00').replace(':', '');
    if (horaB !== horaA) return horaB.localeCompare(horaA);
    return String(b.id || '').localeCompare(String(a.id || ''));
  });

  // Agrupar en Map por mesClave ("YYYY-MM")
  const gruposMap = new Map();
  rutasProcesadas.forEach(r => {
    if (!gruposMap.has(r._mesClave)) {
      gruposMap.set(r._mesClave, {
        clave: r._mesClave,
        etiqueta: r._mesEtiqueta,
        anio: r._anio,
        mesIndex: r._mesIndex,
        rutas: []
      });
    }
    gruposMap.get(r._mesClave).rutas.push(r);
  });

  // Ordenar los meses en orden descendente (más recientes primero)
  const grupos = Array.from(gruposMap.values());
  grupos.sort((a, b) => b.clave.localeCompare(a.clave));

  return grupos;
}

/**
 * Genera el HTML de una tarjeta de ruta con todos sus detalles clave.
 */
function renderizarTarjetaRutaHistorial(r) {
  const safeId = r.id;
  
  let fechaLegible = r.fecha || 'Sin fecha';
  if (/^\d{4}-\d{2}-\d{2}$/.test(r.fecha)) {
    const [y, m, d] = r.fecha.split('-');
    fechaLegible = `${d}/${m}/${y}`;
  }

  const clientesDetalle = (r.detalleClientes && Array.isArray(r.detalleClientes)) ? r.detalleClientes : [];
  const totalEntregados = clientesDetalle.reduce((acc, c) => acc + (parseInt(c.entregados, 10) || 0), 0);
  const totalRecogidos = clientesDetalle.reduce((acc, c) => acc + (parseInt(c.recogidos, 10) || 0), 0);

  return `
    <div id="card-hist-ruta-${safeId}" class="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs hover:shadow-md transition-all hover:border-purple-300">
      <div onclick="toggleHistorialChoferDetalle('${safeId}')" class="p-3.5 bg-slate-50/90 hover:bg-slate-100/90 cursor-pointer flex justify-between items-center select-none gap-2 transition-colors">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="font-extrabold text-xs text-slate-900">${fechaLegible}</span>
            <span class="text-slate-300 font-bold">•</span>
            <span class="font-bold text-xs text-purple-950 truncate max-w-[170px]">${r.rutaNombre || r.dia || 'Ruta General'}</span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200/80 text-slate-700 flex items-center gap-1">
              <i class="fa-solid fa-truck text-[9px] text-slate-500"></i> ${r.camion || 'Sin camión'}
            </span>
          </div>

          <div class="flex items-center gap-2 mt-1 text-[11px] flex-wrap">
            <span class="text-emerald-700 font-extrabold flex items-center gap-1">
              <i class="fa-regular fa-clock text-[10px]"></i> ${r.horaInicio || '08:00'} - ${r.horaFin || '16:00'}
            </span>
            <span class="text-slate-300">•</span>
            <span class="text-slate-600 font-medium text-[10px]">Km: <strong class="text-slate-800">${r.km || '0'}</strong></span>
            ${r.obs ? `
              <span class="text-slate-300">•</span>
              <span class="text-slate-500 text-[10px] truncate max-w-[150px]" title="${escapeHtmlAttr(r.obs)}">Obs: ${r.obs}</span>
            ` : ''}
          </div>
        </div>

        <div class="flex items-center gap-1.5 shrink-0">
          <button type="button" onclick="event.stopPropagation(); abrirModalCarrosRuta('${safeId}')" class="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-[11px] font-bold rounded-xl shadow-2xs transition-all flex items-center gap-1 cursor-pointer" title="Ver desglose modal de carros">
            <i class="fa-solid fa-boxes-stacked text-[10px]"></i>
            <span class="hidden sm:inline">Ver carros</span>
          </button>
          <span class="w-7 h-7 rounded-xl bg-white border border-slate-200 text-slate-500 flex items-center justify-center text-xs shadow-2xs hover:border-slate-300 transition-colors">
            <i id="chevron-ruta-${safeId}" class="fa-solid fa-chevron-down transition-transform duration-200"></i>
          </span>
        </div>
      </div>

      <!-- DESGLOSE DESPLEGABLE INLINE DE CARROS -->
      <div id="detalle-carros-${safeId}" class="hidden p-3.5 bg-slate-50/70 border-t border-slate-100 space-y-2.5">
        <div class="flex justify-between items-center flex-wrap gap-1">
          <p class="text-[11px] font-extrabold text-blue-950 uppercase tracking-wide flex items-center gap-1.5">
            <i class="fa-solid fa-boxes-stacked text-blue-600"></i> Carros por Cliente en esta ruta:
          </p>
          ${clientesDetalle.length > 0 ? `
            <span class="text-[10px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
              Total: <strong class="text-blue-800">${totalEntregados} entr.</strong> / <strong class="text-indigo-800">${totalRecogidos} recog.</strong>
            </span>
          ` : ''}
        </div>

        <div class="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
          ${clientesDetalle.length > 0 ? clientesDetalle.map(d => `
            <div class="bg-white p-2.5 rounded-xl border border-slate-200 flex justify-between items-center text-xs shadow-2xs">
              <span class="font-bold text-slate-800 truncate pr-2 flex items-center gap-1.5">
                <i class="fa-solid fa-location-dot text-indigo-500 text-[10px]"></i> ${d.cliente}
              </span>
              <div class="flex gap-2 text-[10px] shrink-0">
                <span class="text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                  Entregados: <strong class="text-blue-900">${d.entregados || 0}</strong>
                </span>
                <span class="text-indigo-700 font-semibold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                  Recogidos: <strong class="text-indigo-900">${d.recogidos || 0}</strong>
                </span>
              </div>
            </div>
          `).join('') : '<p class="text-xs text-slate-400 italic py-2 text-center bg-white rounded-xl border border-slate-200">No hay detalle de carros registrado para esta ruta.</p>'}
        </div>
      </div>
    </div>
  `;
}

/**
 * Renderizado optimizado del contenido de un mes con paginación / carga por lotes.
 */
function renderizarContenidoMes(claveMes) {
  const grupo = (window._gruposMesesActuales || []).find(g => g.clave === claveMes);
  const body = document.getElementById(`mes-rutas-body-${claveMes}`);
  if (!grupo || !body) return;

  const limite = (window.historialLimiteRenderPorMes && window.historialLimiteRenderPorMes[claveMes]) || 10;
  const rutasVisibles = grupo.rutas.slice(0, limite);
  const restantes = grupo.rutas.length - rutasVisibles.length;

  let html = rutasVisibles.map(r => renderizarTarjetaRutaHistorial(r)).join('');

  if (restantes > 0) {
    html += `
      <div class="pt-1">
        <button type="button" onclick="cargarMasRutasMes('${claveMes}')" class="w-full py-2.5 px-3 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 active:scale-[0.99] rounded-xl border border-purple-200 transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer">
          <i class="fa-solid fa-angles-down text-[10px]"></i> Mostrar más rutas (${restantes} restantes de ${grupo.rutas.length})
        </button>
      </div>
    `;
  }

  body.innerHTML = html;
  body.dataset.rendered = 'true';
}

/**
 * Despliega o pliega el acordeón de un mes con renderizado lazy.
 */
window.toggleMesHistorial = function(claveMes) {
  if (!window.historialMesesAbiertos) window.historialMesesAbiertos = new Set();
  
  const body = document.getElementById(`mes-rutas-body-${claveMes}`);
  const chevron = document.getElementById(`mes-chevron-${claveMes}`);
  if (!body) return;

  if (window.historialMesesAbiertos.has(claveMes)) {
    window.historialMesesAbiertos.delete(claveMes);
    body.classList.add('hidden');
    if (chevron) chevron.classList.remove('rotate-180', 'text-purple-600');
  } else {
    window.historialMesesAbiertos.add(claveMes);
    body.classList.remove('hidden');
    if (chevron) chevron.classList.add('rotate-180', 'text-purple-600');
    if (body.dataset.rendered !== 'true') {
      renderizarContenidoMes(claveMes);
    }
  }
};

/**
 * Expande o contrae todos los meses visibles.
 */
window.expandirTodosMesesHistorial = function(expandir) {
  if (!window._gruposMesesActuales) return;
  if (!window.historialMesesAbiertos) window.historialMesesAbiertos = new Set();

  window._gruposMesesActuales.forEach(g => {
    const body = document.getElementById(`mes-rutas-body-${g.clave}`);
    const chevron = document.getElementById(`mes-chevron-${g.clave}`);
    if (expandir) {
      window.historialMesesAbiertos.add(g.clave);
      if (body) {
        body.classList.remove('hidden');
        if (body.dataset.rendered !== 'true') renderizarContenidoMes(g.clave);
      }
      if (chevron) chevron.classList.add('rotate-180', 'text-purple-600');
    } else {
      window.historialMesesAbiertos.delete(g.clave);
      if (body) body.classList.add('hidden');
      if (chevron) chevron.classList.remove('rotate-180', 'text-purple-600');
    }
  });
};

/**
 * Paginación progresiva para cargar más elementos de un mes con gran volumen de datos.
 */
window.cargarMasRutasMes = function(claveMes) {
  if (!window.historialLimiteRenderPorMes) window.historialLimiteRenderPorMes = {};
  const actual = window.historialLimiteRenderPorMes[claveMes] || 10;
  window.historialLimiteRenderPorMes[claveMes] = actual + 15;
  renderizarContenidoMes(claveMes);
};

/**
 * Despliegue inline rápido del desglose de carros por cliente en una ruta.
 */
window.toggleHistorialChoferDetalle = function(idOIndex) {
  let targetId = String(idOIndex);
  let el = document.getElementById('detalle-carros-' + targetId);
  let chevron = document.getElementById('chevron-ruta-' + targetId);

  if (!el && typeof idOIndex === 'number' && window._rutasActualesChofer && window._rutasActualesChofer[idOIndex]) {
    targetId = window._rutasActualesChofer[idOIndex].id;
    el = document.getElementById('detalle-carros-' + targetId);
    chevron = document.getElementById('chevron-ruta-' + targetId);
  }

  if (!el) return;

  const estaOculto = el.classList.contains('hidden');
  if (estaOculto) {
    el.classList.remove('hidden');
    if (chevron) chevron.classList.add('rotate-180', 'text-purple-600');
  } else {
    el.classList.add('hidden');
    if (chevron) chevron.classList.remove('rotate-180', 'text-purple-600');
  }
};

/**
 * Filtro reactivo de búsqueda.
 */
window.filtrarRutasHistorial = function(texto) {
  window._filtroHistorialTexto = (texto || '').trim().toLowerCase();
  ejecutarRenderizadoHistorial();
};

/**
 * Ejecución del renderizado jerárquico mensual.
 */
function ejecutarRenderizadoHistorial() {
  const container = document.getElementById('hist-lista-rutas-finalizadas') || document.getElementById('contenedor-rutas-finalizadas-chofer');
  if (!container) return;

  const rutasBase = window._rutasActualesChofer || [];
  if (rutasBase.length === 0) {
    container.innerHTML = `
      <div class="p-6 text-center text-slate-400 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200 space-y-2">
        <div class="w-10 h-10 mx-auto rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-base">
          <i class="fa-solid fa-route"></i>
        </div>
        <p class="text-xs font-bold text-slate-700">Sin rutas finalizadas</p>
        <p class="text-[11px] text-slate-400">Este conductor aún no tiene rutas registradas en su historial.</p>
      </div>
    `;
    return;
  }

  const q = window._filtroHistorialTexto;
  const rutasFiltradas = q ? rutasBase.filter(r => {
    const txtFecha = (r.fecha || '').toLowerCase();
    const txtRuta = (r.rutaNombre || r.dia || '').toLowerCase();
    const txtCamion = (r.camion || '').toLowerCase();
    const txtObs = (r.obs || '').toLowerCase();
    const txtClientes = (r.detalleClientes || []).map(c => c.cliente || '').join(' ').toLowerCase();
    const infoFecha = extraerInfoFechaRuta(r.fecha);
    const txtMes = infoFecha.etiqueta.toLowerCase();

    return txtFecha.includes(q) || txtRuta.includes(q) || txtCamion.includes(q) || txtObs.includes(q) || txtClientes.includes(q) || txtMes.includes(q);
  }) : rutasBase;

  if (rutasFiltradas.length === 0) {
    container.innerHTML = `
      <div class="space-y-3">
        <div class="relative">
          <i class="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-xs"></i>
          <input type="text" value="${escapeHtmlAttr(q)}" placeholder="Buscar por fecha, camión o ruta..." oninput="filtrarRutasHistorial(this.value)" class="w-full pl-8 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-purple-400 focus:bg-white transition-all text-slate-800">
          <button onclick="filtrarRutasHistorial('')" class="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer font-bold">&times;</button>
        </div>
        <div class="p-6 text-center text-slate-400 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200 space-y-2">
          <p class="text-xs font-bold text-slate-700">No se encontraron rutas</p>
          <p class="text-[11px] text-slate-400">Ninguna ruta coincide con "<strong>${escapeHtmlAttr(q)}</strong>".</p>
          <button onclick="filtrarRutasHistorial('')" class="px-3 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg text-xs font-bold border border-purple-200 cursor-pointer transition-colors">Limpiar búsqueda</button>
        </div>
      </div>
    `;
    return;
  }

  // Agrupación mensual
  const grupos = agruparRutasPorMesHistorial(rutasFiltradas);
  window._gruposMesesActuales = grupos;

  if (q) {
    grupos.forEach(g => window.historialMesesAbiertos.add(g.clave));
  } else if (window.historialMesesAbiertos.size === 0 && grupos.length > 0) {
    // Abrir automáticamente el mes más reciente
    window.historialMesesAbiertos.add(grupos[0].clave);
  }

  let html = `
    <div class="space-y-2.5">
      <div class="flex items-center justify-between text-xs pb-1.5 border-b border-slate-100 flex-wrap gap-2">
        <span class="font-bold text-slate-700 flex items-center gap-1.5">
          <i class="fa-solid fa-layer-group text-purple-600"></i> ${rutasFiltradas.length} ${rutasFiltradas.length === 1 ? 'ruta' : 'rutas'} en ${grupos.length} ${grupos.length === 1 ? 'mes' : 'meses'}
        </span>
        <div class="flex items-center gap-1.5 text-[11px]">
          <button type="button" onclick="expandirTodosMesesHistorial(true)" class="px-2 py-0.5 rounded text-purple-700 hover:bg-purple-50 font-bold transition-colors cursor-pointer" title="Desplegar todos los meses">
            <i class="fa-solid fa-folder-open text-[10px] mr-1"></i>Expandir
          </button>
          <span class="text-slate-300">•</span>
          <button type="button" onclick="expandirTodosMesesHistorial(false)" class="px-2 py-0.5 rounded text-slate-500 hover:bg-slate-100 font-bold transition-colors cursor-pointer" title="Colapsar todos los meses">
            <i class="fa-solid fa-folder-closed text-[10px] mr-1"></i>Colapsar
          </button>
        </div>
      </div>

      ${rutasBase.length > 1 ? `
        <div class="relative">
          <i class="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-xs"></i>
          <input type="text" id="filtro-buscar-historial-rutas" value="${escapeHtmlAttr(q)}" placeholder="Buscar por fecha, camión o cliente..." oninput="filtrarRutasHistorial(this.value)" class="w-full pl-8 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-purple-400 focus:bg-white transition-all text-slate-800 placeholder:text-slate-400 shadow-2xs">
          ${q ? `<button onclick="filtrarRutasHistorial('')" class="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer font-bold">&times;</button>` : ''}
        </div>
      ` : ''}

      <!-- LISTADO DE MESES EN ACORDEÓN JERÁRQUICO -->
      <div class="space-y-3">
  `;

  grupos.forEach(g => {
    const estaAbierto = window.historialMesesAbiertos.has(g.clave);
    const totalKm = g.rutas.reduce((acc, r) => acc + (parseFloat(r.km) || 0), 0);

    html += `
      <div class="rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden transition-all">
        <!-- CABECERA DEL MES (BOTÓN ACORDEÓN) -->
        <div onclick="toggleMesHistorial('${g.clave}')" class="p-3 bg-gradient-to-r from-slate-50 via-purple-50/25 to-slate-50 hover:bg-purple-50/40 cursor-pointer flex justify-between items-center select-none transition-colors border-b border-transparent ${estaAbierto ? 'border-purple-100' : ''}">
          <div class="flex items-center gap-2.5">
            <div class="w-7 h-7 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold shadow-2xs">
              <i class="fa-solid fa-calendar-days text-[11px]"></i>
            </div>
            <div>
              <span class="font-extrabold text-xs sm:text-sm text-slate-800">${g.etiqueta}</span>
              ${totalKm > 0 ? `<span class="hidden sm:inline-block ml-2 text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">${totalKm} km</span>` : ''}
            </div>
          </div>

          <div class="flex items-center gap-2">
            <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs">
              ${g.rutas.length} ${g.rutas.length === 1 ? 'ruta' : 'rutas'}
            </span>
            <span class="w-6 h-6 rounded-lg bg-white border border-slate-200 text-slate-500 flex items-center justify-center text-[10px] shadow-2xs">
              <i id="mes-chevron-${g.clave}" class="fa-solid fa-chevron-down text-slate-400 text-xs transition-transform duration-200 ${estaAbierto ? 'rotate-180 text-purple-600' : ''}"></i>
            </span>
          </div>
        </div>

        <!-- CONTENEDOR DE RUTAS DEL MES (LAZY-RENDERED) -->
        <div id="mes-rutas-body-${g.clave}" class="${estaAbierto ? 'block' : 'hidden'} p-2.5 space-y-2.5 bg-slate-50/40" data-rendered="false"></div>
      </div>
    `;
  });

  html += `
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Renderizar las rutas de los meses abiertos
  grupos.forEach(g => {
    if (window.historialMesesAbiertos.has(g.clave)) {
      renderizarContenidoMes(g.clave);
    }
  });
}

function escapeHtmlAttr(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

window.renderizarRutasFinalizadasChofer = function(rutasFinalizadasDelChofer) {
  window._rutasActualesChofer = rutasFinalizadasDelChofer || [];
  window._filtroHistorialTexto = '';
  window.historialLimiteRenderPorMes = {};
  window.historialMesesAbiertos = new Set();
  ejecutarRenderizadoHistorial();
};

window.verDetalleHistorialChofer = function(nombreChofer) {
  const grid = document.getElementById('grid-choferes-historial');
  if (grid) grid.classList.add('hidden');
  const panel = document.getElementById('panel-detalle-historial-chofer');
  if (panel) panel.classList.remove('hidden');

  window.choferSeleccionadoActual = nombreChofer;

  const elNom = document.getElementById('hist-chofer-nombre');
  if (elNom) elNom.innerText = nombreChofer;

  const fin = historialFinalizadas.filter(h => h.chofer === nombreChofer);
  
  const badgeHoras = document.getElementById('hist-chofer-horas');
  if (badgeHoras) {
    badgeHoras.innerText = `${fin.length} ${fin.length === 1 ? 'ruta completada' : 'rutas completadas'}`;
  }

  // Renderizado optimizado con agrupación mensual jerárquica
  window.renderizarRutasFinalizadasChofer(fin);

  const rep = repostajes.filter(r => r.chofer === nombreChofer);
  const containerRep = document.getElementById('hist-lista-repostajes');
  if (containerRep) {
    containerRep.innerHTML = rep.length === 0 ? '<p class="text-xs text-slate-500 italic">Sin repostajes.</p>' :
      rep.map(r => `
        <div class="bg-slate-50 p-3 rounded-xl border border-indigo-200 text-xs flex justify-between items-center">
          <div>
            <p class="font-bold text-slate-800">${r.tipo ? `${r.tipo} - ` : ''}${r.camion}</p>
            <p class="text-slate-500">${r.fecha} | ${r.litros} L${r.km ? ` | ${r.km} KM` : ''}</p>
          </div>
          <span class="font-bold text-indigo-700">${r.euros} €</span>
        </div>
      `).join('');
  }

  // Filtrar excluyendo rutas completadas o archivadas
  const prox = rutas.filter(r => r.chofer === nombreChofer && r.estado !== 'completada' && r.estado !== 'finalizada' && r.estado !== 'archivada');
  const containerProx = document.getElementById('hist-lista-proximas-rutas');
  if (containerProx) {
    containerProx.innerHTML = prox.length === 0 ? '<p class="text-xs text-slate-500 italic">Sin próximas rutas pendientes.</p>' :
      prox.map(r => `
        <div class="bg-slate-50 p-3 rounded-xl border border-blue-200 text-xs space-y-1">
          <div class="flex justify-between font-bold text-blue-900">
            <span>${r.dia} (${r.camion})</span>
          </div>
          <p class="text-slate-500">Clientes: ${r.clientes ? r.clientes.join(', ') : 'Varios'}</p>
        </div>
      `).join('');
  }
};

window.seleccionarConductorHistorial = window.verDetalleHistorialChofer;

window.cerrarDetalleHistorialChofer = function() {
  const panel = document.getElementById('panel-detalle-historial-chofer');
  if (panel) panel.classList.add('hidden');
  const grid = document.getElementById('grid-choferes-historial');
  if (grid) grid.classList.remove('hidden');
};

function renderDiasSemana() {
  const grid = document.getElementById('grid-dias-semana');
  if (!grid) return;
  grid.innerHTML = '';

  diasSemana.forEach(dia => {
    const rutasDelDia = rutas.filter(r => r.dia === dia);
    const choferesConRuta = [...new Set(rutasDelDia.map(r => r.chofer))];

    grid.innerHTML += `
      <div onclick="abrirDetalleDia('${dia}')" class="light-card light-card-hover rounded-2xl p-6 border border-slate-200 cursor-pointer flex flex-col justify-between h-48 group">
        <div class="flex justify-between items-start">
          <div>
            <span class="text-xs font-bold uppercase tracking-wider text-blue-600">Jornada</span>
            <h3 class="text-3xl font-black text-slate-900 mt-1 uppercase group-hover:text-blue-600 transition-colors">${dia}</h3>
          </div>
          <span class="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center font-extrabold text-base border border-blue-200">
            ${rutasDelDia.length}
          </span>
        </div>
        <div class="border-t border-slate-100 pt-4 flex justify-between items-center text-xs text-slate-500 font-semibold">
          <span><i class="fa-solid fa-user-group text-indigo-600"></i> ${choferesConRuta.length} Conductor(es) con ruta</span>
          <span class="text-blue-600 font-bold">Asignar <i class="fa-solid fa-chevron-right text-[10px]"></i></span>
        </div>
      </div>
    `;
  });
}

window.abrirDetalleDia = function(dia) {
  diaSeleccionadoActual = dia;
  if (typeof diaActual !== 'undefined') diaActual = dia;
  window.diaActual = dia;
  window.diaSeleccionadoActual = dia;
  const grid = document.getElementById('grid-dias-semana');
  if (grid) grid.classList.add('hidden');
  const panel = document.getElementById('panel-detalle-dia');
  if (panel) panel.classList.remove('hidden');

  const tit = document.getElementById('titulo-dia-seleccionado');
  if (tit) tit.innerText = dia.toUpperCase();

  renderGridChoferesAsignacion();
};

window.cerrarDetalleDia = function() {
  const panel = document.getElementById('panel-detalle-dia');
  if (panel) panel.classList.add('hidden');
  const grid = document.getElementById('grid-dias-semana');
  if (grid) grid.classList.remove('hidden');
  diaSeleccionadoActual = null;
  if (typeof diaActual !== 'undefined') diaActual = null;
  window.diaActual = null;
  window.diaSeleccionadoActual = null;
  renderDiasSemana();
};

window.cambiarDiaDetalle = function(delta) {
  const base = diaSeleccionadoActual || (typeof diaActual !== 'undefined' ? diaActual : 'Lunes') || 'Lunes';
  const norm = str => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : '';
  let indiceActual = diasSemana.findIndex(d => norm(d) === norm(base));
  if (indiceActual === -1) indiceActual = 0;

  const totalDias = diasSemana.length;
  const nuevoIndice = (indiceActual + delta + totalDias) % totalDias;
  const nuevoDia = diasSemana[nuevoIndice];

  diaSeleccionadoActual = nuevoDia;
  if (typeof diaActual !== 'undefined') diaActual = nuevoDia;
  window.diaActual = nuevoDia;
  window.diaSeleccionadoActual = nuevoDia;

  const tit = document.getElementById('titulo-dia-seleccionado');
  if (tit) tit.innerText = nuevoDia.toUpperCase();

  renderGridChoferesAsignacion();
  if (typeof actualizarCabeceraModalAsignarRuta === 'function') {
    actualizarCabeceraModalAsignarRuta();
  }
};
window.cambiarDia = window.cambiarDiaDetalle;

window.cambiarDiaModalAsignar = function(delta) {
  // 1. Guardar el estado actual del día antes del cambio
  guardarEstadoDiaActualDesdeModal();

  // 2. Calcular el siguiente día de la semana
  const base = (typeof diaActualModal !== 'undefined' && diaActualModal) || diaSeleccionadoActual || 'Lunes';
  const norm = str => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() : '';
  let indiceActual = diasSemana.findIndex(d => norm(d) === norm(base));
  if (indiceActual === -1) indiceActual = 0;

  const totalDias = diasSemana.length;
  const nuevoIndice = (indiceActual + delta + totalDias) % totalDias;
  const nuevoDia = diasSemana[nuevoIndice];

  // 3. Actualizar variables de día activo
  diaActualModal = nuevoDia;
  diaSeleccionadoActual = nuevoDia;
  diaActual = nuevoDia;
  window.diaActualModal = nuevoDia;
  window.diaSeleccionadoActual = nuevoDia;
  window.diaActual = nuevoDia;

  // 4. Actualizar título y cabecera del modal
  actualizarCabeceraModalAsignarRuta();

  // 5. Cargar estado del nuevo día en los checkboxes y selector de camión
  cargarEstadoDiaEnModal(nuevoDia);

  // 6. Actualizar las píldoras de navegación de los 7 días
  renderPestanasDiasModalAsignar();

  // 7. Sincronizar la interfaz principal de fondo
  const titPrincipal = document.getElementById('titulo-dia-seleccionado');
  if (titPrincipal) titPrincipal.innerText = nuevoDia.toUpperCase();
  renderGridChoferesAsignacion();
};

window.seleccionarDiaModalAsignar = function(diaObjetivo) {
  if (typeof diaActualModal !== 'undefined' && diaObjetivo === diaActualModal) return;

  guardarEstadoDiaActualDesdeModal();

  diaActualModal = diaObjetivo;
  diaSeleccionadoActual = diaObjetivo;
  diaActual = diaObjetivo;
  window.diaActualModal = diaObjetivo;
  window.diaSeleccionadoActual = diaObjetivo;
  window.diaActual = diaObjetivo;

  actualizarCabeceraModalAsignarRuta();
  cargarEstadoDiaEnModal(diaObjetivo);
  renderPestanasDiasModalAsignar();

  const titPrincipal = document.getElementById('titulo-dia-seleccionado');
  if (titPrincipal) titPrincipal.innerText = diaObjetivo.toUpperCase();
  renderGridChoferesAsignacion();
};

document.addEventListener('keydown', function(e) {
  const panel = document.getElementById('panel-detalle-dia');
  const modalAsignar = document.getElementById('modal-asignar-ruta');
  const modalAbierto = modalAsignar && !modalAsignar.classList.contains('hidden');
  const panelAbierto = panel && !panel.classList.contains('hidden');

  if (panelAbierto || modalAbierto) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (modalAbierto) {
        cambiarDiaModalAsignar(-1);
      } else {
        cambiarDiaDetalle(-1);
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (modalAbierto) {
        cambiarDiaModalAsignar(1);
      } else {
        cambiarDiaDetalle(1);
      }
    }
  }
});

function renderGridChoferesAsignacion() {
  const container = document.getElementById('grid-choferes-asignacion');
  const badgeTotal = document.getElementById('badge-total-rutas-dia');
  if (!container || !diaSeleccionadoActual) return;

  const rutasDelDia = rutas.filter(r => r.dia && r.dia.trim().toLowerCase() === diaSeleccionadoActual.trim().toLowerCase());
  if (badgeTotal) badgeTotal.innerText = `${rutasDelDia.length} Ruta(s) Asignada(s)`;

  container.innerHTML = choferes.map(ch => {
    const rutasDelChofer = rutasDelDia.filter(r => r.chofer === ch.nombre);

    return `
      <div class="light-card rounded-2xl p-5 border border-slate-200 space-y-3 relative">
        <div class="flex justify-between items-start">
          <div>
            <h4 class="font-extrabold text-slate-900 text-lg">${ch.nombre}</h4>
            <p class="text-xs text-slate-500">DNI: ${ch.dni}</p>
          </div>
          <button onclick="abrirModalAsignarRuta('${ch.nombre}')" class="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5">
            <i class="fa-solid fa-plus"></i> Nueva Ruta
          </button>
        </div>

        <div class="space-y-2 pt-2 border-t border-slate-100">
          ${rutasDelChofer.length === 0 ? '<p class="text-xs text-slate-400 italic">Sin rutas asignadas este día.</p>' :
            rutasDelChofer.map((r, rIndex) => `
              <div class="bg-slate-50 rounded-xl p-3 border ${r.estado === 'completada' || r.estado === 'finalizada' ? 'border-emerald-300 bg-emerald-50/25' : 'border-slate-200'} space-y-1.5 text-xs">
                <div class="flex justify-between items-center font-bold text-blue-900">
                  <div class="flex items-center gap-2">
                    <span><i class="fa-solid fa-route text-blue-600"></i> RUTA ${rIndex + 1} (${r.camion})</span>
                    ${r.estado === 'completada' || r.estado === 'finalizada' ? '<span class="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-extrabold border border-emerald-200">✓ Finalizada</span>' : ''}
                  </div>
                  <button onclick="eliminarRutaConductor('${diaSeleccionadoActual}', '${ch.nombre}', ${rIndex})" class="text-slate-400 hover:text-red-500 p-0.5 cursor-pointer" title="Eliminar ruta"><i class="fa-solid fa-trash-can"></i></button>
                </div>
                <div class="text-slate-600 space-y-0.5">
                  ${r.clientes ? r.clientes.map((cli, cIdx) => `<div>• ${cli}</div>`).join('') : ''}
                </div>
              </div>
            `).join('')}
        </div>
      </div>
    `;
  }).join('');
  if (typeof renderVisualizacionRutasChoferes === 'function') renderVisualizacionRutasChoferes();
}

window.actualizarCabeceraModalAsignarRuta = function() {
  const diaTexto = (typeof diaActualModal !== 'undefined' && diaActualModal) || diaSeleccionadoActual || (typeof diaActual !== 'undefined' ? diaActual : 'Lunes') || 'Lunes';
  const choferTexto = choferSeleccionadoAsignacion || 'Conductor';

  const titChofer = document.getElementById('modal-asignar-chofer-nombre');
  const titDia = document.getElementById('modal-asignar-dia-nombre');

  if (titChofer && titDia) {
    titChofer.innerText = choferTexto;
    titDia.innerText = diaTexto;
    titDia.classList.remove('scale-110');
    void titDia.offsetWidth;
    titDia.classList.add('scale-110');
    setTimeout(() => {
      const el = document.getElementById('modal-asignar-dia-nombre');
      if (el) el.classList.remove('scale-110');
    }, 150);
  } else {
    const tit = document.getElementById('modal-asignar-titulo');
    if (tit) {
      tit.innerHTML = `<i class="fa-solid fa-route text-blue-600"></i> <span>Asignar Ruta a <span id="modal-asignar-chofer-nombre">${choferTexto}</span></span> <span class="text-blue-600 font-extrabold">(<span id="modal-asignar-dia-nombre" class="transition-transform duration-150 inline-block">${diaTexto}</span>)</span>`;
    }
  }

  const norm = str => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() : '';
  let idx = diasSemana.findIndex(d => norm(d) === norm(diaTexto));
  if (idx === -1) idx = 0;
  const total = diasSemana.length;
  const diaAnt = diasSemana[(idx - 1 + total) % total];
  const diaSig = diasSemana[(idx + 1) % total];

  const btnAnt = document.getElementById('btn-modal-asignar-dia-ant');
  const btnSig = document.getElementById('btn-modal-asignar-dia-sig');
  if (btnAnt) btnAnt.title = `Cambiar a ${diaAnt}`;
  if (btnSig) btnSig.title = `Cambiar a ${diaSig}`;
};

// Guardar temporalmente en memoria el estado del día que se está editando en el modal
function guardarEstadoDiaActualDesdeModal() {
  const dia = (typeof diaActualModal !== 'undefined' && diaActualModal) || diaSeleccionadoActual || 'Lunes';
  if (!modalAsignacionTemporal) modalAsignacionTemporal = {};

  // 1. Obtener los clientes marcados en los checkboxes
  const checkboxes = document.querySelectorAll('#modal-asignar-ruta input[name="cliente-asignacion"]:checked');
  const clientesCheckboxes = Array.from(checkboxes).map(cb => cb.value);

  // 2. Obtener clientes manuales temporales
  const clientesManuales = Array.isArray(clientesManualesTempRapido) ? [...clientesManualesTempRapido] : [];

  // 3. Unir clientes únicos
  const todosClientes = Array.from(new Set([...clientesCheckboxes, ...clientesManuales]));

  // 4. Obtener vehículo seleccionado
  const selCamion = document.getElementById('asig-camion');
  const camionSel = selCamion ? selCamion.value : '';

  const estadoPrevio = modalAsignacionTemporal[dia] || { clientes: [], camion: '' };
  const mismoCamion = estadoPrevio.camion === camionSel;
  const mismosClientes = estadoPrevio.clientes &&
    estadoPrevio.clientes.length === todosClientes.length &&
    estadoPrevio.clientes.every(c => todosClientes.includes(c));

  const fueModificado = estadoPrevio.modificado || !mismoCamion || !mismosClientes;

  modalAsignacionTemporal[dia] = {
    ...estadoPrevio,
    clientes: todosClientes,
    camion: camionSel,
    modificado: fueModificado
  };
}

// Cargar el estado del día en los controles del modal (checkboxes, vehículo, clientes manuales)
function cargarEstadoDiaEnModal(dia) {
  if (!modalAsignacionTemporal) modalAsignacionTemporal = {};

  const norm = str => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() : '';

  // Si no está inicializado este día en memoria temporal, inicializarlo desde las rutas existentes del chofer
  if (!modalAsignacionTemporal[dia]) {
    const rutasChoferDia = (typeof rutas !== 'undefined' && Array.isArray(rutas))
      ? rutas.filter(r => norm(r.dia) === norm(dia) && r.chofer === choferSeleccionadoAsignacion && r.estado !== 'completada' && r.estado !== 'finalizada')
      : [];

    const clientesDia = [];
    let camionDia = '';
    rutasChoferDia.forEach(r => {
      if (r.camion && !camionDia) camionDia = r.camion;
      if (Array.isArray(r.clientes)) {
        r.clientes.forEach(c => {
          if (!clientesDia.includes(c)) clientesDia.push(c);
        });
      }
    });

    modalAsignacionTemporal[dia] = {
      clientes: clientesDia,
      camion: camionDia || (camiones[0]?.matricula || ''),
      modificado: false,
      tieneRutasPrevias: rutasChoferDia.length > 0
    };
  }

  const estado = modalAsignacionTemporal[dia];
  const clientesDelDia = new Set(estado.clientes || []);

  // 1. Cargar vehículo del día
  const selCamion = document.getElementById('asig-camion');
  if (selCamion) {
    if (estado.camion) {
      selCamion.value = estado.camion;
    } else if (camiones.length > 0) {
      selCamion.value = camiones[0].matricula;
    }
  }

  // 2. Marcar / desmarcar checkboxes de clientes según corresponda a este día
  const checkboxes = document.querySelectorAll('#modal-asignar-ruta input[name="cliente-asignacion"]');
  const nombresRegistrados = new Set();
  checkboxes.forEach(cb => {
    nombresRegistrados.add(cb.value);
    cb.checked = clientesDelDia.has(cb.value);
  });

  // 3. Clientes manuales que no estén entre los checkboxes predefinidos
  clientesManualesTempRapido = Array.from(clientesDelDia).filter(c => !nombresRegistrados.has(c));
  renderClientesManualesTempRapido();

  // 4. Limpiar buscador rápido de lupa
  const inputLupa = document.getElementById('input-lupa-clientes');
  if (inputLupa) inputLupa.value = '';
  renderResultadosLupa('');

  const inputManual = document.getElementById('input-cliente-manual-rapido');
  if (inputManual) inputManual.value = '';

  // 5. Actualizar subtítulo con la información de este día
  actualizarContadorClientesModal();
}

// Renderizar las píldoras de los 7 días en el modal para visualización y cambio directo
function renderPestanasDiasModalAsignar() {
  const container = document.getElementById('selector-dias-pestanas-modal');
  const badgeResumen = document.getElementById('badge-resumen-semana-modal');
  if (!container) return;

  const abrevs = { 'Lunes': 'Lun', 'Martes': 'Mar', 'Miércoles': 'Mié', 'Jueves': 'Jue', 'Viernes': 'Vie', 'Sábado': 'Sáb', 'Domingo': 'Dom' };
  const norm = str => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() : '';
  const diaActivo = (typeof diaActualModal !== 'undefined' && diaActualModal) || diaSeleccionadoActual || 'Lunes';

  let diasConClientes = 0;

  container.innerHTML = diasSemana.map(d => {
    const estado = (modalAsignacionTemporal && modalAsignacionTemporal[d]) ? modalAsignacionTemporal[d] : { clientes: [] };
    const cant = estado.clientes ? estado.clientes.length : 0;
    if (cant > 0) diasConClientes++;

    const esActivo = norm(d) === norm(diaActivo);
    const abrev = abrevs[d] || d.slice(0, 3);

    let botonEstilo = '';
    let badgeEstilo = '';

    if (esActivo) {
      botonEstilo = 'bg-blue-600 text-white shadow-md ring-2 ring-blue-300 font-extrabold';
      badgeEstilo = cant > 0 ? 'bg-white text-blue-700 font-black' : 'bg-blue-500/60 text-blue-100';
    } else {
      botonEstilo = cant > 0
        ? 'bg-blue-50 hover:bg-blue-100 text-blue-950 font-bold border border-blue-200'
        : 'bg-white hover:bg-slate-100 text-slate-600 font-medium border border-slate-200';
      badgeEstilo = cant > 0 ? 'bg-blue-600 text-white font-extrabold' : 'bg-slate-200 text-slate-500';
    }

    return `
      <button type="button" onclick="seleccionarDiaModalAsignar('${d}')" class="py-2 px-1 rounded-xl text-center flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95 ${botonEstilo}" title="${d}: ${cant} cliente(s)">
        <span class="text-[11px] sm:text-xs uppercase tracking-tight">${abrev}</span>
        <span class="text-[10px] min-w-[18px] px-1 rounded-full mt-0.5 leading-tight ${badgeEstilo}">
          ${cant}
        </span>
      </button>
    `;
  }).join('');

  if (badgeResumen) {
    badgeResumen.innerText = diasConClientes === 1 ? '1 día con clientes' : `${diasConClientes} días con clientes`;
    badgeResumen.className = diasConClientes > 0
      ? 'text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200'
      : 'text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200';
  }
}

// Actualizar contadores del día activo y subtítulo descriptivo
function actualizarContadorClientesModal() {
  const diaActivo = (typeof diaActualModal !== 'undefined' && diaActualModal) || diaSeleccionadoActual || 'Lunes';
  const checkboxes = document.querySelectorAll('#modal-asignar-ruta input[name="cliente-asignacion"]:checked');
  const cant = checkboxes.length + (clientesManualesTempRapido ? clientesManualesTempRapido.length : 0);

  const sub = document.getElementById('modal-asignar-subtitulo');
  if (sub) {
    sub.innerHTML = cant > 0
      ? `<span class="text-blue-700 font-bold">${cant} establecimiento(s)</span> seleccionados para este día (${diaActivo}). Usa las flechas para planificar otros días o finaliza abajo.`
      : `Selecciona o busca los clientes para este recorrido en <strong>${diaActivo}</strong> (sin clientes asignados aún).`;
  }

  renderPestanasDiasModalAsignar();
}

window.onCambioCheckboxCliente = function() {
  guardarEstadoDiaActualDesdeModal();
  actualizarContadorClientesModal();
};

window.actualizarCamionDiaModal = function() {
  guardarEstadoDiaActualDesdeModal();
};

window.abrirModalAsignarRuta = function(nombreChofer) {
  choferSeleccionadoAsignacion = nombreChofer;
  clientesManualesTempRapido = [];

  const baseDia = diaSeleccionadoActual || (typeof diaActual !== 'undefined' ? diaActual : 'Lunes') || 'Lunes';
  const norm = str => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() : '';
  const canon = diasSemana.find(d => norm(d) === norm(baseDia)) || 'Lunes';

  diaActualModal = canon;
  diaSeleccionadoActual = canon;
  diaActual = canon;
  window.diaActualModal = canon;
  window.diaSeleccionadoActual = canon;
  window.diaActual = canon;

  // Inicializar memoria temporal de la semana completa para este chofer
  modalAsignacionTemporal = {};
  diasSemana.forEach(d => {
    const rutasChoferDia = (typeof rutas !== 'undefined' && Array.isArray(rutas))
      ? rutas.filter(r => norm(r.dia) === norm(d) && r.chofer === nombreChofer && r.estado !== 'completada' && r.estado !== 'finalizada')
      : [];

    const clientesDia = [];
    let camionDia = '';
    rutasChoferDia.forEach(r => {
      if (r.camion && !camionDia) camionDia = r.camion;
      if (Array.isArray(r.clientes)) {
        r.clientes.forEach(c => {
          if (!clientesDia.includes(c)) clientesDia.push(c);
        });
      }
    });

    modalAsignacionTemporal[d] = {
      clientes: clientesDia,
      camion: camionDia || (camiones[0]?.matricula || ''),
      modificado: false,
      tieneRutasPrevias: rutasChoferDia.length > 0
    };
  });

  const modal = document.getElementById('modal-asignar-ruta');
  const selCamion = document.getElementById('asig-camion');
  const inputLupa = document.getElementById('input-lupa-clientes');

  actualizarCabeceraModalAsignarRuta();
  if (inputLupa) inputLupa.value = '';

  if (selCamion) {
    if (camiones.length === 0) {
      selCamion.innerHTML = `<option value="">No hay vehículos registrados</option>`;
    } else {
      selCamion.innerHTML = camiones.map(c => `<option value="${c.matricula}">${c.matricula} (${c.tipo})</option>`).join('');
    }
  }

  renderCheckboxesClientesRapidos();
  renderResultadosLupa('');
  cargarEstadoDiaEnModal(diaActualModal);
  renderPestanasDiasModalAsignar();

  if (modal) modal.classList.remove('hidden');
};

window.toggleModalAsignarRuta = function(show) {
  const modal = document.getElementById('modal-asignar-ruta');
  if (modal) {
    modal.classList.toggle('hidden', !show);
    if (!show) {
      modalAsignacionTemporal = null;
      clientesManualesTempRapido = [];
      const inputLupa = document.getElementById('input-lupa-clientes');
      if (inputLupa) inputLupa.value = '';
      renderResultadosLupa('');
    }
  }
};

function renderCheckboxesClientesRapidos() {
  const containerHoteles = document.getElementById('lista-checkbox-hoteles');
  const containerRest = document.getElementById('lista-checkbox-restaurantes');
  const containerMixto = document.getElementById('lista-checkbox-mixtos');
  const containerCamping = document.getElementById('lista-checkbox-campings');

  if (!containerHoteles || !containerRest || !containerMixto || !containerCamping) return;

  const hoteles = clientes.filter(c => c.tipo === 'Hoteles');
  const restaurantes = clientes.filter(c => c.tipo === 'Restaurantes');
  const mixtos = clientes.filter(c => c.tipo === 'Mixto');
  const campings = clientes.filter(c => c.tipo === 'Camping');

  containerHoteles.innerHTML = hoteles.length === 0 ? '<p class="text-xs text-slate-400 italic">No hay hoteles creados.</p>' :
    hoteles.map(h => `
      <label class="flex items-center gap-2 p-1.5 rounded-lg hover:bg-purple-100/50 cursor-pointer text-xs font-semibold text-slate-800 transition-colors">
        <input type="checkbox" name="cliente-asignacion" value="${h.nombre}" onchange="onCambioCheckboxCliente(this)" class="w-4 h-4 text-purple-600 rounded border-slate-300">
        <span>${h.nombre} <span class="text-[10px] text-slate-400">(${h.zona || 'Zona'})</span></span>
      </label>
    `).join('');

  containerRest.innerHTML = restaurantes.length === 0 ? '<p class="text-xs text-slate-400 italic">No hay restaurantes creados.</p>' :
    restaurantes.map(r => `
      <label class="flex items-center gap-2 p-1.5 rounded-lg hover:bg-blue-100/50 cursor-pointer text-xs font-semibold text-slate-800 transition-colors">
        <input type="checkbox" name="cliente-asignacion" value="${r.nombre}" onchange="onCambioCheckboxCliente(this)" class="w-4 h-4 text-blue-600 rounded border-slate-300">
        <span>${r.nombre} <span class="text-[10px] text-slate-400">(${r.zona || 'Zona'})</span></span>
      </label>
    `).join('');

  containerMixto.innerHTML = mixtos.length === 0 ? '<p class="text-xs text-slate-400 italic">No hay mixtos creados.</p>' :
    mixtos.map(m => `
      <label class="flex items-center gap-2 p-1.5 rounded-lg hover:bg-emerald-100/50 cursor-pointer text-xs font-semibold text-slate-800 transition-colors">
        <input type="checkbox" name="cliente-asignacion" value="${m.nombre}" onchange="onCambioCheckboxCliente(this)" class="w-4 h-4 text-emerald-600 rounded border-slate-300">
        <span>${m.nombre} <span class="text-[10px] text-slate-400">(${m.zona || 'Zona'})</span></span>
      </label>
    `).join('');

  containerCamping.innerHTML = campings.length === 0 ? '<p class="text-xs text-slate-400 italic">No hay campings creados.</p>' :
    campings.map(cp => `
      <label class="flex items-center gap-2 p-1.5 rounded-lg hover:bg-amber-100/50 cursor-pointer text-xs font-semibold text-slate-800 transition-colors">
        <input type="checkbox" name="cliente-asignacion" value="${cp.nombre}" onchange="onCambioCheckboxCliente(this)" class="w-4 h-4 text-amber-600 rounded border-slate-300">
        <span>${cp.nombre} <span class="text-[10px] text-slate-400">(${cp.zona || 'Zona'})</span></span>
      </label>
    `).join('');

  renderClientesManualesTempRapido();
}

window.filtrarClientesPorLupa = function() {
  const inputLupa = document.getElementById('input-lupa-clientes');
  if (!inputLupa) return;
  const texto = inputLupa.value.toLowerCase().trim();
  renderResultadosLupa(texto);
};

function renderResultadosLupa(textoFiltro) {
  const container = document.getElementById('resultados-lupa-container');
  if (!container) return;

  if (!textoFiltro) {
    container.innerHTML = '<p class="text-xs text-slate-400 italic text-center py-1">Escribe en la lupa para buscar clientes rápidamente...</p>';
    return;
  }

  const encontrados = clientes.filter(c => 
    c.nombre.toLowerCase().includes(textoFiltro) || 
    (c.zona && c.zona.toLowerCase().includes(textoFiltro)) ||
    (c.tipo && c.tipo.toLowerCase().includes(textoFiltro))
  );

  if (encontrados.length === 0) {
    container.innerHTML = '<p class="text-xs text-red-500 font-semibold text-center py-1">No se encontró ningún cliente con ese nombre. Puedes añadirlo manualmente abajo.</p>';
    return;
  }

  container.innerHTML = encontrados.map(c => `
    <div class="bg-white p-2.5 rounded-xl border border-blue-200 flex justify-between items-center text-xs shadow-2xs hover:bg-blue-50/50 transition-colors">
      <div>
        <span class="font-extrabold text-slate-900">${c.nombre}</span>
        <span class="text-slate-500 ml-1">(${c.tipo} - ${c.zona || 'Sin Zona'})</span>
      </div>
      <button type="button" onclick="seleccionarClienteDesdeLupa('${c.nombre.replace(/'/g, "\\'")}')" class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg cursor-pointer flex items-center gap-1">
        <i class="fa-solid fa-plus"></i> Seleccionar
      </button>
    </div>
  `).join('');
}

window.seleccionarClienteDesdeLupa = function(nombreCliente) {
  const checkboxes = document.querySelectorAll('#modal-asignar-ruta input[name="cliente-asignacion"]');
  let encontrado = false;
  checkboxes.forEach(cb => {
    if (cb.value === nombreCliente) {
      cb.checked = true;
      encontrado = true;
      cb.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const parent = cb.closest('label');
      if (parent) {
        parent.classList.add('bg-blue-100', 'ring-2', 'ring-blue-400');
        setTimeout(() => parent.classList.remove('bg-blue-100', 'ring-2', 'ring-blue-400'), 1200);
      }
    }
  });

  const diaActivo = (typeof diaActualModal !== 'undefined' && diaActualModal) || diaSeleccionadoActual || 'Lunes';

  if (encontrado) {
    guardarEstadoDiaActualDesdeModal();
    actualizarContadorClientesModal();
    if (typeof mostrarToastLogistica === 'function') {
      mostrarToastLogistica(`✓ "${nombreCliente}" añadido para el ${diaActivo}`);
    }
    const inputLupa = document.getElementById('input-lupa-clientes');
    if (inputLupa) inputLupa.value = '';
    renderResultadosLupa('');
  } else {
    if (!clientesManualesTempRapido.includes(nombreCliente)) {
      clientesManualesTempRapido.push(nombreCliente);
      renderClientesManualesTempRapido();
      guardarEstadoDiaActualDesdeModal();
      actualizarContadorClientesModal();
      if (typeof mostrarToastLogistica === 'function') {
        mostrarToastLogistica(`✓ "${nombreCliente}" añadido como cliente para el ${diaActivo}`);
      }
      const inputLupa = document.getElementById('input-lupa-clientes');
      if (inputLupa) inputLupa.value = '';
      renderResultadosLupa('');
    }
  }
};

window.agregarClienteManualRapido = function() {
  const input = document.getElementById('input-cliente-manual-rapido');
  if (!input) return;
  const val = input.value.trim();
  if (val && !clientesManualesTempRapido.includes(val)) {
    clientesManualesTempRapido.push(val);
    input.value = '';
    renderClientesManualesTempRapido();
    guardarEstadoDiaActualDesdeModal();
    actualizarContadorClientesModal();
    const diaActivo = (typeof diaActualModal !== 'undefined' && diaActualModal) || diaSeleccionadoActual || 'Lunes';
    if (typeof mostrarToastLogistica === 'function') {
      mostrarToastLogistica(`✓ "${val}" añadido manualmente para el ${diaActivo}`);
    }
  }
};

window.quitarClienteManualRapido = function(idx) {
  clientesManualesTempRapido.splice(idx, 1);
  renderClientesManualesTempRapido();
  guardarEstadoDiaActualDesdeModal();
  actualizarContadorClientesModal();
};

function renderClientesManualesTempRapido() {
  const container = document.getElementById('lista-manuales-temp');
  if (!container) return;
  container.innerHTML = clientesManualesTempRapido.map((c, i) => `
    <span class="bg-purple-100 text-purple-800 text-[11px] px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 shadow-2xs">
      ${c} <button type="button" onclick="quitarClienteManualRapido(${i})" class="text-red-500 hover:text-red-700 font-black cursor-pointer">&times;</button>
    </span>
  `).join('');
}

window.guardarRutaAsignadaRapida = function(e) {
  if (e) e.preventDefault();

  // 1. Guardar el estado del día que está actualmente visible en pantalla
  guardarEstadoDiaActualDesdeModal();

  // 2. Verificar los días modificados o configurados
  const norm = str => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() : '';
  const diasAProcesar = [];
  let totalClientesEncontrados = 0;

  diasSemana.forEach(d => {
    const estado = modalAsignacionTemporal ? modalAsignacionTemporal[d] : null;
    if (estado && (estado.modificado || (estado.clientes && estado.clientes.length > 0))) {
      diasAProcesar.push(d);
      totalClientesEncontrados += (estado.clientes ? estado.clientes.length : 0);
    }
  });

  // Si ningún día tiene establecimientos seleccionados, avisar sin cerrar el modal para permitir continuar editando
  if (totalClientesEncontrados === 0) {
    alert('Selecciona al menos un establecimiento para asignar la ruta.');
    return;
  }

  const diasActualizados = [];

  // 3. Consolidar definitivamente en rutas los días modificados
  diasAProcesar.forEach(dia => {
    const estado = modalAsignacionTemporal[dia];
    if (!estado || !estado.modificado) return;

    const clientesDelDia = estado.clientes || [];
    const camionDelDia = estado.camion || (camiones[0]?.matricula || '');

    // Eliminar las rutas pendientes anteriores de este chofer para este día específico
    const indicesAEliminar = [];
    rutas.forEach((r, idx) => {
      if (
        norm(r.dia) === norm(dia) &&
        r.chofer === choferSeleccionadoAsignacion &&
        r.estado !== 'completada' &&
        r.estado !== 'finalizada'
      ) {
        indicesAEliminar.push(idx);
      }
    });

    for (let i = indicesAEliminar.length - 1; i >= 0; i--) {
      rutas.splice(indicesAEliminar[i], 1);
    }

    // Si el día contiene clientes configurados, añadir la ruta consolidada
    if (clientesDelDia.length > 0) {
      rutas.push({
        id: 'ruta_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        dia: dia,
        tipoCliente: 'Mixto',
        chofer: choferSeleccionadoAsignacion,
        camion: camionDelDia,
        clientes: [...clientesDelDia],
        estado: 'pendiente'
      });
      diasActualizados.push(dia);
    } else {
      diasActualizados.push(`${dia} (limpiado)`);
    }
  });

  // 4. Persistir datos en almacenamiento local y sincronizar la interfaz
  guardarDatosEnLocal();
  toggleModalAsignarRuta(false);

  renderGridChoferesAsignacion();
  renderDiasSemana();
  if (typeof renderVisualizacionRutasChoferes === 'function') {
    renderVisualizacionRutasChoferes();
  }

  const detalleDias = diasActualizados.length > 0 ? diasActualizados.join(', ') : 'semana';
  if (typeof mostrarToastLogistica === 'function') {
    mostrarToastLogistica(`✓ Asignación consolidada para ${choferSeleccionadoAsignacion} (${detalleDias})`);
  }
};

window.eliminarRutaConductor = function(dia, choferNombre, rIndex) {
  if (confirm(`¿Eliminar la Ruta ${rIndex + 1} de ${choferNombre} para el ${dia}?`)) {
    let count = 0;
    let targetIndex = -1;
    rutas.forEach((r, i) => {
      if (r.dia === dia && r.chofer === choferNombre) {
        if (count === rIndex) targetIndex = i;
        count++;
      }
    });

    if (targetIndex !== -1) {
      rutas.splice(targetIndex, 1);
      guardarDatosEnLocal();
      renderGridChoferesAsignacion();
    }
  }
};
/* --- GESTIÓN DE MODAL DE CAMIONES Y FILTROS --- */
window.toggleModalCamion = function(show, editIndex = null) {
  const modal = document.getElementById('modal-camion');
  const form = document.getElementById('form-camion') || document.querySelector('#modal-camion form');
  const preview = document.getElementById('preview-camion-subida');
  if (!modal) return;

  if (show) {
    if (editIndex !== null && editIndex !== undefined && editIndex !== '' && !isNaN(editIndex)) {
      modal.dataset.editIndex = editIndex;
      const c = camiones[editIndex];
      if (c) {
        document.getElementById('camion-matricula').value = c.matricula || '';
        document.getElementById('camion-modelo').value = c.modelo || '';
        document.getElementById('camion-tipo').value = c.tipo || 'Pequeño';
        document.getElementById('camion-foto-input').value = c.foto || '';
        if (preview) {
          preview.innerHTML = c.foto ? `<img src="${c.foto}" class="w-full h-24 object-cover rounded-xl border border-blue-300">` : '';
        }
      }
    } else {
      delete modal.dataset.editIndex;
      if (form) form.reset();
      document.getElementById('camion-foto-input').value = '';
      if (preview) preview.innerHTML = '';
    }
  }
  modal.classList.toggle('hidden', !show);
};

window.abrirModalEditarCamion = function(index) {
  window.toggleModalCamion(true, index);
};

window.filtrarCamionesPorTipo = function(tipo) {
  filtroCamionActual = tipo;
  renderCamiones();
};

window.mostrarTodosCamiones = function() {
  filtroCamionActual = 'Todos';
  renderCamiones();
};