const fs = require('fs');
const path = require('path');
const core = require('../docs/fin-bending-core.js');

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

  const svg = core.createBendingProfileSvg(data.points, {
    description: `Approved curve for default parameters, load ${data.load}, tip ${data.tipAngleDeg} degrees.`,
  });

  return writeArtifact(name, 'approved.svg', svg);
}

function renderLaminateStackSvg(name, data) {
  if (!data) return null;

  const svg = core.createLaminateStackSvg(data, {
    description: `Approved laminate layering for ${data.layersFoot} layers at the foot and ${data.layersTip} layers at the tip.`,
  });

  if (!svg) return null;
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
