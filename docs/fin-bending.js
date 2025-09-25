(function () {
  const core = typeof window !== 'undefined' ? window.finBendingCore : (typeof finBendingCore !== 'undefined' ? finBendingCore : null);
  if (!core) {
    throw new Error('fin-bending-core.js must be loaded before fin-bending.js');
  }
  const computeDefaultParams = core.computeDefaultParams;
  const computeBendingProfile = core.computeBendingProfile;
  const solveForLoad = core.solveForLoad;

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
    '  <canvas id="laminate" width="500" height="200"></canvas>' +
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
    '  <canvas id="plot" width="500" height="400"></canvas>' +
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

  const laminateCanvas = appRoot.querySelector('#laminate');
  const laminateCtx = laminateCanvas.getContext('2d');
  const plotCanvas = appRoot.querySelector('#plot');
  const plotCtx = plotCanvas.getContext('2d');
  const outputEl = appRoot.querySelector('#output');

  function drawLaminate(maxBendX) {
    laminateCtx.clearRect(0, 0, laminateCanvas.width, laminateCanvas.height);

    const L = params.L;
    const b = params.b;
    const layersTip = params.layersTip;
    const layersFoot = params.layersFoot;

    const margin = 20;
    const lengthScale = (laminateCanvas.width - 2 * margin) / 600;
    const widthScale = (laminateCanvas.height - 2 * margin) / 300;
    const lengthPx = L * lengthScale;
    const widthPx = b * widthScale;
    const x0 = margin;
    const y0 = margin;

    for (var i = 0; i < layersTip; i += 1) {
      laminateCtx.fillStyle = 'rgba(0, 0, 200, 0.3)';
      laminateCtx.fillRect(x0, y0, lengthPx, widthPx);
      laminateCtx.strokeStyle = 'black';
      laminateCtx.strokeRect(x0, y0, lengthPx, widthPx);
    }

    const extraLayers = Math.max(0, layersFoot - layersTip);
    if (extraLayers > 0) {
      for (var j = 1; j <= extraLayers; j += 1) {
        const fraction = j / extraLayers;
        const layerLength = Math.max(50, L * (1 - fraction * 0.8));
        const layerLengthPx = layerLength * lengthScale;
        laminateCtx.fillStyle = 'rgba(200, 0, 0, 0.3)';
        laminateCtx.fillRect(x0, y0, layerLengthPx, widthPx);
        laminateCtx.strokeStyle = 'black';
        laminateCtx.strokeRect(x0, y0, layerLengthPx, widthPx);
      }
    }

    if (typeof maxBendX === 'number') {
      const bendPos = x0 + maxBendX * lengthScale;
      laminateCtx.strokeStyle = 'red';
      laminateCtx.beginPath();
      laminateCtx.moveTo(bendPos, y0);
      laminateCtx.lineTo(bendPos, y0 + widthPx);
      laminateCtx.stroke();
    }
  }

  function drawBendingPlot(profile) {
    plotCtx.clearRect(0, 0, plotCanvas.width, plotCanvas.height);
    plotCtx.save();
    plotCtx.translate(50, 30);

    const L = params.L;
    const tipDeflection = profile.tipDeflection;
    const axisMaxY = Math.max(50, Math.ceil(tipDeflection / 50) * 50);

    plotCtx.strokeStyle = 'gray';
    plotCtx.beginPath();
    plotCtx.moveTo(0, 0);
    plotCtx.lineTo(0, axisMaxY + 20);
    plotCtx.moveTo(0, 0);
    plotCtx.lineTo(L + 40, 0);
    plotCtx.stroke();

    plotCtx.fillStyle = 'black';
    plotCtx.fillText('X (mm)', L / 2, 20);
    plotCtx.fillText('Y (mm)', -30, axisMaxY + 20);

    plotCtx.strokeStyle = 'blue';
    plotCtx.beginPath();
    plotCtx.moveTo(profile.X[0], profile.Y[0]);
    for (var i = 1; i < profile.X.length; i += 1) {
      plotCtx.lineTo(profile.X[i], profile.Y[i]);
    }
    plotCtx.stroke();

    const maxIdx = profile.maxCurvatureIndex;
    const maxX = profile.X[maxIdx];
    const maxY = profile.Y[maxIdx];

    plotCtx.fillStyle = 'red';
    plotCtx.beginPath();
    plotCtx.moveTo(maxX, maxY);
    plotCtx.lineTo(maxX - 8, maxY - 15);
    plotCtx.lineTo(maxX + 8, maxY - 15);
    plotCtx.closePath();
    plotCtx.fill();

    plotCtx.restore();
  }

  function update() {
    const load = solveForLoad(params);
    const profile = computeBendingProfile(load, params);
    const loadKg = load / 9.81;

    drawBendingPlot(profile);
    drawLaminate(profile.x[profile.maxCurvatureIndex]);

    outputEl.textContent = 'Angle at tip = ' + profile.tipAngleDeg.toFixed(1) + '°, Load at tip = ' + load.toFixed(1) + ' N (' + loadKg.toFixed(2) + ' kg)';
  }

  update();
})();
