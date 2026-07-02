const BIN_ID = '6a44e154f5f4af5e294c7c33';
const ACCESS_KEY = '$2a$10$A3yJmomNl/6gUM5m82DnbuSfG2/Rg6OzNh5e5b9LLj24BCdI5GcO2';
const BIN_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

let allData = [];
let currentUnit = 'kg';
let chartInstance = null;
let lossChartInstance = null;
let searchTerm = '';
let selectedNames = new Set();

document.addEventListener('DOMContentLoaded', init);

function init() {
  setupForm();
  setupUnitToggle();
  setupTableDelegation();
  setupSearch();
  fetchAndRender();
}

function fetchAndRender() {
  showLoading(true);
  hideError();

  fetch(`${BIN_URL}/latest`, { headers: { 'X-Access-Key': ACCESS_KEY } })
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then(res => {
      allData = (res.record.entries || []).map(d => ({
        id: String(d.id),
        timestamp: String(d.timestamp),
        name: String(d.name),
        weight: Number(d.weight),
        color: String(d.color)
      }));
      renderAll();
      showLoading(false);
    })
    .catch(err => {
      showLoading(false);
      showError('Failed to load data. Check your internet connection.');
      console.error(err);
    });
}

function saveBin() {
  return fetch(BIN_URL, {
    method: 'PUT',
    headers: { 'X-Access-Key': ACCESS_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries: allData })
  }).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
}

function renderAll() {
  const filtered = getFilteredData();
  renderLeaderboard(filtered, currentUnit);
  renderChart(filtered, currentUnit);
  renderLossChart(filtered, currentUnit);
  renderTable(filtered, currentUnit);
  renderHeatmap(filtered);
  renderNameList();
}

function getFilteredData() {
  if (selectedNames.size === 0) return allData;
  return allData.filter(d => selectedNames.has(d.name));
}

function setupSearch() {
  const input = document.getElementById('search-input');
  const clear = document.getElementById('search-clear');
  const showAll = document.getElementById('show-all-btn');

  input.addEventListener('input', () => {
    searchTerm = input.value.trim().toLowerCase();
    renderNameList();
  });

  clear.addEventListener('click', () => {
    input.value = '';
    searchTerm = '';
    selectedNames.clear();
    renderAll();
  });

  showAll.addEventListener('click', () => {
    selectedNames.clear();
    renderAll();
  });

  document.getElementById('search-name-list').addEventListener('click', e => {
    const cb = e.target.closest('.search-name-checkbox');
    if (cb) {
      const name = cb.dataset.name;
      if (cb.checked) selectedNames.add(name);
      else selectedNames.delete(name);
      renderAll();
      return;
    }
    const csvBtn = e.target.closest('.search-csv-btn');
    if (csvBtn) {
      e.preventDefault();
      downloadCSV(csvBtn.dataset.name);
    }
  });
}

function renderNameList() {
  const container = document.getElementById('search-name-list');
  const actions = document.getElementById('search-actions');

  const allNames = [...new Set(allData.map(d => d.name))].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );

  const filtered = searchTerm
    ? allNames.filter(n => n.toLowerCase().includes(searchTerm))
    : allNames;

  if (allNames.length === 0) {
    container.innerHTML = '';
    actions.classList.add('hidden');
    return;
  }

  if (filtered.length === 0) {
    container.innerHTML = '<div class="search-empty">No names match</div>';
    actions.classList.add('hidden');
    return;
  }

  actions.classList.toggle('hidden', selectedNames.size === 0);

  container.innerHTML = filtered.map(name => {
    const checked = selectedNames.has(name) ? 'checked' : '';
    return '<label class="search-name-item">' +
      '<input type="checkbox" class="search-name-checkbox" data-name="' + escapeHtml(name) + '" ' + checked + '>' +
      '<span class="search-name-label">' + escapeHtml(name) + '</span>' +
      '<button class="search-csv-btn" data-name="' + escapeHtml(name) + '">CSV</button>' +
      '</label>';
  }).join('');
}

function downloadCSV(name) {
  const entries = allData.filter(d => d.name === name)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  if (entries.length === 0) return;
  const headers = 'Timestamp,Name,Weight (kg),Color\n';
  const rows = entries.map(e => e.timestamp + ',' + e.name + ',' + e.weight + ',' + e.color).join('\n');
  const blob = new Blob([headers + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name.replace(/\s+/g, '_') + '_weight_data.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function setupForm() {
  document.getElementById('entry-form').addEventListener('submit', e => {
    e.preventDefault();
    submitEntry();
  });
}

function setupUnitToggle() {
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentUnit = btn.dataset.unit;
      document.getElementById('weight').placeholder = currentUnit;
      renderAll();
    });
  });
}

function submitEntry() {
  const name = document.getElementById('name').value.trim();
  const weightInput = parseFloat(document.getElementById('weight').value);
  const color = document.getElementById('color').value;

  if (!name) { showError('Please enter a name'); return; }
  if (isNaN(weightInput) || weightInput <= 0) { showError('Please enter a valid weight'); return; }

  const weightKg = currentUnit === 'lbs' ? +(weightInput / 2.205).toFixed(1) : weightInput;

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = 'Adding...';

  const entry = {
    id: crypto.randomUUID(),
    timestamp: getISTTimestamp(),
    name,
    weight: weightKg,
    color
  };
  allData.push(entry);

  saveBin()
    .then(() => {
      document.getElementById('name').value = '';
      document.getElementById('weight').value = '';
      hideError();
      renderAll();
    })
    .catch(() => {
      allData.pop();
      showError('Failed to add entry');
    })
    .finally(() => {
      btn.disabled = false;
      btn.textContent = 'Add Entry';
    });
}

function deleteEntry(id) {
  if (!confirm('Delete this entry?')) return;

  const idx = allData.findIndex(d => d.id === id);
  if (idx === -1) return;
  const removed = allData.splice(idx, 1)[0];

  saveBin()
    .then(() => renderAll())
    .catch(() => {
      allData.splice(idx, 0, removed);
      showError('Failed to delete');
    });
}

function updateEntry(id, name, weightKg, color) {
  const entry = allData.find(d => d.id === id);
  if (!entry) return;

  const old = { ...entry };
  Object.assign(entry, { name, weight: weightKg, color });

  saveBin()
    .then(() => renderAll())
    .catch(() => {
      Object.assign(entry, old);
      showError('Failed to update');
    });
}

function renderLeaderboard(data, unit) {
  const emptyEl = document.getElementById('leaderboard-empty');
  const contentEl = document.getElementById('leaderboard-content');

  const byName = {};
  data.forEach(d => {
    if (!byName[d.name]) byName[d.name] = [];
    byName[d.name].push(d);
  });

  const rankings = Object.entries(byName)
    .map(([name, entries]) => {
      entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      const first = entries[0].weight;
      const last = entries[entries.length - 1].weight;
      const loss = unit === 'lbs' ? +((first - last) * 2.205).toFixed(1) : +(first - last).toFixed(1);
      const latest = unit === 'lbs' ? +(last * 2.205).toFixed(1) : last;
      return { name, loss, latest, color: entries[entries.length - 1].color };
    })
    .sort((a, b) => b.loss - a.loss);

  if (rankings.length === 0) {
    emptyEl.classList.remove('hidden');
    contentEl.classList.add('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
  contentEl.classList.remove('hidden');

  const places = ['1st', '2nd', '3rd'];
  const posClasses = ['gold', 'silver', 'bronze'];
  const top = rankings.slice(0, 3);

  const gap = rankings.length > 1 ? (rankings[0].loss - rankings[1].loss).toFixed(1) : 0;

  let html = `<div class="leaderboard-winner">${escapeHtml(rankings[0].name)} &mdash; ${rankings[0].loss} ${unit} lost</div>`;

  if (gap > 0) {
    html += `<div class="leaderboard-row"><span class="stat positive">${gap} ${unit} ahead of ${escapeHtml(rankings[1].name)}</span></div>`;
  }

  if (top.length > 1) {
    html += top.slice(1).map((r, i) =>
      `<div class="leaderboard-row">
        <span class="pos ${posClasses[i]}">${places[i + 1]}</span>
        <span class="name" style="color:${r.color}">${escapeHtml(r.name)}</span>
        <span class="stat ${r.loss >= 0 ? 'positive' : 'negative'}">${r.loss >= 0 ? '−' : '+'}${Math.abs(r.loss)} ${unit}</span>
      </div>`
    ).join('');
  }

  contentEl.innerHTML = html;
}

function renderChart(data, unit) {
  const canvas = document.getElementById('weight-chart');
  const emptyEl = document.getElementById('chart-empty');

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  if (data.length === 0) {
    canvas.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    return;
  }

  canvas.classList.remove('hidden');
  emptyEl.classList.add('hidden');

  const unitLabel = unit;

  const byName = {};
  data.forEach(d => {
    if (!byName[d.name]) byName[d.name] = [];
    byName[d.name].push(d);
  });

  const allDates = [...new Set(data.map(d => d.timestamp.split(' ')[0]))].sort();

  const datasets = Object.entries(byName).map(([name, entries]) => {
    entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    const color = entries[entries.length - 1].color;

    const dateMap = {};
    entries.forEach(e => {
      const date = e.timestamp.split(' ')[0];
      dateMap[date] = unit === 'lbs' ? +(e.weight * 2.205).toFixed(1) : e.weight;
    });

    return {
      label: name,
      data: allDates.map(d => dateMap[d] !== undefined ? dateMap[d] : null),
      borderColor: color,
      _color: color,
      backgroundColor: ctx => {
        const c = ctx.dataset._color;
        if (!ctx.chart.chartArea) return c + '40';
        const g = ctx.chart.ctx.createLinearGradient(0, ctx.chart.chartArea.top, 0, ctx.chart.chartArea.bottom);
        g.addColorStop(0, c + '80');
        g.addColorStop(1, c + '02');
        return g;
      },
      pointBackgroundColor: color,
      pointBorderColor: color,
      pointRadius: 5,
      pointHoverRadius: 7,
      spanGaps: true,
      tension: 0.15,
      fill: true
    };
  });

  datasets.sort((a, b) => {
    const aLast = [...a.data].reverse().find(v => v !== null) ?? Infinity;
    const bLast = [...b.data].reverse().find(v => v !== null) ?? Infinity;
    return aLast - bLast;
  });

  chartInstance = new Chart(canvas, {
    type: 'line',
    data: { labels: allDates, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          labels: { usePointStyle: true, padding: 16, font: { size: 12 } }
        },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y} ${unitLabel}`
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Date', font: { size: 11 } },
          ticks: { font: { size: 11 } },
          grid: { display: false }
        },
        y: {
          title: { display: true, text: `Weight (${unitLabel})`, font: { size: 11 } },
          beginAtZero: false,
          ticks: { font: { size: 11 } }
        }
      }
    }
  });
}

function renderLossChart(data, unit) {
  const canvas = document.getElementById('loss-chart');
  const emptyEl = document.getElementById('loss-empty');

  if (lossChartInstance) {
    lossChartInstance.destroy();
    lossChartInstance = null;
  }

  const byName = {};
  data.forEach(d => {
    if (!byName[d.name]) byName[d.name] = [];
    byName[d.name].push(d);
  });

  const namesWithLoss = Object.entries(byName).filter(([, entries]) => entries.length >= 2);

  if (data.length === 0 || namesWithLoss.length === 0) {
    canvas.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    return;
  }

  canvas.classList.remove('hidden');
  emptyEl.classList.add('hidden');

  const allDates = [...new Set(data.map(d => d.timestamp.split(' ')[0]))].sort();
  const unitLabel = unit;

  const datasets = namesWithLoss.map(([name, entries]) => {
    entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const firstWeight = entries[0].weight;
    const color = entries[entries.length - 1].color;

    const dateMap = {};
    entries.forEach(e => {
      const date = e.timestamp.split(' ')[0];
      const loss = unit === 'lbs'
        ? +((firstWeight - e.weight) * 2.205).toFixed(1)
        : +(firstWeight - e.weight).toFixed(1);
      dateMap[date] = loss;
    });

    return {
      label: name,
      data: allDates.map(d => dateMap[d] !== undefined ? dateMap[d] : null),
      borderColor: color,
      _color: color,
      backgroundColor: ctx => {
        const c = ctx.dataset._color;
        if (!ctx.chart.chartArea) return c + '40';
        const g = ctx.chart.ctx.createLinearGradient(0, ctx.chart.chartArea.top, 0, ctx.chart.chartArea.bottom);
        g.addColorStop(0, c + '80');
        g.addColorStop(1, c + '02');
        return g;
      },
      pointBackgroundColor: color,
      pointBorderColor: color,
      pointRadius: 4,
      pointHoverRadius: 6,
      spanGaps: true,
      tension: 0.15,
      fill: true
    };
  });

  datasets.sort((a, b) => {
    const aLast = [...a.data].reverse().find(v => v !== null) ?? Infinity;
    const bLast = [...b.data].reverse().find(v => v !== null) ?? Infinity;
    return aLast - bLast;
  });

  lossChartInstance = new Chart(canvas, {
    type: 'line',
    data: { labels: allDates, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          labels: { usePointStyle: true, padding: 16, font: { size: 12 } }
        },
        tooltip: {
          callbacks: {
            label: ctx => {
              const val = ctx.parsed.y;
              const dir = val >= 0 ? 'lost' : 'gained';
              return `${ctx.dataset.label}: ${Math.abs(val)} ${unitLabel} ${dir}`;
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Date', font: { size: 11 } },
          ticks: { font: { size: 11 } },
          grid: { display: false }
        },
        y: {
          title: { display: true, text: `Weight Lost (${unitLabel})`, font: { size: 11 } },
          ticks: { font: { size: 11 } }
        }
      }
    }
  });
}

function renderHeatmap(data) {
  const el = document.getElementById('heatmap');

  const fmt = d => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  if (data.length === 0) {
    el.innerHTML = '';
    return;
  }

  const byDate = {};
  data.forEach(d => {
    const ds = d.timestamp.split(' ')[0];
    if (!byDate[ds]) byDate[ds] = [];
    byDate[ds].push(d);
  });

  const sorted = [...data].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const personEntries = {};
  sorted.forEach(d => {
    if (!personEntries[d.name]) personEntries[d.name] = [];
    personEntries[d.name].push(d);
  });

  const [y0, m0, d0] = sorted[0].timestamp.split(' ')[0].split('-').map(Number);
  const start = new Date(y0, m0 - 1, d0);
  start.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const dayColor = {};
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const ds = fmt(d);
    const entries = byDate[ds] || [];
    if (entries.length === 0) { dayColor[ds] = 'empty'; continue; }
    let gains = 0, losses = 0;
    entries.forEach(e => {
      const list = personEntries[e.name] || [];
      const idx = list.findIndex(x => x.id === e.id);
      if (idx > 0) {
        if (e.weight < list[idx - 1].weight) losses++;
        else if (e.weight > list[idx - 1].weight) gains++;
      }
    });
    dayColor[ds] = losses > gains ? 'loss' : gains > losses ? 'gain' : 'empty';
  }

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const showDays = ['','Mon','','Wed','','Fri',''];

  const gridStart = new Date(start);
  gridStart.setDate(gridStart.getDate() - start.getDay());
  const weeks = Math.ceil((+today - +gridStart + 1) / (7 * 86400000));

  const parts = [];
  const placed = {};

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col <= weeks; col++) {
      if (row === 0 && col === 0) {
        parts.push('<div class="heatmap-spacer"></div>');
      } else if (row === 0) {
        const d = new Date(gridStart);
        d.setDate(d.getDate() + (col - 1) * 7 + 3);
        const key = d.getFullYear() + '-' + d.getMonth();
        if (!placed[key]) {
          placed[key] = true;
          parts.push('<div class="heatmap-label">' + months[d.getMonth()] + '</div>');
        } else {
          parts.push('<div class="heatmap-spacer"></div>');
        }
      } else if (col === 0) {
        const label = showDays[row - 1];
        parts.push('<div class="heatmap-label">' + label + '</div>');
      } else {
        const offset = (col - 1) * 7 + (row - 1);
        const d = new Date(gridStart);
        d.setDate(d.getDate() + offset);
        const ds = fmt(d);
        if (d < start || d > today) {
          parts.push('<div class="heatmap-cell outside"></div>');
        } else {
          const cls = dayColor[ds] || 'empty';
          parts.push('<div class="heatmap-cell ' + cls + '" title="' + ds + '"></div>');
        }
      }
    }
  }

  el.innerHTML = '<div class="heatmap-grid" style="grid-template-columns:28px repeat(' + weeks + ',10px)">' + parts.join('') + '</div>';
}

function setupTableDelegation() {
  document.getElementById('table-body').addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const row = btn.closest('tr');
    const id = row ? row.id.replace('row-', '') : null;
    if (!id) return;

    if (btn.classList.contains('btn-edit')) enterEditMode(id, currentUnit);
    else if (btn.classList.contains('btn-delete')) deleteEntry(id);
    else if (btn.classList.contains('btn-save')) saveEdit(id, currentUnit);
    else if (btn.classList.contains('btn-cancel')) fetchAndRender();
  });
}

function renderTable(data, unit) {
  const tbody = document.getElementById('table-body');
  const emptyEl = document.getElementById('table-empty');

  if (data.length === 0) {
    tbody.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');

  const sorted = [...data].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  tbody.innerHTML = sorted.map(d => buildRowHtml(d, unit)).join('');
}

function buildRowHtml(d, unit) {
  const displayWeight = unit === 'lbs' ? +(d.weight * 2.205).toFixed(1) : d.weight;
  return `
    <tr id="row-${d.id}">
      <td>${escapeHtml(d.timestamp)}</td>
      <td>${escapeHtml(d.name)}</td>
      <td>${displayWeight} ${unit}</td>
      <td><span class="color-swatch" style="background:${d.color}"></span></td>
      <td>
        <div class="action-btns">
          <button class="btn btn-edit">Edit</button>
          <button class="btn btn-delete">Delete</button>
        </div>
      </td>
    </tr>
  `;
}

function enterEditMode(id, unit) {
  const row = document.getElementById(`row-${id}`);
  if (!row) return;

  const entry = allData.find(d => d.id === id);
  if (!entry) return;

  const displayWeight = unit === 'lbs' ? +(entry.weight * 2.205).toFixed(1) : entry.weight;

  row.innerHTML = `
    <td>${escapeHtml(entry.timestamp)}</td>
    <td><input type="text" class="edit-name" value="${escapeHtml(entry.name)}"></td>
    <td><input type="number" step="0.001" class="edit-weight" value="${displayWeight}"></td>
    <td><input type="color" class="edit-color" value="${entry.color}"></td>
    <td>
      <div class="action-btns">
        <button class="btn btn-save">Save</button>
        <button class="btn btn-cancel">Cancel</button>
      </div>
    </td>
  `;
}

function saveEdit(id, unit) {
  const row = document.getElementById(`row-${id}`);
  if (!row) return;

  const newName = row.querySelector('.edit-name').value.trim();
  const newWeight = parseFloat(row.querySelector('.edit-weight').value);
  const newColor = row.querySelector('.edit-color').value;

  if (!newName) { showError('Name cannot be empty'); return; }
  if (isNaN(newWeight) || newWeight <= 0) { showError('Invalid weight'); return; }

  const weightKg = unit === 'lbs' ? +(newWeight / 2.205).toFixed(1) : newWeight;

  const original = allData.find(d => d.id === id);
  if (!original) return;

  if (newName === original.name && weightKg === original.weight && newColor === original.color) {
    renderAll();
    return;
  }

  updateEntry(id, newName, weightKg, newColor);
}

function getISTTimestamp() {
  const now = new Date();
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  });
  const p = f.formatToParts(now);
  const g = t => p.find(x => x.type === t).value;
  return `${g('year')}-${g('month')}-${g('day')} ${g('hour')}:${g('minute')}:${g('second')}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showLoading(show) {
  const el = document.getElementById('loading');
  el.classList.toggle('hidden', !show);
}

function showError(msg) {
  const el = document.getElementById('error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideError() {
  document.getElementById('error').classList.add('hidden');
}
