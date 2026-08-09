// Performance & integrity evaluation. Sends many access requests to both
// clouds, measures latency and throughput, then verifies the on-chain audit
// log is a valid tamper-evident hash chain. Outputs CSV, JSON and SVG charts.
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { createIssuer, createIdentity, issueCredential } = require("../src/identity");
const { getContract, didHash } = require("../src/chain");
const { startClouds } = require("../src/startClouds");

const N = parseInt(process.argv[2] || "50", 10); // total requests
const OUT = path.join(__dirname, "results");

async function ask(port, credential, action) {
  const r = await fetch(`http://127.0.0.1:${port}/access`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential, action }),
  });
  return r.json();
}

function stats(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const sum = s.reduce((a, b) => a + b, 0);
  const p = (q) => s[Math.min(s.length - 1, Math.floor(q * s.length))];
  return { count: s.length, avg: sum / s.length, min: s[0], max: s[s.length - 1], p95: p(0.95) };
}

// Minimal dependency-free SVG bar chart.
function svgBar(title, labels, values, unit) {
  const W = 520, H = 300, pad = 60, bw = (W - 2 * pad) / labels.length;
  const max = Math.max(...values, 1);
  let bars = "";
  labels.forEach((lab, i) => {
    const h = (values[i] / max) * (H - 2 * pad);
    const x = pad + i * bw + bw * 0.2, y = H - pad - h;
    bars += `<rect x="${x}" y="${y}" width="${bw * 0.6}" height="${h}" fill="#2563eb"/>`;
    bars += `<text x="${x + bw * 0.3}" y="${y - 6}" font-size="12" text-anchor="middle" fill="#111">${values[i].toFixed(1)}</text>`;
    bars += `<text x="${x + bw * 0.3}" y="${H - pad + 18}" font-size="12" text-anchor="middle" fill="#111">${lab}</text>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<rect width="${W}" height="${H}" fill="white"/>
<text x="${W / 2}" y="28" font-size="15" font-weight="bold" text-anchor="middle">${title}</text>
<text x="16" y="${H / 2}" font-size="11" transform="rotate(-90 16 ${H / 2})" text-anchor="middle">${unit}</text>
<line x1="${pad}" y1="${H - pad}" x2="${W - pad}" y2="${H - pad}" stroke="#999"/>
${bars}</svg>`;
}

async function verifyAuditChain(contract) {
  const count = Number(await contract.auditCount());
  let prev = ethers.ZeroHash;
  let valid = true;
  for (let i = 0; i < count; i++) {
    const a = await contract.audits(i);
    // a = [id, didHash, cloud, action, granted, timestamp, prevHash, entryHash]
    const recomputed = ethers.solidityPackedKeccak256(
      ["uint256", "bytes32", "string", "string", "bool", "uint256", "bytes32"],
      [a[0], a[1], a[2], a[3], a[4], a[5], a[6]]
    );
    if (a[6] !== prev || a[7] !== recomputed) valid = false;
    prev = a[7];
  }
  return { count, valid };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const contract = getContract();

  const issuer = await createIssuer();
  const alice = await createIdentity("alice");
  await (await contract.registerDID(didHash(alice.did))).wait();
  const vc = await issueCredential(issuer, alice.did, "user");

  await startClouds(issuer.publicKey);

  const clouds = [
    { name: "aws", port: 4001 },
    { name: "azure", port: 4002 },
  ];
  const perCloud = { aws: [], azure: [] };
  const rows = [["request", "cloud", "action", "granted", "latency_ms"]];

  console.log(`Running ${N} access requests across 2 clouds...`);
  const tStart = Date.now();
  for (let i = 0; i < N; i++) {
    const c = clouds[i % 2];
    const t0 = Date.now();
    const res = await ask(c.port, vc, "read");
    const ms = Date.now() - t0;
    perCloud[c.name].push(ms);
    rows.push([i, c.name, "read", res.granted, ms]);
  }
  const totalSec = (Date.now() - tStart) / 1000;
  const throughput = N / totalSec;

  const summary = {
    totalRequests: N,
    totalSeconds: Number(totalSec.toFixed(2)),
    throughput_req_per_sec: Number(throughput.toFixed(2)),
    aws_latency_ms: stats(perCloud.aws),
    azure_latency_ms: stats(perCloud.azure),
  };

  const audit = await verifyAuditChain(contract);
  summary.audit_records = audit.count;
  summary.audit_chain_valid = audit.valid;

  fs.writeFileSync(path.join(OUT, "requests.csv"), rows.map((r) => r.join(",")).join("\n"));
  fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2));
  fs.writeFileSync(
    path.join(OUT, "chart_latency.svg"),
    svgBar("Average access latency by cloud", ["AWS", "Azure"],
      [summary.aws_latency_ms.avg, summary.azure_latency_ms.avg], "milliseconds")
  );
  fs.writeFileSync(
    path.join(OUT, "chart_throughput.svg"),
    svgBar("Overall throughput", ["System"], [summary.throughput_req_per_sec], "requests / second")
  );

  console.log("\n===== RESULTS =====");
  console.log(JSON.stringify(summary, null, 2));
  console.log("\nSaved: experiments/results/{requests.csv, summary.json, chart_latency.svg, chart_throughput.svg}");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });