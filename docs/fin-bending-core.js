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
  const DEFAULT_MARGIN = 20;
  const TRAINING_FIN_AREA = 0.015; // 0.15 m x 0.10 m benchmark area
  const DRAG_COEFFICIENT_MAX = 1.28;
  const RIGHT_ANGLE_RAD = Math.PI / 2;

  function clampExtraLayers(layersFoot, layersTip) {
    const diff = Number(layersFoot) - Number(layersTip);
    return isFinite(diff) ? Math.max(0, diff) : 0;
  }

  function roundNumber(value, digits) {
    if (typeof value !== 'number' || !isFinite(value)) return value;
    const factor = Math.pow(10, digits);
    return Math.round(value * factor) / factor;
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

  function computeSectionInertia(params) {
    if (!params) {
      return { foot: 0, tip: 0 };
    }

    const width = Number(params.b);
    const length = Number(params.L);

    function inertiaAt(x) {
      const thicknessHere = effectiveThicknessAt(x, params);
      if (!isFinite(width) || width <= 0) return 0;
      if (typeof thicknessHere !== 'number' || !isFinite(thicknessHere) || thicknessHere <= 0) return 0;
      return width * Math.pow(thicknessHere, 3) / 12.0;
    }

    const tipPosition = isFinite(length) && length > 0 ? length : 0;

    return {
      foot: inertiaAt(0),
      tip: inertiaAt(tipPosition),
    };
  }

  function createBendingProfilePoints(profile, options) {
    if (!profile || !Array.isArray(profile.X) || !Array.isArray(profile.Y)) return [];

    const opts = options || {};
    const arcDigits = typeof opts.arcDigits === 'number' ? opts.arcDigits : 2;
    const xDigits = typeof opts.xDigits === 'number' ? opts.xDigits : 4;
    const yDigits = typeof opts.yDigits === 'number' ? opts.yDigits : 4;
    const length = Math.min(profile.X.length, profile.Y.length);
    const points = new Array(length);

    for (var i = 0; i < length; i += 1) {
      const arcValue = Array.isArray(profile.x) ? profile.x[i] : null;
      points[i] = {
        arcPosition: roundNumber(arcValue, arcDigits),
        x: roundNumber(profile.X[i], xDigits),
        y: roundNumber(profile.Y[i], yDigits),
      };
    }

    return points;
  }

  function interpolateDragCoefficient(angleRad) {
    if (typeof angleRad !== 'number' || !isFinite(angleRad) || angleRad < 0) return 0;
    const clamped = Math.min(angleRad, RIGHT_ANGLE_RAD);
    return DRAG_COEFFICIENT_MAX * (1 - clamped / RIGHT_ANGLE_RAD);
  }

  function computeHydrodynamicResistance(load, params, options) {
    if (!params) return 0;
    const widthMm = Number(params.b);
    const lengthMm = Number(params.L);
    if (!isFinite(widthMm) || !isFinite(lengthMm) || widthMm <= 0 || lengthMm <= 0) return 0;

    const opts = options || {};
    var profile = opts.profile;
    if (!profile) {
      const computeOptions = typeof opts.segments === 'number' ? { segments: opts.segments } : undefined;
      profile = computeBendingProfile(load, params, computeOptions);
    }

    if (!profile || !Array.isArray(profile.theta)) return 0;

    const theta = profile.theta;
    const xValues = Array.isArray(profile.x) ? profile.x : null;
    if (theta.length < 2) return 0;

    const widthMeters = widthMm / 1000;
    var totalForceComponent = 0;

    for (var i = 1; i < theta.length; i += 1) {
      var angle = theta[i];
      if (typeof angle !== 'number' || !isFinite(angle)) continue;
      if (Math.abs(angle) >= RIGHT_ANGLE_RAD) continue;
      var segmentLengthMm;
      if (xValues) {
        var prevX = xValues[i - 1];
        var nextX = xValues[i];
        if (!isFinite(prevX) || !isFinite(nextX)) continue;
        segmentLengthMm = nextX - prevX;
      } else {
        segmentLengthMm = lengthMm / (theta.length - 1);
      }
      if (!isFinite(segmentLengthMm) || segmentLengthMm <= 0) continue;
      var segmentLengthMeters = segmentLengthMm / 1000;
      var projectedArea = widthMeters * segmentLengthMeters;
      if (!isFinite(projectedArea) || projectedArea <= 0) continue;
      var clampedAngle = Math.min(Math.max(Math.abs(angle), 0), RIGHT_ANGLE_RAD);
      var angleToFlow = RIGHT_ANGLE_RAD - clampedAngle;
      if (angleToFlow <= 0) continue;
      var sinTheta = Math.sin(angleToFlow);
      if (sinTheta <= 0) continue;
      var cd = interpolateDragCoefficient(clampedAngle);
      totalForceComponent += cd * sinTheta * projectedArea;
    }

    if (!isFinite(totalForceComponent) || totalForceComponent <= 0) return 0;

    const benchmarkForceComponent = DRAG_COEFFICIENT_MAX * TRAINING_FIN_AREA;
    if (!isFinite(benchmarkForceComponent) || benchmarkForceComponent <= 0) return 0;

    return totalForceComponent / benchmarkForceComponent;
  }

  function describeProfile(options) {
    if (options && typeof options.description === 'string') return options.description;

    var parts = [];
    if (options && (options.load !== undefined || options.tipAngleDeg !== undefined)) {
      if (options.load !== undefined) parts.push('load ' + options.load);
      if (options.tipAngleDeg !== undefined) parts.push('tip ' + options.tipAngleDeg + ' degrees');
    }

    if (parts.length === 0) return 'Computed fin bending profile.';
    return 'Computed fin bending profile, ' + parts.join(', ') + '.';
  }

  function createBendingProfileSvg(points, options) {
    if (!points || !Array.isArray(points) || points.length === 0) return null;

    var xs = new Array(points.length);
    var ys = new Array(points.length);
    for (var i = 0; i < points.length; i += 1) {
      xs[i] = points[i].x;
      ys[i] = points[i].y;
    }

    const minX = Math.min.apply(null, xs);
    const maxX = Math.max.apply(null, xs);
    const minY = Math.min.apply(null, ys);
    const maxY = Math.max.apply(null, ys);

    const margin = options && typeof options.margin === 'number' ? Math.max(0, options.margin) : DEFAULT_MARGIN;
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const viewWidth = width + margin * 2;
    const viewHeight = height + margin * 2;

    function toSvgCoords(point) {
      const x = point.x - minX + margin;
      const y = point.y - minY + margin;
      return { x: x, y: y };
    }

    var pathSegments = new Array(points.length);
    for (var j = 0; j < points.length; j += 1) {
      const svgPoint = toSvgCoords(points[j]);
      const command = j === 0 ? 'M' : 'L';
      pathSegments[j] = command + svgPoint.x.toFixed(2) + ' ' + svgPoint.y.toFixed(2);
    }

    const straightStart = toSvgCoords({ x: minX, y: minY });
    const straightEnd = toSvgCoords({ x: maxX, y: minY });
    const title = options && typeof options.title === 'string' ? options.title : 'Fin bending profile';
    const desc = describeProfile(options);

    var highlightMarkup = '';
    if (options && options.highlight && typeof options.highlight.x === 'number' && typeof options.highlight.y === 'number') {
      const highlightPoint = toSvgCoords(options.highlight);
      const left = { x: highlightPoint.x - 8, y: highlightPoint.y - 15 };
      const right = { x: highlightPoint.x + 8, y: highlightPoint.y - 15 };
      highlightMarkup = '  <polygon points="' +
        highlightPoint.x.toFixed(2) + ',' + highlightPoint.y.toFixed(2) + ' ' +
        left.x.toFixed(2) + ',' + left.y.toFixed(2) + ' ' +
        right.x.toFixed(2) + ',' + right.y.toFixed(2) + '" fill="#d62728"/>\n';
    }

    const svg = '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + viewWidth.toFixed(2) + ' ' + viewHeight.toFixed(2) + '" ' +
      'width="' + viewWidth.toFixed(2) + '" height="' + viewHeight.toFixed(2) + '" ' +
      'role="img" aria-labelledby="title desc">\n' +
      '  <title id="title">' + title + '</title>\n' +
      '  <desc id="desc">' + desc + '</desc>\n' +
      '  <rect x="0" y="0" width="100%" height="100%" fill="#ffffff"/>\n' +
      '  <g stroke="#d0d0d0" stroke-width="0.5">\n' +
      '    <line x1="' + straightStart.x.toFixed(2) + '" y1="' + straightStart.y.toFixed(2) + '" x2="' + straightEnd.x.toFixed(2) + '" y2="' + straightEnd.y.toFixed(2) + '"/>\n' +
      '  </g>\n' +
      '  <path d="' + pathSegments.join(' ') + '" fill="none" stroke="#1f77b4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>\n' +
      highlightMarkup +
      '  <circle cx="' + straightStart.x.toFixed(2) + '" cy="' + straightStart.y.toFixed(2) + '" r="3" fill="#1f77b4"/>\n' +
      '  <circle cx="' + straightEnd.x.toFixed(2) + '" cy="' + straightEnd.y.toFixed(2) + '" r="3" fill="#1f77b4"/>\n' +
      '  <text x="' + straightStart.x.toFixed(2) + '" y="' + (straightStart.y - 6).toFixed(2) + '" font-size="6" fill="#333">Foot</text>\n' +
      '  <text x="' + straightEnd.x.toFixed(2) + '" y="' + (straightEnd.y - 6).toFixed(2) + '" font-size="6" fill="#333">Tip</text>\n' +
      '</svg>\n';

    return svg;
  }

  function createLaminateStackSvg(laminate, options) {
    if (!laminate) return null;

    const baseLayers = Array.isArray(laminate.baseLayers) ? laminate.baseLayers : [];
    const extraLayers = Array.isArray(laminate.extraLayers) ? laminate.extraLayers : [];
    if (baseLayers.length === 0 && extraLayers.length === 0) return null;

    const canvasWidth = options && typeof options.width === 'number' ? options.width : 500;
    const canvasHeight = options && typeof options.height === 'number' ? options.height : 200;
    const margin = options && typeof options.margin === 'number' ? Math.max(0, options.margin) : DEFAULT_MARGIN;
    const x0 = margin;
    const y0 = margin;
    const lengthScale = (canvasWidth - 2 * margin) / 600;
    const widthScale = (canvasHeight - 2 * margin) / 300;

    const lengthPx = Math.max(0, (laminate.length || 0) * lengthScale);
    const widthPx = Math.max(0, (laminate.width || 0) * widthScale);

    var layerRects = '';

    for (var i = 0; i < baseLayers.length; i += 1) {
      layerRects += '  <rect x="' + x0.toFixed(2) + '" y="' + y0.toFixed(2) + '" width="' + lengthPx.toFixed(2) + '" ' +
        'height="' + widthPx.toFixed(2) + '" fill="rgba(0,0,200,0.3)" stroke="#000" stroke-width="0.8"/>\n';
    }

    for (var j = 0; j < extraLayers.length; j += 1) {
      const layer = extraLayers[j];
      const layerLengthPx = Math.max(0, (layer.length || 0) * lengthScale);
      layerRects += '  <rect x="' + x0.toFixed(2) + '" y="' + y0.toFixed(2) + '" width="' + layerLengthPx.toFixed(2) + '" ' +
        'height="' + widthPx.toFixed(2) + '" fill="rgba(200,0,0,0.3)" stroke="#000" stroke-width="0.8"/>\n';
    }

    const footLabelX = x0;
    const tipLabelX = x0 + Math.max(lengthPx, 0);
    const labelY = y0 + widthPx + 16;
    var highlightMarkup = '';
    if (options && typeof options.highlightX === 'number') {
      const clampedHighlight = Math.max(0, options.highlightX);
      const highlightPx = x0 + clampedHighlight * lengthScale;
      highlightMarkup = '  <line x1="' + highlightPx.toFixed(2) + '" y1="' + y0.toFixed(2) + '" x2="' + highlightPx.toFixed(2) + '" y2="' + (y0 + widthPx).toFixed(2) + '" stroke="#d62728" stroke-width="1.2"/>\n';
    }
    const title = options && typeof options.title === 'string' ? options.title : 'Laminate stack';
    const desc = options && typeof options.description === 'string'
      ? options.description
      : 'Laminate layering for ' + laminate.layersFoot + ' layers at the foot and ' + laminate.layersTip + ' layers at the tip.';

    const svg = '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + canvasWidth + ' ' + canvasHeight + '" ' +
      'width="' + canvasWidth + '" height="' + canvasHeight + '" role="img" aria-labelledby="laminate-title laminate-desc">\n' +
      '  <title id="laminate-title">' + title + '</title>\n' +
      '  <desc id="laminate-desc">' + desc + '</desc>\n' +
      '  <rect x="0" y="0" width="100%" height="100%" fill="#ffffff"/>\n' +
      layerRects +
      highlightMarkup +
      '  <text x="' + footLabelX.toFixed(2) + '" y="' + labelY.toFixed(2) + '" font-size="12" fill="#333">Foot</text>\n' +
      '  <text x="' + tipLabelX.toFixed(2) + '" y="' + labelY.toFixed(2) + '" font-size="12" fill="#333" text-anchor="end">Tip</text>\n' +
      '</svg>\n';

    return svg;
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
    computeSectionInertia: computeSectionInertia,
    computeDefaultParams: computeDefaultParams,
    createBendingProfilePoints: createBendingProfilePoints,
    createBendingProfileSvg: createBendingProfileSvg,
    createLaminateStackSvg: createLaminateStackSvg,
    computeHydrodynamicResistance: computeHydrodynamicResistance,
  };
});
