/** A tidy axis: 0 (or a rounded minimum) up to a rounded maximum, with 5 even ticks. */
export function niceAxis(values: (number | null)[], opts: { fromZero?: boolean } = {}) {
  const vs = values.filter((v): v is number => v !== null);
  if (!vs.length) return { domain: [0, 1] as [number, number], ticks: [0, 0.25, 0.5, 0.75, 1] };
  let lo = opts.fromZero === false ? Math.min(...vs) : Math.min(0, ...vs);
  let hi = Math.max(...vs);
  if (hi === lo) hi = lo + 1;
  const raw = (hi - lo) / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let t = lo; t <= hi + step / 2; t += step) ticks.push(+t.toFixed(10));
  return { domain: [lo, hi] as [number, number], ticks };
}
