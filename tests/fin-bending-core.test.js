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
