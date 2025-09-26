const core = require('../docs/fin-bending-core.js');
const { approve, renderBendingProfileSvg, renderLaminateStackSvg } = require('./approval-helper');

function round(value, digits) {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

function ensureObject(value) {
  if (typeof value === 'function') return value();
  return value;
}

function cloneParams(params) {
  return JSON.parse(JSON.stringify(params));
}

const scenarios = [
  {
    id: 'default-params',
    params: () => core.computeDefaultParams(),
    description: 'Baseline parameters used by the UI when the calculator loads.',
  },
  {
    id: 'cantilever-compare',
    params: () => ({
      layersFoot: 3,
      layersTip: 3,
      L: 250,
      b: 180,
      E: 32,
      thickness: 0.33,
    }),
    description: 'Baseline parameters used by the UI when the calculator loads.'
,
  },
];

describe('fin bending core approvals', () => {
  scenarios.forEach((scenario) => {
    const testName = scenario.description
      ? `${scenario.id} – ${scenario.description}`
      : scenario.id;

    test(testName, () => {
      const paramsSource = ensureObject(scenario.params);
      const params = cloneParams(paramsSource);
      const load = core.solveForLoad(params);
      const profile = core.computeBendingProfile(load, params);
      const laminate = core.computeLaminateStack(params);

      const shape = core.createBendingProfilePoints(profile);
      const highlightPoint = Array.isArray(shape) ? shape[profile.maxCurvatureIndex] : null;
      const laminateHighlight = Array.isArray(profile.x) ? profile.x[profile.maxCurvatureIndex] : null;

      const paramsForPayload = cloneParams(params);

      const approvalPayload = {
        params: paramsForPayload,
        load: round(load, 9),
        tipAngleDeg: round(profile.tipAngleDeg, 9),
        tipDeflection: round(profile.tipDeflection, 9),
      };

      let approvalError;
      try {
        approve(`${scenario.id}.payload`, approvalPayload);
      } catch (error) {
        approvalError = error;
      }

      const svgVariant = approvalError ? 'received' : 'approved';

      let renderError;
      try {
        renderBendingProfileSvg(
          `${scenario.id}.profile`,
          shape,
          {
            load: round(load, 1),
            tipAngleDeg: round(profile.tipAngleDeg, 1),
            description: scenario.description || scenario.id,
            highlight: highlightPoint ? { x: highlightPoint.x, y: highlightPoint.y } : null,
          },
          svgVariant
        );
        renderLaminateStackSvg(
          `${scenario.id}.laminate`,
          Object.assign({}, laminate, {
            highlightX: laminateHighlight,
          }),
          svgVariant
        );
      } catch (error) {
        renderError = error;
      }

      if (approvalError) throw approvalError;
      if (renderError) throw renderError;
    });
  });
});
