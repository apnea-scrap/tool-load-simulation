(function (globalScope, factory) {
  const core = factory();
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = core;
  } else {
    globalScope.finBendingCore = core;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEFAULT_SEGMENTS = 200;
  const MIN_EXTRA_LAYER_LENGTH = 50;

  function clampExtraLayers(layersFoot, layersTip) {
    const diff = Number(layersFoot) - Number(layersTip);
    return isFinite(diff) ? Math.max(0, diff) : 0;
  }

  function effectiveThicknessAt(x, params) {
    const baseLayers = Number(params.layersTip) || 0;
    const extraLayers = clampExtraLayers(params.layersFoot, params.layersTip);
    var layersHere = baseLayers;

    if (extraLayers > 0) {
      for (var i = 1; i <= extraLayers; i += 1) {
        const fraction = i / extraLayers;
        const cutoff = Math.max(MIN_EXTRA_LAYER_LENGTH, params.L * (1 - fraction * 0.8));
        if (x <= cutoff) layersHere += 1;
      }
    }

    return layersHere * params.thickness;
  }

  function computeCurvature(P, x, params) {
    const hi = effectiveThicknessAt(x, params);
    const Ii = params.b * Math.pow(hi, 3) / 12.0;
    const modulus = params.E * 1000;
    return (P * (params.L - x)) / (modulus * Ii);
  }

  function getSegmentCount(options) {
    const opts = options || {};
    const count = typeof opts.segments === 'number' ? opts.segments : DEFAULT_SEGMENTS;
    return count > 2 ? count : DEFAULT_SEGMENTS;
  }

  function computeTipAngle(P, params, options) {
    const segments = getSegmentCount(options);
    const dx = params.L / (segments - 1);
    var theta = 0;

    for (var i = 0; i < segments; i += 1) {
      const xi = i * dx;
      const kappa = computeCurvature(P, xi, params);
      if (i > 0) theta += kappa * dx;
    }

    return theta * 180 / Math.PI;
  }

  function computeBendingProfile(P, params, options) {
    const segments = getSegmentCount(options);
    const dx = params.L / (segments - 1);
    const x = new Array(segments);
    const kappa = new Array(segments);
    const theta = new Array(segments);
    const X = new Array(segments);
    const Y = new Array(segments);

    theta[0] = 0;
    X[0] = 0;
    Y[0] = 0;

    for (var i = 0; i < segments; i += 1) {
      const xi = i * dx;
      x[i] = xi;
      kappa[i] = computeCurvature(P, xi, params);
    }

    for (var j = 1; j < segments; j += 1) {
      theta[j] = theta[j - 1] + kappa[j] * dx;
      X[j] = X[j - 1] + dx * Math.cos(theta[j]);
      Y[j] = Y[j - 1] + dx * Math.sin(theta[j]);
    }

    var maxCurvatureIndex = 0;
    for (var k = 1; k < kappa.length; k += 1) {
      if (kappa[k] > kappa[maxCurvatureIndex]) maxCurvatureIndex = k;
    }

    const tipAngleRad = theta[segments - 1] || 0;
    const tipAngleDeg = tipAngleRad * 180 / Math.PI;
    const tipDeflection = Y[segments - 1] || 0;

    return {
      x: x,
      kappa: kappa,
      theta: theta,
      X: X,
      Y: Y,
      tipAngleRad: tipAngleRad,
      tipAngleDeg: tipAngleDeg,
      tipDeflection: tipDeflection,
      maxCurvatureIndex: maxCurvatureIndex,
    };
  }

  function computeLaminateStack(params) {
    const layersTip = Number(params.layersTip) || 0;
    const layersFoot = Number(params.layersFoot) || 0;
    const L = Number(params.L) || 0;
    const b = Number(params.b) || 0;
    const thickness = Number(params.thickness) || 0;
    const extraLayersCount = clampExtraLayers(layersFoot, layersTip);

    const baseLayers = new Array(layersTip);
    for (var i = 0; i < layersTip; i += 1) {
      baseLayers[i] = {
        index: i + 1,
        length: L,
        coverageRatio: L > 0 ? 1 : 0,
        type: 'tip',
      };
    }

    const extraLayers = new Array(extraLayersCount);
    for (var j = 1; j <= extraLayersCount; j += 1) {
      const fraction = j / extraLayersCount;
      const layerLength = Math.max(MIN_EXTRA_LAYER_LENGTH, L * (1 - fraction * 0.8));
      extraLayers[j - 1] = {
        index: j,
        length: layerLength,
        coverageRatio: L > 0 ? layerLength / L : 0,
        type: 'foot-extra',
      };
    }

    return {
      layersTip: layersTip,
      layersFoot: layersFoot,
      length: L,
      width: b,
      thickness: thickness,
      baseLayers: baseLayers,
      extraLayers: extraLayers,
    };
  }

  function solveForLoad(params, options) {
    const opts = options || {};
    const targetAngle = typeof opts.targetAngle === 'number' ? opts.targetAngle : 90;
    const tolerance = typeof opts.tolerance === 'number' ? opts.tolerance : 0.1;
    const maxIterations = typeof opts.maxIterations === 'number' ? opts.maxIterations : 40;
    const segments = opts.segments;

    var lower = 0;
    var upper = typeof opts.initialUpperBound === 'number' ? opts.initialUpperBound : 100;
    var angleAtUpper = computeTipAngle(upper, params, { segments: segments });
    var expandGuard = 0;

    while (angleAtUpper < targetAngle && expandGuard < maxIterations) {
      lower = upper;
      upper *= 2;
      angleAtUpper = computeTipAngle(upper, params, { segments: segments });
      expandGuard += 1;
    }

    if (angleAtUpper < targetAngle) return upper;

    var load = upper;
    for (var i = 0; i < maxIterations; i += 1) {
      var mid = (lower + upper) / 2;
      const angle = computeTipAngle(mid, params, { segments: segments });
      load = mid;

      if (Math.abs(angle - targetAngle) <= tolerance) break;

      if (angle < targetAngle) {
        lower = mid;
      } else {
        upper = mid;
      }
    }

    return load;
  }

  function computeDefaultParams() {
    return {
      layersFoot: 4,
      layersTip: 2,
      L: 250,
      b: 180,
      E: 32,
      thickness: 0.35,
    };
  }

  return {
    effectiveThicknessAt: effectiveThicknessAt,
    computeTipAngle: computeTipAngle,
    computeBendingProfile: computeBendingProfile,
    solveForLoad: solveForLoad,
    computeLaminateStack: computeLaminateStack,
    computeDefaultParams: computeDefaultParams,
  };
});
