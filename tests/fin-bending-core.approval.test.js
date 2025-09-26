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

      const laminateSummary = {
        layersTip: laminate.layersTip,
        layersFoot: laminate.layersFoot,
        length: round(laminate.length, 2),
        width: round(laminate.width, 2),
        thickness: round(laminate.thickness, 4),
        baseLayers: (laminate.baseLayers || []).map((layer) => ({
          index: layer.index,
          length: round(layer.length, 2),
          coverageRatio: round(layer.coverageRatio, 4),
        })),
        extraLayers: (laminate.extraLayers || []).map((layer) => ({
          index: layer.index,
          length: round(layer.length, 2),
          coverageRatio: round(layer.coverageRatio, 4),
        })),
      };

      const approvalPayload = {
        scenario: {
          id: scenario.id,
          description: scenario.description || null,
        },
        params,
        load: round(load, 9),
        tipAngleDeg: round(profile.tipAngleDeg, 9),
        tipDeflection: round(profile.tipDeflection, 9),
        points: shape,
        laminate: laminateSummary,
      };

      approve(scenario.id, approvalPayload);
      renderBendingProfileSvg(scenario.id, approvalPayload);
      renderLaminateStackSvg(`${scenario.id}-laminate`, {
        layersTip: laminateSummary.layersTip,
        layersFoot: laminateSummary.layersFoot,
        length: laminate.length,
        width: laminate.width,
        baseLayers: laminate.baseLayers,
        extraLayers: laminate.extraLayers,
      });
    });
  });
});
