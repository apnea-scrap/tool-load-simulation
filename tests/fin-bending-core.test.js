const core = require('../docs/fin-bending-core.js');

function createParams() {
  return {
    layersFoot: 4,
    layersTip: 2,
    L: 250,
    b: 180,
    E: 32,
    thickness: 0.35,
    minExtraLayerLength: 50,
  };
}

test('tip angle increases with load', () => {
  const params = createParams();
  const low = core.computeTipAngle(10, params);
  const high = core.computeTipAngle(50, params);
  expect(high).toBeGreaterThan(low);
});

test('solveForLoad approximates 90 degree tip angle', () => {
  const params = createParams();
  const load = core.solveForLoad(params);
  const angle = core.computeTipAngle(load, params);
  expect(angle).toBeGreaterThanOrEqual(89);
  expect(angle).toBeLessThanOrEqual(91);
});

test('bending profile arrays share the same length', () => {
  const params = createParams();
  const load = 40;
  const profile = core.computeBendingProfile(load, params);
  expect(profile.x.length).toBe(profile.kappa.length);
  expect(profile.theta.length).toBe(profile.X.length);
  expect(profile.X.length).toBe(profile.Y.length);
});

test('createBendingProfileSvg produces accessible markup', () => {
  const params = createParams();
  const load = 40;
  const profile = core.computeBendingProfile(load, params, { segments: 20 });
  const points = core.createBendingProfilePoints(profile);
  const highlight = points[profile.maxCurvatureIndex];
  const svg = core.createBendingProfileSvg(points, {
    load: Number(load.toFixed(2)),
    tipAngleDeg: Number(profile.tipAngleDeg.toFixed(2)),
    highlight: highlight ? { x: highlight.x, y: highlight.y } : null,
  });

  expect(typeof svg).toBe('string');
  expect(svg).toContain('<svg');
  expect(svg).toContain('role="img"');
  expect(svg).toContain('Fin bending profile');
  expect(svg).toContain('<polygon');
});

test('createLaminateStackSvg reflects layer counts', () => {
  const params = createParams();
  const laminate = core.computeLaminateStack(params);
  const svg = core.createLaminateStackSvg(laminate, { highlightX: laminate.length / 2 });

  expect(typeof svg).toBe('string');
  expect(svg).toContain('Laminate stack');
  expect(svg).toContain('Foot');
  expect(svg).toContain('Tip');
  expect(svg).toContain('<line');
});

test('minExtraLayerLength clamps short extra layers', () => {
  const params = createParams();
  params.minExtraLayerLength = 120;
  params.L = 150;

  const laminate = core.computeLaminateStack(params);
  expect(Array.isArray(laminate.extraLayers)).toBe(true);
  laminate.extraLayers.forEach((layer) => {
    expect(layer.length).toBeGreaterThanOrEqual(params.minExtraLayerLength);
  });
});

test('extra layers are spaced evenly between minimum coverage and tip', () => {
  const params = createParams();
  params.minExtraLayerLength = 100;
  params.L = 300;

  const laminate = core.computeLaminateStack(params);
  const lengths = laminate.extraLayers.map((layer) => layer.length);

  expect(lengths).toEqual([200, 300]);
});

test('effectiveThicknessAt reflects evenly spaced extra layers', () => {
  const params = createParams();
  params.minExtraLayerLength = 100;
  params.L = 300;
  params.thickness = 1;

  expect(core.effectiveThicknessAt(100, params)).toBeCloseTo(4, 5);
  expect(core.effectiveThicknessAt(200, params)).toBeCloseTo(3, 5);
  expect(core.effectiveThicknessAt(300, params)).toBeCloseTo(2, 5);
  expect(core.effectiveThicknessAt(350, params)).toBeCloseTo(2, 5);
});

test('computeSectionInertia reports higher inertia at the foot when layers are thicker', () => {
  const params = createParams();
  const inertia = core.computeSectionInertia(params);

  expect(inertia.foot).toBeGreaterThan(inertia.tip);
  expect(inertia.tip).toBeGreaterThan(0);
});

test('hydrodynamic resistance matches area ratio for an unflexed blade', () => {
  const params = createParams();
  const resistance = core.computeHydrodynamicResistance(0, params);
  const areaMeters = (params.b * params.L) / (1000 * 1000);
  const expectedAreaRatio = areaMeters / 0.015;

  expect(resistance).toBeGreaterThan(0);
  expect(resistance).toBeCloseTo(expectedAreaRatio, 1);
});

test('hydrodynamic resistance decreases as load increases', () => {
  const params = createParams();
  const relaxed = core.computeHydrodynamicResistance(0, params);
  const loaded = core.computeHydrodynamicResistance(80, params);

  expect(loaded).toBeLessThan(relaxed);
  expect(loaded).toBeGreaterThanOrEqual(0);
});

test('segments bent beyond 90 degrees contribute no resistance', () => {
  const params = createParams();
  const profile = {
    theta: [0, Math.PI, Math.PI * 1.1],
    x: [0, 100, 200],
  };
  const resistance = core.computeHydrodynamicResistance(100, params, { profile: profile });

  expect(resistance).toBe(0);
});
