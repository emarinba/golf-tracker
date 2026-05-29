/**
 * =====================================================================
 * GAME.JS - Vista de nueva partida / editar
 * ===================================================================== */

const GameView = {
  
  editingGameId: null,
  currentCourseId: null,
  holesData: [],
  
  /**
   * Inicializar vista
   */
  async initialize() {
    console.log('🎮 Inicializando vista de juego...');
    
    // Cargar campos para el combo
    await this.loadCourses();
    
    // Establecer fecha actual
    document.getElementById('game-date').value = Utils.getTodayDate();
    
    // Renderizar hoyos vacíos
    this.renderHoles();
  },
  
  /**
   * Cargar campos para el select
   */
  async loadCourses() {
    try {
      const { data, error } = await window.SupabaseAPI.courses.getAll();
      
      if (error) throw new Error(error);
      
      this.updateCourseSelect(data || []);
      
    } catch (error) {
      console.error('Error cargando campos:', error);
    }
  },
  
  /**
   * Actualizar el select de campos
   */
  updateCourseSelect(courses) {
    const select = document.getElementById('game-course-select');
    if (!select) return;
    
    select.innerHTML = '<option value="">Selecciona un campo</option>' + 
      courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  },
  
  /**
   * Cuando cambia el campo seleccionado → PRE-CARGAR configuración
   */
  async onCourseChange() {
    const select = document.getElementById('game-course-select');
    const courseId = select.value;
    
    if (!courseId) {
      // Sin campo → valores por defecto
      this.currentCourseId = null;
      this.renderHoles();
      return;
    }
    
    try {
      // Cargar configuración del campo
      const { data: course, error } = await window.SupabaseAPI.courses.getById(courseId);
      
      if (error || !course) {
        throw new Error('Error cargando campo');
      }
      
      this.currentCourseId = courseId;
      this.currentCourseObj = course;  // Guardar para cálculo WHS posterior
      
      // PRE-CARGAR par y estrellas de cada hoyo
      const holes = course.course_holes || [];
      this.renderHoles(holes);
      
      Utils.showToast(`Campo "${course.name}" cargado`, 'success');
      
    } catch (error) {
      console.error('Error cargando configuración del campo:', error);
      Utils.showToast('Error al cargar configuración del campo', 'error');
    }
  },
  
  /**
   * Renderizar tarjetas de hoyos
   */
  renderHoles(courseHoles = []) {
    const container = document.getElementById('holes-container');
    if (!container) return;
    
    const defaultPars = [4, 4, 3, 4, 5, 3, 4, 4, 5, 4, 4, 3, 4, 5, 3, 4, 4, 5];
    
    // Preservar golpes ya introducidos si los hay
    const prevStrokes = this.holesData.map(h => h?.strokes || 0);

    container.innerHTML = Array.from({ length: 18 }, (_, i) => {
      const holeNumber = i + 1;
      const hole = courseHoles.find(h => h.hole_number === holeNumber);
      const par = hole?.par || defaultPars[i];
      const stars = hole?.stars || 0;
      const strokes = prevStrokes[i] || '';
      
      return Components.renderHoleCard(holeNumber, par, stars, strokes);
    }).join('');

    // CRÍTICO: Inicializar holesData con par y stars del campo renderizado.
    // Sin esto, las estrellas no se guardan si el usuario no toca los golpes.
    this.holesData = Array.from({ length: 18 }, (_, i) => {
      const holeNumber = i + 1;
      const hole = courseHoles.find(h => h.hole_number === holeNumber);
      const par   = hole?.par   || defaultPars[i];
      const stars = hole?.stars || 0;
      const strokes = prevStrokes[i] || 0;
      const { scr, hcp } = strokes > 0
        ? Utils.calculatePoints(par, stars, strokes)
        : { scr: 0, hcp: 0 };
      return { hole_number: holeNumber, par, stars, strokes, scr, hcp };
    });
    
    // Actualizar totales
    this.updateTotals();
  },
  
  /**
   * Actualizar puntuación de un hoyo cuando cambian los golpes o estrellas
   */
  updateHoleScore(holeNumber) {
    const index = holeNumber - 1;
    
    // Obtener valores
    const strokesInput = document.getElementById(`strokes-${holeNumber}`);
    const strokes = strokesInput.value ? parseInt(strokesInput.value) : 0;
    
    // Obtener par — puede ser el badge estático o el select si está en edición
    const parEl = document.getElementById(`hole-par-value-${holeNumber}`);
    const parSelectEl = document.getElementById(`hole-par-select-${holeNumber}`);
    const par = parSelectEl
      ? parseInt(parSelectEl.value)
      : parseInt(parEl?.textContent || 4);
    
    // Leer estrellas desde los botones activos
    const holeCard = strokesInput.closest('.hole-card');
    const starsGroup = holeCard.querySelector('.hole-stars-toggle');
    const activeStarBtn = starsGroup?.querySelector('.star-toggle-btn.active');
    const stars = activeStarBtn ? parseInt(activeStarBtn.dataset.value) : 0;

    // par ya calculado arriba
    
    // Calcular puntos (solo si hay golpes)
    let scr = 0;
    let hcp = 0;
    
    if (strokes > 0) {
      const points = Utils.calculatePoints(par, stars, strokes);
      scr = points.scr;
      hcp = points.hcp;
    }
    
    // Actualizar display
    document.getElementById(`scr-${holeNumber}`).textContent = scr;
    document.getElementById(`hcp-${holeNumber}`).textContent = hcp;
    
    // Guardar en array
    this.holesData[index] = {
      hole_number: holeNumber,
      par,
      stars,
      strokes,
      scr,
      hcp
    };
    
    // Actualizar totales
    this.updateTotals();
  },
  
  /**
   * Actualizar totales (9 primeros, 9 últimos, total 18)
   */
  updateTotals() {
    const front9 = this.holesData.slice(0, 9);
    const back9 = this.holesData.slice(9, 18);
    
    // Primeros 9
    const frontStrokes = front9.reduce((sum, h) => sum + (h?.strokes || 0), 0);
    const frontScr = front9.reduce((sum, h) => sum + (h?.scr || 0), 0);
    const frontHcp = front9.reduce((sum, h) => sum + (h?.hcp || 0), 0);
    
    document.getElementById('total-front-strokes').textContent = frontStrokes;
    document.getElementById('total-front-scr').textContent = frontScr;
    document.getElementById('total-front-hcp').textContent = frontHcp;
    
    // Últimos 9
    const backStrokes = back9.reduce((sum, h) => sum + (h?.strokes || 0), 0);
    const backScr = back9.reduce((sum, h) => sum + (h?.scr || 0), 0);
    const backHcp = back9.reduce((sum, h) => sum + (h?.hcp || 0), 0);
    
    document.getElementById('total-back-strokes').textContent = backStrokes;
    document.getElementById('total-back-scr').textContent = backScr;
    document.getElementById('total-back-hcp').textContent = backHcp;
    
    // Total 18
    const totalScr = frontScr + backScr;
    const totalHcp = frontHcp + backHcp;
    
    document.getElementById('total-strokes').textContent = frontStrokes + backStrokes;
    document.getElementById('total-scr').textContent = totalScr;
    document.getElementById('total-hcp').textContent = totalHcp;
    
    // Actualizar vista rápida (toggle button)
    const quickScr = document.getElementById('quick-total-scr');
    const quickHcp = document.getElementById('quick-total-hcp');
    if (quickScr) quickScr.textContent = totalScr;
    if (quickHcp) quickHcp.textContent = totalHcp;
  },
  
  /**
   * Toggle del resumen de totales
   */
  toggleTotals() {
    const totalsEl = document.getElementById('game-totals');
    const toggleBtn = document.querySelector('.game-totals-toggle');
    const summaryText = document.getElementById('totals-summary-text');
    
    if (totalsEl && toggleBtn) {
      const isCollapsed = totalsEl.classList.contains('collapsed');
      
      if (isCollapsed) {
        totalsEl.classList.remove('collapsed');
        toggleBtn.classList.add('expanded');
        if (summaryText) summaryText.textContent = 'Ocultar resumen';
      } else {
        totalsEl.classList.add('collapsed');
        toggleBtn.classList.remove('expanded');
        if (summaryText) summaryText.textContent = 'Ver resumen';
      }
    }
  },
  
  /**
   * Activar edición del par de un hoyo (doble click en el badge)
   * Reemplaza el badge estático por un <select> inline
   */
  editHolePar(holeNumber) {
    const parEl = document.getElementById(`hole-par-${holeNumber}`);
    if (!parEl) return;

    // Si ya está en modo edición, no hacer nada
    if (document.getElementById(`hole-par-select-${holeNumber}`)) return;

    const currentPar = parseInt(
      document.getElementById(`hole-par-value-${holeNumber}`)?.textContent || 4
    );

    // Sustituir contenido del badge por un select
    parEl.innerHTML = `
      <span>Par</span>
      <select
        id="hole-par-select-${holeNumber}"
        onchange="GameView.confirmHolePar(${holeNumber})"
        onblur="GameView.confirmHolePar(${holeNumber})"
        style="
          font-size: var(--text-sm);
          font-weight: var(--font-bold);
          background: var(--bg-primary);
          border: 2px solid var(--primary);
          border-radius: var(--border-radius-sm);
          padding: 2px 4px;
          color: var(--primary);
          cursor: pointer;
          outline: none;
        "
      >
        <option value="3" ${currentPar === 3 ? 'selected' : ''}>3</option>
        <option value="4" ${currentPar === 4 ? 'selected' : ''}>4</option>
        <option value="5" ${currentPar === 5 ? 'selected' : ''}>5</option>
      </select>
    `;

    // Foco automático
    const select = document.getElementById(`hole-par-select-${holeNumber}`);
    if (select) select.focus();
  },

  /**
   * Confirmar el par seleccionado y volver al badge estático
   */
  confirmHolePar(holeNumber) {
    const select = document.getElementById(`hole-par-select-${holeNumber}`);
    if (!select) return;

    const newPar = parseInt(select.value);

    // Restaurar badge estático con el nuevo valor
    const parEl = document.getElementById(`hole-par-${holeNumber}`);
    if (parEl) {
      parEl.innerHTML = `
        <span>Par</span>
        <strong id="hole-par-value-${holeNumber}">${newPar}</strong>
      `;
    }

    // Actualizar holesData con el nuevo par
    const index = holeNumber - 1;
    if (this.holesData[index]) {
      this.holesData[index].par = newPar;
    }

    // Recalcular score del hoyo con el nuevo par
    this.updateHoleScore(holeNumber);

    Utils.showToast(`Hoyo ${holeNumber}: par corregido a ${newPar}`, 'info');
  },

  /**
   */
  async saveGame() {
    try {
      console.log('💾 Iniciando guardado de partida');
      console.log('📊 Estado actual:', {
        editingGameId: this.editingGameId,
        esNueva: !this.editingGameId,
        holesData: this.holesData.length
      });
      
      // Validar fecha
      const gameDate = document.getElementById('game-date').value;
      if (!gameDate) {
        Utils.showToast('Por favor selecciona una fecha', 'warning');
        return;
      }
      
      // Contar hoyos con golpes (validar al menos 1 hoyo jugado)
      const holesWithStrokes = this.holesData.filter(h => h?.strokes > 0).length;
      
      console.log('🎯 Hoyos con golpes:', holesWithStrokes);
      
      if (holesWithStrokes === 0) {
        Utils.showToast('Por favor introduce los golpes de al menos un hoyo', 'warning');
        return;
      }
      
      // Recopilar solo los hoyos con golpes (filtrar vacíos para BD)
      const holes = [];
      for (let i = 1; i <= 18; i++) {
        const strokesInput = document.getElementById(`strokes-${i}`);
        const strokes = parseInt(strokesInput.value) || 0;
        
        // Solo incluir hoyos con golpes > 0
        if (strokes === 0) continue;
        
        const holeCard = strokesInput.closest('.hole-card');
        // Leer par — puede estar en modo select (edición) o badge estático
        const parSelectEl = document.getElementById(`hole-par-select-${i}`);
        const parValueEl  = document.getElementById(`hole-par-value-${i}`);
        const par = parSelectEl
          ? parseInt(parSelectEl.value)
          : parseInt(parValueEl?.textContent || 4);
        
        // Leer estrellas desde botones activos
        const starsGroup = holeCard.querySelector('.hole-stars-toggle');
        const activeStarBtn = starsGroup?.querySelector('.star-toggle-btn.active');
        const stars = activeStarBtn ? parseInt(activeStarBtn.dataset.value) : 0;
        
        const scr = parseInt(document.getElementById(`scr-${i}`).textContent) || 0;
        const hcp = parseInt(document.getElementById(`hcp-${i}`).textContent) || 0;
        
        holes.push({
          hole: i,
          par,
          stars,
          strokes,
          score_sch: scr,
          score_hcp: hcp
        });
      }
      
      // Construir objeto de partida
      const gameData = {
        courseId: document.getElementById('game-course-select').value || null,
        gameDate: gameDate,
        gameName: document.getElementById('game-name').value.trim() || null,
        handicapTotal: parseInt(document.getElementById('game-handicap').value) || 0,
        holes
      };
      
      console.log('📦 Datos a guardar:', {
        esNueva: !this.editingGameId,
        gameId: this.editingGameId,
        courseId: gameData.courseId,
        fecha: gameData.gameDate,
        hoyosEnviados: holes.length
      });
      
      // Deshabilitar botón
      const btn = document.getElementById('save-game-btn');
      if (btn) {
        btn.disabled = true;
        btn.classList.add('loading');
      }
      
      let result;
      
      if (this.editingGameId) {
        // Actualizar partida existente
        console.log('🔄 ACTUALIZAR partida:', this.editingGameId);
        result = await window.SupabaseAPI.games.update(this.editingGameId, gameData);
        Utils.showToast('Partida actualizada correctamente', 'success');
      } else {
        // Crear nueva partida
        console.log('➕ CREAR nueva partida');
        result = await window.SupabaseAPI.games.create(gameData);
        Utils.showToast('Partida guardada correctamente', 'success');
      }
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      console.log('✅ Partida guardada correctamente, ID:', this.editingGameId || 'nueva');
      
      // Rehabilitar botón ANTES de resetear
      if (btn) {
        btn.disabled = false;
        btn.classList.remove('loading');
      }

      // Preguntar si añadir al hándicap oficial
      const savedGame = result.data;
      const holesCount = holes.length;
      const gameDataForHcp = {
        id:              savedGame?.id || null,
        game_date:       gameDate,
        game_name:       document.getElementById('game-name').value.trim() || null,
        course_name:     this.currentCourseObj?.name || null,
        exact_index:     parseFloat(document.getElementById('game-exact-index').value) || null,
        handicap_total:  parseInt(document.getElementById('game-handicap').value) || 0,
        total_strokes:   holes.reduce((s, h) => s + (h.strokes || 0), 0),
        holes_played:    holesCount <= 9 ? 9 : 18,
        courseObj:       this.currentCourseObj || null,
      };

      // CRÍTICO: Resetear ANTES de navegar
      this.reset();
      
      // Volver al dashboard
      GolfApp.navigate('dashboard');

      // A1: Recargar datos del dashboard para reflejar la nueva partida
      DashboardView.loadGames();
      DashboardView.loadCourses();

      // Ofrecer añadir al hándicap (con pequeño delay para que el navigate termine)
      if (typeof HandicapView !== 'undefined' && gameDataForHcp.exact_index) {
        setTimeout(() => {
          HandicapView.promptAddFromGame(gameDataForHcp);
        }, 400);
      }
      
    } catch (error) {
      console.error('Error guardando partida:', error);
      Utils.showToast('Error al guardar partida', 'error');
      
      // Restaurar botón
      const btn = document.getElementById('save-game-btn');
      btn.disabled = false;
      btn.classList.remove('loading');
    }
  },
  
  /**
   * Cargar partida para editar
   */
  loadGameForEdit(game) {
    console.log('✏️ Cargando partida para editar:', game.id);
    console.log('📊 Datos de la partida:', {
      id: game.id,
      fecha: game.game_date,
      campo: game.course_id,
      hoyos: game.holes?.length || 0
    });
    
    // CRÍTICO: Establecer ID de edición ANTES de cargar datos
    this.editingGameId = game.id;
    
    // Actualizar título
    const title = document.getElementById('game-view-title');
    if (title) title.textContent = 'Editar Partida';
    
    // Rellenar formulario
    document.getElementById('game-course-select').value = game.course_id || '';
    document.getElementById('game-date').value = game.game_date;
    document.getElementById('game-name').value = game.game_name || '';
    document.getElementById('game-handicap').value = game.handicap_total;
    document.getElementById('game-exact-index').value = game.exact_index || '';
    
    // Crear array completo de 18 hoyos
    // Combinar hoyos guardados con hoyos por defecto
    const savedHoles = game.holes || [];
    const completeHoles = [];
    
    console.log('📝 Hoyos guardados en BD:', savedHoles.length);
    
    for (let i = 1; i <= 18; i++) {
      // Buscar si este hoyo está guardado
      const savedHole = savedHoles.find(h => h.hole_number === i);
      
      if (savedHole) {
        // Usar datos guardados
        completeHoles.push(savedHole);
      } else {
        // Usar defaults (hoyo vacío)
        completeHoles.push({
          hole_number: i,
          par: 4,
          stars: 0,
          strokes: 0,
          score_sch: 0,
          score_hcp: 0
        });
      }
    }
    
    // Actualizar holesData
    this.holesData = completeHoles.map((h, i) => ({
      hole_number: h.hole_number || i + 1,
      par: h.par,
      stars: h.stars,
      strokes: h.strokes || 0,
      scr: h.score_sch || 0,
      hcp: h.score_hcp || 0
    }));
    
    console.log('✅ Estado cargado - editingGameId:', this.editingGameId);
    
    // Renderizar todos los hoyos (18)
    this.renderHolesWithData(completeHoles);
  },
  
  /**
   * Renderizar hoyos con datos de partida existente
   */
  renderHolesWithData(holes) {
    const container = document.getElementById('holes-container');
    if (!container) return;
    
    container.innerHTML = holes.map((h, i) => {
      const holeNumber = h.hole_number || i + 1;
      // Permitir valores 0 o null sin problemas
      const strokes = h.strokes || '';
      return Components.renderHoleCard(holeNumber, h.par, h.stars, strokes);
    }).join('');
    
    this.updateTotals();
  },
  
  /**
   * Enviar la partida actualmente abierta (en edición) al módulo de hándicap.
   * Disponible tanto en modo edición como antes de guardar.
   */
  sendCurrentGameToHandicap() {
    if (typeof HandicapView === 'undefined') {
      Utils.showToast('Módulo de hándicap no disponible', 'error');
      return;
    }

    const gameDate = document.getElementById('game-date').value;
    if (!gameDate) {
      Utils.showToast('Introduce la fecha de la partida primero', 'warning');
      return;
    }

    // Calcular golpes totales desde el estado actual
    const totalStrokes = this.holesData.reduce((s, h) => s + (h?.strokes || 0), 0);
    const holesWithStrokes = this.holesData.filter(h => h?.strokes > 0).length;

    HandicapView.promptAddFromGame({
      id:             this.editingGameId || null,
      game_date:      gameDate,
      game_name:      document.getElementById('game-name').value.trim() || null,
      course_name:    this.currentCourseObj?.name || null,
      exact_index:    parseFloat(document.getElementById('game-exact-index').value) || null,
      handicap_total: parseInt(document.getElementById('game-handicap').value) || 0,
      total_strokes:  totalStrokes,
      holes_played:   holesWithStrokes <= 9 ? 9 : 18,
      courseObj:      this.currentCourseObj || null,
    });
  },

  /**
   */
  reset() {
    console.log('🔄 Reseteando GameView');
    
    // CRÍTICO: Limpiar estado de edición
    this.editingGameId = null;
    this.currentCourseId = null;
    this.currentCourseObj = null;
    this.holesData = [];
    
    // Resetear título
    const title = document.getElementById('game-view-title');
    if (title) title.textContent = 'Nueva Partida';
    
    // Resetear formulario
    document.getElementById('game-course-select').value = '';
    document.getElementById('game-date').value = Utils.getTodayDate();
    document.getElementById('game-name').value = '';
    document.getElementById('game-handicap').value = '20';
    document.getElementById('game-exact-index').value = '';
    
    // CRÍTICO: Rehabilitar botón guardar
    const btn = document.getElementById('save-game-btn');
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('loading');
    }
    
    // Limpiar container de hoyos
    const container = document.getElementById('holes-container');
    if (container) container.innerHTML = '';
    
    // Renderizar hoyos vacíos
    this.renderHoles();
    
    console.log('✅ GameView reseteado');
  }
};

// Exportar
window.GameView = GameView;

console.log('✅ GameView cargado');
