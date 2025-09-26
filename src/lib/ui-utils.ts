// UI utility functions to prevent errors

// Status seguro (corrige "statusDisplay is not defined")
export function updateStatus(msg: string) {
  const el = document.getElementById("statusDisplay");
  if (el) el.textContent = msg; // se não existir, ignora (no-op)
}

// SVG seguro (corrige x2/y2 undefined)
export function safeLine(x1?: number, y1?: number, x2?: number, y2?: number) {
  // Garante que todos os valores sejam números válidos
  const sx1 = Number.isFinite(x1) ? x1 : 0;
  const sy1 = Number.isFinite(y1) ? y1 : 0;
  const sx2 = Number.isFinite(x2) ? x2 : 0;
  const sy2 = Number.isFinite(y2) ? y2 : 0;
  return `<line x1="${sx1}" y1="${sy1}" x2="${sx2}" y2="${sy2}" />`;
}

// Safe chart data filtering
export function safeChartData(data: any[]) {
  return data.filter(item => {
    // Ensure all numeric values are finite
    for (const key in item) {
      const value = item[key];
      if (typeof value === 'number' && !Number.isFinite(value)) {
        return false;
      }
    }
    return true;
  });
}

// Safe number formatting
export function safeNumber(value: any, fallback: number = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}