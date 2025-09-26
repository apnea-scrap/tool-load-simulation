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
  renderBendingProfileSvg,
  writeArtifact,
};
