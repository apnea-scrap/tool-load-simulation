const core = require('../docs/fin-bending-core.js');

function createParams() {
  return {
    layersFoot: 4,
    layersTip: 2,
    L: 250,
    b: 180,
    E: 32,
    thickness: 0.35,
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

test('computeSectionInertia reports higher inertia at the foot when layers are thicker', () => {
  const params = createParams();
  const inertia = core.computeSectionInertia(params);

  expect(inertia.foot).toBeGreaterThan(inertia.tip);
  expect(inertia.tip).toBeGreaterThan(0);
});
