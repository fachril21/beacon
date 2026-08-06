/**
 * Generates a small illustrative "app screenshot" as an inline SVG data URI,
 * standing in for a real uploaded screenshot in Stage 1 fixtures. Clearly a
 * flat wireframe mockup (not photorealistic) — swap for real product
 * screenshots once Stage 2's upload flow is wired to real assets.
 */
export function mockScreenshotDataUri(
  label: string,
  width = 1280,
  height = 800,
  kind: "mobile" | "dashboard" = "mobile",
): string {
  const bar = kind === "mobile" ? mobileChrome(width, height, label) : dashboardChrome(width, height, label);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="#F4F5F7"/>
    ${bar}
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function mobileChrome(w: number, h: number, label: string) {
  const headerH = h * 0.11;
  return `
    <rect x="0" y="0" width="${w}" height="${headerH}" fill="#111827"/>
    <text x="${w / 2}" y="${headerH / 2 + 8}" fill="#FFFFFF" font-family="Arial" font-size="${headerH * 0.34}" font-weight="700" text-anchor="middle">${escape(label)}</text>
    <rect x="${w * 0.06}" y="${headerH + h * 0.05}" width="${w * 0.88}" height="${h * 0.14}" rx="12" fill="#FFFFFF" stroke="#D1D5DB"/>
    <rect x="${w * 0.1}" y="${headerH + h * 0.09}" width="${w * 0.5}" height="${h * 0.025}" rx="4" fill="#9CA3AF"/>
    ${[0, 1, 2].map((i) => card(w, h * 0.24 + h * 0.19 * i + headerH, w * 0.88, h * 0.15)).join("")}
    <rect x="0" y="${h * 0.92}" width="${w}" height="${h * 0.08}" fill="#FFFFFF" stroke="#E5E7EB"/>
    ${[0.2, 0.5, 0.8].map((x) => `<circle cx="${w * x}" cy="${h * 0.96}" r="${h * 0.018}" fill="#9CA3AF"/>`).join("")}
  `;
}

function dashboardChrome(w: number, h: number, label: string) {
  const sidebarW = w * 0.2;
  return `
    <rect x="0" y="0" width="${sidebarW}" height="${h}" fill="#111827"/>
    <text x="${sidebarW / 2}" y="${h * 0.06}" fill="#FFFFFF" font-family="Arial" font-size="${h * 0.03}" font-weight="700" text-anchor="middle">${escape(label)}</text>
    ${[0, 1, 2, 3].map((i) => `<rect x="${sidebarW * 0.15}" y="${h * (0.14 + i * 0.07)}" width="${sidebarW * 0.7}" height="${h * 0.035}" rx="6" fill="#374151"/>`).join("")}
    <rect x="${sidebarW + w * 0.03}" y="${h * 0.04}" width="${w * 0.94 - sidebarW}" height="${h * 0.08}" rx="8" fill="#FFFFFF" stroke="#E5E7EB"/>
    ${[0, 1, 2].map((i) => card(w, h * (0.18 + i * 0.27), w * 0.94 - sidebarW, h * 0.22, sidebarW + w * 0.03)).join("")}
  `;
}

function card(w: number, y: number, cw: number, ch: number, x = w * 0.06) {
  return `<rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="14" fill="#FFFFFF" stroke="#E5E7EB"/>
    <rect x="${x + cw * 0.06}" y="${y + ch * 0.18}" width="${cw * 0.4}" height="${ch * 0.12}" rx="4" fill="#D1D5DB"/>
    <rect x="${x + cw * 0.06}" y="${y + ch * 0.42}" width="${cw * 0.8}" height="${ch * 0.08}" rx="4" fill="#E5E7EB"/>
    <rect x="${x + cw * 0.06}" y="${y + ch * 0.58}" width="${cw * 0.65}" height="${ch * 0.08}" rx="4" fill="#E5E7EB"/>`;
}

function escape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
