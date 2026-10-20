"use strict";

// This preview only renders snapshots produced by the shared Godot core.
// Collision rules, generation, editing and persistence are intentionally absent.
const trace = JSON.parse(document.getElementById("verified-trace").textContent);
const originals = trace.frames[0].stage.arrows;
const workView = document.getElementById("work-view");
const analysisView = document.getElementById("analysis-view");
const profileDialog = document.getElementById("profile-dialog");
let showLinks = true;
let analysisFrame = 2;
let toastTimer;

function escapeText(value) {
 return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function renderBoard(frameIndex, keepRemoved) {
 const frame = trace.frames[frameIndex];
 const remaining = new Set(frame.stage.arrows.map(arrow => arrow.id));
 const free = new Set(frame.available);
 const cell = 41, originX = 86, originY = 36;
 const center = point => [originX + (point[0] - .5) * cell, originY + (point[1] - .5) * cell];
 let result = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 690 438" role="img" aria-label="검증된 화살표 배치, '+frameIndex+'개 제거 후"><defs><pattern id="dots-'+frameIndex+'" width="41" height="41" patternUnits="userSpaceOnUse" x="'+originX+'" y="'+originY+'"><circle cx="20.5" cy="20.5" r="1.1" fill="var(--hairline)"/></pattern></defs>';
 result += '<rect x="'+originX+'" y="'+originY+'" width="492" height="369" rx="10" fill="var(--canvas)" stroke="var(--hairline)"/><rect x="'+originX+'" y="'+originY+'" width="492" height="369" fill="url(#dots-'+frameIndex+')"/>';
 result += '<rect x="'+originX+'" y="'+originY+'" width="410" height="123" rx="10" fill="none" stroke="var(--ink)" stroke-width="1" stroke-dasharray="3 5"/>';
 result += '<rect x="'+(originX+82)+'" y="'+(originY+123)+'" width="287" height="205" rx="10" fill="none" stroke="var(--ink)" stroke-width="1" stroke-dasharray="3 5"/>';
 result += '<g fill="var(--ink)" font-family="var(--sans)" font-size="11" font-weight="480"><text x="388" y="59">R1 / 선행 구간</text><text x="337" y="346">R2 / 개방 대상</text></g>';
 if (showLinks && remaining.has("G")) {
  result += '<g class="blocking-connections" stroke="var(--ink)" stroke-width="1.2" stroke-dasharray="3 5" fill="none">';
  for (const id of ["A", "B", "C"]) {
   if (!remaining.has(id) || !(frame.blockers[id] || []).includes("G")) continue;
   const arrow = originals.find(item => item.id === id), head = center(arrow.head_cell);
   result += '<path d="M'+head[0]+' '+(head[1]-20)+'V'+(originY+2.5*cell+12)+'"/>';
  }
  result += '</g>';
 }
 for (const arrow of originals) {
  const removed = !remaining.has(arrow.id);
  if (removed && !keepRemoved) continue;
  const head = center(arrow.head_cell);
  const direction = {LEFT:[-1,0], RIGHT:[1,0], UP:[0,-1], DOWN:[0,1]}[arrow.direction];
  const [dx, dy] = direction, [hx, hy] = head;
  const points = [...arrow.cells].reverse().map(center).map(point => point.join(",")).join(" ");
  const body = arrow.cells.length > 1 ? '<polyline points="'+points+'" fill="none" stroke="var(--ink)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>' : '<path d="M'+(hx-dx*12)+' '+(hy-dy*12)+'L'+(hx+dx*6)+' '+(hy+dy*6)+'" stroke="var(--ink)" stroke-width="6" stroke-linecap="round"/>';
  result += '<g'+(removed?' opacity=".16"':"")+'>';
  if (arrow.id === "G" && !removed) result += '<polyline points="'+points+'" fill="none" stroke="var(--block-lilac)" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>';
  result += body;
  const fill = removed || free.has(arrow.id) ? "var(--ink)" : arrow.id === "G" ? "var(--block-lilac)" : "var(--canvas)";
  result += '<path d="M'+(hx+dx*13)+' '+(hy+dy*13)+'L'+(hx-dx*5-dy*9)+' '+(hy-dy*5+dx*9)+'L'+(hx-dx*5+dy*9)+' '+(hy-dy*5-dx*9)+'Z" fill="'+fill+'" stroke="var(--ink)" stroke-width="2.4" stroke-linejoin="round"/>';
  result += '</g><text x="'+(hx+14)+'" y="'+(hy-14)+'" font-family="var(--mono)" font-size="12" fill="var(--ink)">'+escapeText(arrow.id)+(removed?' ×':'')+'</text>';
 }
 result += '<g font-family="var(--mono)" font-size="9" fill="var(--ink)"><text x="61" y="62">01</text><text x="61" y="390">09</text><text x="91" y="426">01</text><text x="558" y="426">12</text></g></svg>';
 return result;
}
function updateBoards() {
 document.getElementById("work-board").innerHTML = renderBoard(0, false);
 document.getElementById("analysis-board").innerHTML = renderBoard(analysisFrame, true);
}
function selectFrame(index) {
 if (![0, 2, 3].includes(index)) return;
 analysisFrame = index;
 const frame = trace.frames[index];
 document.getElementById("analysis-total").textContent = frame.stage.arrows.length;
 document.getElementById("analysis-free").textContent = frame.available.length;
 document.getElementById("analysis-blocked").textContent = frame.stage.arrows.length - frame.available.length;
 document.getElementById("analysis-state-title").textContent = {0:"시작 · Z 제거 가능", 2:"관문 직전 · G 제거 가능", 3:"영역 개방 · A·B·C 제거 가능"}[index];
 document.querySelectorAll("[data-frame]").forEach(button => {
  const selected = Number(button.dataset.frame) === index;
  button.classList.toggle("selected", selected);
  button.setAttribute("aria-pressed", String(selected));
 });
 updateBoards();
}
function showView(view) {
 const analysis = view === "analysis";
 workView.hidden = analysis;
 analysisView.hidden = !analysis;
 document.querySelectorAll(".view-tabs [data-view]").forEach(button => {
  const selected = button.dataset.view === (analysis ? "analysis" : "work");
  button.classList.toggle("selected", selected);
  button.setAttribute("aria-pressed", String(selected));
 });
}
const conditions = {
 available:{title:"풀이 가능 수",description:"지금 바로 제거 가능한 화살의 목표 범위를 지정합니다.",target:"1–2개 (입력 예시)",scope:"전체 맵"},
 chain:{title:"연쇄 연결",description:"선행 관계의 깊이와 압박 구간이 반복되는 빈도를 구분합니다.",target:"미설정 · 선행 관계 기준 협의 필요",scope:"대상 화살·영역 미설정"},
 opening:{title:"영역 개방",description:"관문 제거 후 새로 제거 가능해지는 화살의 수를 지정합니다.",target:"3개 이상 (입력 예시)",scope:"영향 영역 R2"}
};
function selectCondition(name) {
 const condition = conditions[name];
 if (!condition) return;
 document.getElementById("condition-title").textContent = condition.title;
 document.getElementById("condition-description").textContent = condition.description;
 document.getElementById("condition-target").value = condition.target;
 document.getElementById("condition-scope").value = condition.scope;
 document.querySelectorAll("[data-condition]").forEach(button => {
  const selected = button.dataset.condition === name;
  button.classList.toggle("selected", selected);
  button.setAttribute("aria-pressed", String(selected));
 });
}
function previewMessage(action) {
 const toast = document.getElementById("preview-toast");
 toast.textContent = action+"은 디자인 예시입니다. 실제 맵·파일은 변경하지 않습니다.";
 toast.hidden = false;
 clearTimeout(toastTimer);
 toastTimer = setTimeout(() => {toast.hidden = true;}, 3500);
}
document.addEventListener("click", event => {
 const button = event.target.closest("button");
 if (!button) return;
 if (button.hasAttribute("data-view")) showView(button.dataset.view);
 if (button.hasAttribute("data-frame")) selectFrame(Number(button.dataset.frame));
 if (button.hasAttribute("data-open-profile") && !profileDialog.open) profileDialog.showModal();
 if (button.hasAttribute("data-condition")) selectCondition(button.dataset.condition);
 if (button.hasAttribute("data-preview-action")) previewMessage(button.dataset.previewAction);
});
document.querySelector(".brand").addEventListener("click", event => {event.preventDefault(); showView("work");});
document.getElementById("close-profile").addEventListener("click", () => profileDialog.close());
document.getElementById("return-work").addEventListener("click", () => profileDialog.close());
document.getElementById("toggle-links").addEventListener("click", event => {
 showLinks = !showLinks;
 event.currentTarget.setAttribute("aria-pressed", String(showLinks));
 event.currentTarget.classList.toggle("soft", showLinks);
 updateBoards();
});
document.getElementById("stage-search").addEventListener("input", event => {
 const query = event.target.value.trim().toUpperCase();
 let matches = 0;
 document.querySelectorAll("[data-stage-id]").forEach(item => {
  item.hidden = !item.dataset.stageId.includes(query);
  if (!item.hidden) matches++;
 });
 document.getElementById("search-empty").hidden = matches !== 0;
});
const query = new URLSearchParams(location.search);
showView(query.get("view") || "work");
selectFrame(Number(query.get("frame") || 2));
selectCondition("opening");
if (query.get("modal") === "1") profileDialog.showModal();

