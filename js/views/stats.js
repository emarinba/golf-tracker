/**
 * =====================================================================
 * STATS.JS - Módulo de Estadísticas
 * A2: Estadísticas por campo
 * A3: Gráfico evolución del hándicap
 * =====================================================================
 */

const StatsView = {

  // Datos cargados
  globalStats:  null,
  courseStats:  [],
  hcpRounds:    [],

  // Estado del gráfico
  hcpChart:      null,
  activePeriod:  'all',   // 'all' | '6m' | '1y'

  // ===================================================================
  // 1. INICIALIZACIÓN
  // ===================================================================

  async initialize() {
    console.log('📊 Inicializando estadísticas...');
    await this.loadAll();
  },

  async loadAll() {
    this.renderLoading();

    try {
      const [globalRes, courseRes, hcpRes] = await Promise.all([
        window.SupabaseAPI.stats.getUserStats(),
        window.SupabaseAPI.stats.getStatsByCourse(),
        window.SupabaseAPI.handicap.getAll()
      ]);

      this.globalStats = globalRes.data;
      this.courseStats = courseRes.data || [];
      this.hcpRounds   = (hcpRes.data || [])
        .sort((a, b) => new Date(a.round_date) - new Date(b.round_date));

      this.render();
      console.log('✅ Estadísticas cargadas');

    } catch (err) {
      console.error('❌ Error cargando estadísticas:', err);
      Utils.showToast('Error al cargar estadísticas', 'error');
    }
  },

  // ===================================================================
  // 2. RENDER PRINCIPAL
  // ===================================================================

  renderLoading() {
    const body = document.getElementById('stats-body');
    if (body) {
      body.innerHTML = `
        <div class="stats-loading">
          <div class="stats-loading-spinner"></div>
          Cargando estadísticas...
        </div>
      `;
    }
  },

  render() {
    this.renderGlobalCards();
    this.renderHcpChart();
    this.renderCourseTable();
  },

  // ===================================================================
  // 3. TARJETAS GLOBALES
  // ===================================================================

  renderGlobalCards() {
    const el = document.getElementById('stats-global-grid');
    if (!el) return;

    const s = this.globalStats;

    if (!s) {
      el.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:var(--space-8);color:var(--text-tertiary)">
          Sin partidas registradas todavía
        </div>`;
      return;
    }

    el.innerHTML = `
      <div class="stats-global-card card-accent-primary">
        <span class="stats-global-label">Partidas totales</span>
        <span class="stats-global-value">${s.totalGames}</span>
        <span class="stats-global-sub">Última: ${Utils.formatDateShort(s.lastGameDate)}</span>
      </div>
      <div class="stats-global-card card-accent-secondary">
        <span class="stats-global-label">Mejor HCP</span>
        <span class="stats-global-value">${s.bestHcp}</span>
        <span class="stats-global-sub">Media: ${s.avgHcp}</span>
      </div>
      <div class="stats-global-card">
        <span class="stats-global-label">Mejor SCR</span>
        <span class="stats-global-value" style="color:var(--primary)">${s.bestSch}</span>
        <span class="stats-global-sub">Media: ${s.avgSch}</span>
      </div>
      <div class="stats-global-card">
        <span class="stats-global-label">Campos jugados</span>
        <span class="stats-global-value" style="color:var(--secondary)">${this.courseStats.length}</span>
        <span class="stats-global-sub">campos distintos</span>
      </div>
    `;
  },

  // ===================================================================
  // 4. GRÁFICO EVOLUCIÓN HÁNDICAP (A3)
  // ===================================================================

  renderHcpChart() {
    const canvas = document.getElementById('hcp-evolution-chart');
    if (!canvas) return;

    // Filtrar por período
    const filtered = this._filterByPeriod(this.hcpRounds, this.activePeriod);

    if (filtered.length < 2) {
      canvas.style.display = 'none';
      const empty = document.getElementById('hcp-chart-empty');
      if (empty) empty.classList.remove('hidden');
      return;
    }

    canvas.style.display = 'block';
    const empty = document.getElementById('hcp-chart-empty');
    if (empty) empty.classList.add('hidden');

    // Calcular hándicap acumulado vuelta a vuelta
    const points = this._calcProgressiveHandicap(filtered);

    const labels = points.map(p => Utils.formatDateShort(p.date));
    const hcpData = points.map(p => p.handicap);
    const sdData  = points.map(p => p.sd_final);

    // Destruir chart anterior si existe
    if (this.hcpChart) {
      this.hcpChart.destroy();
      this.hcpChart = null;
    }

    const ctx = canvas.getContext('2d');
    this.hcpChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Índice Hándicap',
            data: hcpData,
            borderColor: '#16a34a',
            backgroundColor: 'rgba(22,163,74,0.08)',
            borderWidth: 2.5,
            pointRadius: 4,
            pointBackgroundColor: '#16a34a',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            fill: true,
            tension: 0.35,
            yAxisID: 'yHcp'
          },
          {
            label: 'SD Final',
            data: sdData,
            borderColor: '#f59e0b',
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderDash: [4, 3],
            pointRadius: 3,
            pointBackgroundColor: '#f59e0b',
            fill: false,
            tension: 0.35,
            yAxisID: 'ySd'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: { size: 11 },
              usePointStyle: true,
              pointStyleWidth: 8
            }
          },
          tooltip: {
            callbacks: {
              label: ctx => {
                const v = ctx.parsed.y;
                return ` ${ctx.dataset.label}: ${v !== null ? v.toFixed(1) : '--'}`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              font: { size: 10 },
              maxRotation: 45,
              autoSkip: true,
              maxTicksLimit: 10
            },
            grid: { display: false }
          },
          yHcp: {
            position: 'left',
            title: {
              display: true,
              text: 'Índice',
              font: { size: 10 }
            },
            ticks: { font: { size: 10 } },
            grid: { color: 'rgba(0,0,0,0.05)' }
          },
          ySd: {
            position: 'right',
            title: {
              display: true,
              text: 'SD',
              font: { size: 10 }
            },
            ticks: { font: { size: 10 } },
            grid: { display: false }
          }
        }
      }
    });
  },

  /**
   * Calcular el índice de hándicap progresivo vuelta a vuelta
   * Para cada posición i, toma las rondas 0..i y calcula el hándicap
   */
  _calcProgressiveHandicap(rounds) {
    const result = [];

    const whs = {
      3:{c:1,a:-2}, 4:{c:1,a:-1}, 5:{c:1,a:0},
      6:{c:2,a:-1}, 7:{c:2,a:0},  8:{c:2,a:0},
      9:{c:3,a:0},  10:{c:3,a:0}, 11:{c:4,a:0},
      12:{c:4,a:0}, 13:{c:5,a:0}, 14:{c:5,a:0},
      15:{c:6,a:0}, 16:{c:6,a:0}, 17:{c:7,a:0},
      18:{c:7,a:0}, 19:{c:8,a:0}, 20:{c:8,a:0}
    };

    for (let i = 0; i < rounds.length; i++) {
      const slice = rounds.slice(0, i + 1);         // rondas hasta esta fecha
      const last20 = slice.slice(-20);               // máximo 20
      const n = last20.length;

      if (n < 3) {
        result.push({ date: rounds[i].round_date, handicap: null, sd_final: parseFloat(rounds[i].sd_final) });
        continue;
      }

      const rule = whs[Math.min(n, 20)];
      const sorted = [...last20].sort((a, b) => parseFloat(a.sd_final) - parseFloat(b.sd_final));
      const best = sorted.slice(0, rule.c);
      const avg  = best.reduce((s, r) => s + parseFloat(r.sd_final), 0) / rule.c;
      const hcp  = Math.round((avg + rule.a) * 10) / 10;

      result.push({ date: rounds[i].round_date, handicap: hcp, sd_final: parseFloat(rounds[i].sd_final) });
    }

    return result;
  },

  /**
   * Cambiar período del gráfico
   */
  setPeriod(period) {
    this.activePeriod = period;

    // Actualizar pills
    document.querySelectorAll('.period-pill').forEach(p => {
      p.classList.toggle('active', p.dataset.period === period);
    });

    this.renderHcpChart();
  },

  _filterByPeriod(rounds, period) {
    if (period === 'all') return rounds;

    const now    = new Date();
    const months = period === '6m' ? 6 : 12;
    const cutoff = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());

    return rounds.filter(r => new Date(r.round_date) >= cutoff);
  },

  // ===================================================================
  // 5. TABLA POR CAMPO (A2)
  // ===================================================================

  renderCourseTable() {
    const container = document.getElementById('stats-courses-body');
    const emptyEl   = document.getElementById('stats-courses-empty');
    if (!container) return;

    if (!this.courseStats || this.courseStats.length === 0) {
      container.innerHTML = '';
      if (emptyEl) emptyEl.classList.remove('hidden');
      return;
    }

    if (emptyEl) emptyEl.classList.add('hidden');

    container.innerHTML = this.courseStats.map(s => `
      <tr>
        <td>
          <div class="course-name-cell">${Utils.sanitizeHTML(s.courseName)}</div>
          ${s.location ? `<div class="course-location-cell">📍 ${Utils.sanitizeHTML(s.location)}</div>` : ''}
        </td>
        <td><span class="games-count-pill">${s.games}</span></td>
        <td class="stat-best">${s.bestHcp}</td>
        <td class="stat-avg">${s.avgHcp}</td>
        <td class="stat-best">${s.bestSch}</td>
        <td class="stat-avg">${s.avgSch}</td>
        <td style="color:var(--text-secondary);font-size:var(--text-xs)">${Utils.formatDateShort(s.lastDate)}</td>
      </tr>
    `).join('');
  }
};

window.StatsView = StatsView;
console.log('✅ StatsView cargado');
