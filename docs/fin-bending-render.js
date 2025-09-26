(function () {
  const core = typeof window !== 'undefined' ? window.finBendingCore : (typeof finBendingCore !== 'undefined' ? finBendingCore : null);
  if (!core) {
    throw new Error('fin-bending-core.js must be loaded before fin-bending-render.js');
  }
  const computeDefaultParams = core.computeDefaultParams;
  const computeBendingProfile = core.computeBendingProfile;
  const solveForLoad = core.solveForLoad;
  const computeLaminateStack = core.computeLaminateStack;

  const appRoot = document.getElementById('fin-bending-app');
  if (!appRoot) {
    throw new Error('Missing #fin-bending-app container.');
  }

  appRoot.innerHTML = '' +
    '<div class="section">' +
    '  <h4>Geometry</h4>' +
    '  <label>Layers at foot: <span id="layersFootVal"></span></label>' +
    '  <input type="range" id="layersFoot" min="1" max="15" value="4" class="slider"><br>' +
    '  <label>Layers at tip: <span id="layersTipVal"></span></label>' +
    '  <input type="range" id="layersTip" min="1" max="15" value="2" class="slider"><br>' +
    '  <label>Free blade length [mm]: <span id="lengthVal"></span></label>' +
    '  <input type="range" id="length" min="100" max="600" step="10" value="250" class="slider"><br>' +
    '  <label>Blade width [mm]: <span id="widthVal"></span></label>' +
    '  <input type="range" id="width" min="50" max="300" step="10" value="180" class="slider"><br>' +
    '  <div id="laminateSvg" class="svg-output"></div>' +
    '  <div class="caption">Foot (left) — Tip (right)</div>' +
    '</div>' +
    '<div class="section">' +
    '  <h4>Material Properties</h4>' +
    '  <label>Young\'s modulus E [GPa]: <span id="EVal"></span></label>' +
    '  <input type="range" id="E" min="20" max="40" step="0.5" value="32" class="slider"><br>' +
    '  <label>Layer thickness [mm]: <span id="thicknessVal"></span></label>' +
    '  <input type="range" id="thickness" min="0.2" max="0.6" step="0.01" value="0.35" class="slider"><br>' +
    '</div>' +
    '<div class="section">' +
    '  <h4>Bending Calculation</h4>' +
    '  <p id="output"></p>' +
    '  <div id="profileSvg" class="svg-output"></div>' +
    '  <div class="caption">Foot (left) — Tip (right)</div>' +
    '</div>';

  const params = computeDefaultParams();

  const sliderMeta = {
    layersFoot: { param: 'layersFoot', label: 'layersFootVal', parse: function (value) { return parseInt(value, 10); }, format: function (value) { return '' + value; } },
    layersTip: { param: 'layersTip', label: 'layersTipVal', parse: function (value) { return parseInt(value, 10); }, format: function (value) { return '' + value; } },
    length: { param: 'L', label: 'lengthVal', parse: function (value) { return parseInt(value, 10); }, format: function (value) { return '' + value; } },
    width: { param: 'b', label: 'widthVal', parse: function (value) { return parseInt(value, 10); }, format: function (value) { return '' + value; } },
    E: { param: 'E', label: 'EVal', parse: function (value) { return parseFloat(value); }, format: function (value) { return '' + value; } },
    thickness: {
      param: 'thickness',
      label: 'thicknessVal',
      parse: function (value) { return parseFloat(value); },
      format: function (value) { return Number(value).toFixed(2); },
    },
  };

  var sliders = {};
  var labels = {};

  for (var id in sliderMeta) {
    if (!sliderMeta.hasOwnProperty(id)) continue;
    var meta = sliderMeta[id];
    var slider = appRoot.querySelector('#' + id);
    var label = appRoot.querySelector('#' + meta.label);
    if (!slider || !label) continue;

    sliders[id] = slider;
    labels[meta.param] = label;
    slider.value = params[meta.param];
    label.textContent = meta.format(params[meta.param]);

    (function (sliderEl, metaCfg, labelEl) {
      sliderEl.addEventListener('input', function (event) {
        var value = metaCfg.parse(event.target.value);
        params[metaCfg.param] = value;
        labelEl.textContent = metaCfg.format(value);
        update();
      });
    })(slider, meta, label);
  }

  const laminateContainer = appRoot.querySelector('#laminateSvg');
  const profileContainer = appRoot.querySelector('#profileSvg');
  const outputEl = appRoot.querySelector('#output');

  function update() {
    const load = solveForLoad(params);
    const profile = computeBendingProfile(load, params);
    const laminateStack = computeLaminateStack(params);
    const loadKg = load / 9.81;
    const points = core.createBendingProfilePoints(profile);
    const highlightPoint = points[profile.maxCurvatureIndex];
    const profileSvg = core.createBendingProfileSvg(points, {
      load: Number(load.toFixed(1)),
      tipAngleDeg: Number(profile.tipAngleDeg.toFixed(1)),
      description: `Interactive profile. Load ${load.toFixed(1)} N, tip angle ${profile.tipAngleDeg.toFixed(1)} degrees.`,
      highlight: highlightPoint ? { x: highlightPoint.x, y: highlightPoint.y } : null,
    });

    if (profileContainer) {
      profileContainer.innerHTML = profileSvg || '';
    }

    const laminateHighlight = Array.isArray(profile.x) ? profile.x[profile.maxCurvatureIndex] : null;
    const laminateSvg = core.createLaminateStackSvg(laminateStack, {
      description: `Laminate layering for ${laminateStack.layersFoot} layers at the foot and ${laminateStack.layersTip} layers at the tip.`,
      highlightX: laminateHighlight,
    });

    if (laminateContainer) {
      laminateContainer.innerHTML = laminateSvg || '';
    }

    outputEl.textContent = 'Angle at tip = ' + profile.tipAngleDeg.toFixed(1) + '°, Load at tip = ' + load.toFixed(1) + ' N (' + loadKg.toFixed(2) + ' kg)';
  }

  update();
})();
