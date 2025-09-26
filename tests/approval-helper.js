const fs = require('fs');
const path = require('path');

const approvalsDir = path.join(__dirname, 'approvals');

function ensureApprovalsDir() {
  if (!fs.existsSync(approvalsDir)) {
    fs.mkdirSync(approvalsDir, { recursive: true });
  }
}

function writeArtifact(name, extension, content) {
  ensureApprovalsDir();
  const targetPath = path.join(approvalsDir, `${name}.${extension}`);
  fs.writeFileSync(targetPath, content, 'utf8');
  return targetPath;
}

function renderBendingProfileSvg(name, data) {
  if (!data || !Array.isArray(data.points) || data.points.length === 0) return null;

  const xs = data.points.map((point) => point.x);
  const ys = data.points.map((point) => point.y);

  const minX = Math.min.apply(null, xs);
  const maxX = Math.max.apply(null, xs);
  const minY = Math.min.apply(null, ys);
  const maxY = Math.max.apply(null, ys);

  const margin = 20;
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const viewWidth = width + margin * 2;
  const viewHeight = height + margin * 2;

  const toSvgCoords = (point) => {
    const x = point.x - minX + margin;
    const y = viewHeight - (point.y - minY + margin);
    return { x, y };
  };

  const pathData = data.points
    .map((point, index) => {
      const svgPoint = toSvgCoords(point);
      const command = index === 0 ? 'M' : 'L';
      return `${command}${svgPoint.x.toFixed(2)} ${svgPoint.y.toFixed(2)}`;
    })
    .join(' ');

  const straightEnd = toSvgCoords({ x: maxX, y: minY });
  const straightStart = toSvgCoords({ x: minX, y: minY });

  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewWidth.toFixed(2)} ${viewHeight.toFixed(2)}" ` +
    `width="${viewWidth.toFixed(2)}" height="${viewHeight.toFixed(2)}" ` +
    `role="img" aria-labelledby="title desc">\n` +
    `  <title id="title">Fin bending profile</title>\n` +
    `  <desc id="desc">Approved curve for default parameters, load ${data.load}, tip ${data.tipAngleDeg} degrees.</desc>\n` +
    `  <rect x="0" y="0" width="100%" height="100%" fill="#ffffff"/>\n` +
    `  <g stroke="#d0d0d0" stroke-width="0.5">\n` +
    `    <line x1="${straightStart.x.toFixed(2)}" y1="${straightStart.y.toFixed(2)}" x2="${straightEnd.x.toFixed(2)}" y2="${straightEnd.y.toFixed(2)}"/>\n` +
    `  </g>\n` +
    `  <path d="${pathData}" fill="none" stroke="#1f77b4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>\n` +
    `  <circle cx="${straightStart.x.toFixed(2)}" cy="${straightStart.y.toFixed(2)}" r="3" fill="#1f77b4"/>\n` +
    `  <circle cx="${straightEnd.x.toFixed(2)}" cy="${straightEnd.y.toFixed(2)}" r="3" fill="#1f77b4"/>\n` +
    `  <text x="${straightStart.x.toFixed(2)}" y="${straightStart.y.toFixed(2) - 6}" font-size="6" fill="#333">Foot</text>\n` +
    `  <text x="${straightEnd.x.toFixed(2)}" y="${straightEnd.y.toFixed(2) - 6}" font-size="6" fill="#333">Tip</text>\n` +
    `</svg>\n`;

  return writeArtifact(name, 'approved.svg', svg);
}

function renderLaminateStackSvg(name, data) {
  if (!data) return null;

  const baseLayers = Array.isArray(data.baseLayers) ? data.baseLayers : [];
  const extraLayers = Array.isArray(data.extraLayers) ? data.extraLayers : [];
  if (baseLayers.length === 0 && extraLayers.length === 0) return null;

  const canvasWidth = 500;
  const canvasHeight = 200;
  const margin = 20;
  const x0 = margin;
  const y0 = margin;
  const lengthScale = (canvasWidth - 2 * margin) / 600;
  const widthScale = (canvasHeight - 2 * margin) / 300;

  const lengthPx = Math.max(0, (data.length || 0) * lengthScale);
  const widthPx = Math.max(0, (data.width || 0) * widthScale);

  const layerRects = [];

  for (var i = 0; i < baseLayers.length; i += 1) {
    layerRects.push(
      `  <rect x="${x0.toFixed(2)}" y="${y0.toFixed(2)}" width="${lengthPx.toFixed(2)}" ` +
        `height="${widthPx.toFixed(2)}" fill="rgba(0,0,200,0.3)" stroke="#000" stroke-width="0.8"/>
`
    );
  }

  for (var j = 0; j < extraLayers.length; j += 1) {
    const layer = extraLayers[j];
    const layerLengthPx = Math.max(0, (layer.length || 0) * lengthScale);
    layerRects.push(
      `  <rect x="${x0.toFixed(2)}" y="${y0.toFixed(2)}" width="${layerLengthPx.toFixed(2)}" ` +
        `height="${widthPx.toFixed(2)}" fill="rgba(200,0,0,0.3)" stroke="#000" stroke-width="0.8"/>
`
    );
  }

  const footLabelX = x0;
  const tipLabelX = x0 + Math.max(lengthPx, 0);
  const labelY = y0 + widthPx + 16;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasWidth} ${canvasHeight}" ` +
    `width="${canvasWidth}" height="${canvasHeight}" role="img" aria-labelledby="laminate-title laminate-desc">\n` +
    `  <title id="laminate-title">Laminate stack</title>\n` +
    `  <desc id="laminate-desc">Approved laminate layering for ${data.layersFoot} layers at the foot and ${data.layersTip} layers at the tip.</desc>\n` +
    `  <rect x="0" y="0" width="100%" height="100%" fill="#ffffff"/>\n` +
    layerRects.join('') +
    `  <text x="${footLabelX.toFixed(2)}" y="${labelY.toFixed(2)}" font-size="12" fill="#333">Foot</text>\n` +
    `  <text x="${tipLabelX.toFixed(2)}" y="${labelY.toFixed(2)}" font-size="12" fill="#333" text-anchor="end">Tip</text>\n` +
    `</svg>\n`;

  return writeArtifact(name, 'approved.svg', svg);
}

function serialize(value) {
  if (typeof value === 'string') return value.endsWith('\n') ? value : `${value}\n`;
  return `${JSON.stringify(value, null, 2)}\n`;
}

function approve(name, value) {
  ensureApprovalsDir();

  const approvedPath = path.join(approvalsDir, `${name}.approved.json`);
  const receivedPath = path.join(approvalsDir, `${name}.received.json`);
  const output = serialize(value);

  if (!fs.existsSync(approvedPath)) {
    fs.writeFileSync(receivedPath, output, 'utf8');
    throw new Error(
      `Missing approved output for ${name}. Review ${receivedPath} and rename it to ${path.basename(approvedPath)}`
    );
  }

  const approved = fs.readFileSync(approvedPath, 'utf8');

  if (approved !== output) {
    fs.writeFileSync(receivedPath, output, 'utf8');
    throw new Error(
      `Approval mismatch for ${name}. Compare ${approvedPath} with ${receivedPath}`
    );
  }

  if (fs.existsSync(receivedPath)) {
    fs.unlinkSync(receivedPath);
  }
}

module.exports = {
  approve,
  renderLaminateStackSvg,
  renderBendingProfileSvg,
  writeArtifact,
};
