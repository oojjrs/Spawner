import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function createRelease(input, projectId, revision, preparedAt) {
  if (input?.project_id !== projectId || !Number.isSafeInteger(input.latest_version_number) || input.latest_version_number < 0)
    throw new Error("현재 Sites 프로젝트와 최신 버전 정보가 필요합니다.");
  if (!Array.isArray(input.notes) || input.notes.length < 1 || input.notes.length > 5 ||
      input.notes.some(note => typeof note !== "string" || !note.trim() || note.length > 240))
    throw new Error("이번 배포의 승인된 패치노트 1~5줄이 필요합니다.");
  if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error("배포 소스 커밋을 확인해 주세요.");
  const timestamp = preparedAt.toISOString();
  const time = new Date(preparedAt.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 19).replaceAll("-", ".").replace("T", "-");
  const number = input.latest_version_number + 1;
  return { project_id: projectId, version_number: number, prepared_at: timestamp, source_revision: revision,
    label: "v" + number + " · " + time, cache_key: number + "-" + preparedAt.getTime(), notes: input.notes.map(note => note.trim()) };
}

export function releasePage(source, release) {
  const versioned = source.replace(/(?<![\w-])(src|href)="((?:\.\/)?client\/[^"?#]+\.(?:js|css))"/g,
    (match, attribute, path) => attribute + '="' + path + "?v=" + release.cache_key + '"');
  const data = JSON.stringify(release).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e").replaceAll("&", "\\u0026");
  if (!versioned.includes('<script src="./client/release.js?')) throw new Error("배포 버전 표시 스크립트가 필요합니다.");
  return versioned.replace("</head>", '  <script type="application/json" id="site-release">' + data + "</script>\r\n</head>");
}

export function verifyRelease(release, savedVersion) {
  if (savedVersion?.project_id !== release.project_id || savedVersion.version_number !== release.version_number || !savedVersion.id)
    throw new Error("Sites 저장 버전과 화면 버전이 다릅니다. 배포하지 말고 최신 버전 정보로 다시 준비해 주세요.");
  return { project_id: release.project_id, version_id: savedVersion.id, version_number: release.version_number };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4) throw new Error("release.json과 Sites 저장 버전 응답 JSON 경로가 필요합니다.");
  const release = JSON.parse(readFileSync(resolve(process.argv[2]), "utf8"));
  const saved = JSON.parse(readFileSync(resolve(process.argv[3]), "utf8"));
  process.stdout.write(JSON.stringify(verifyRelease(release, saved.structuredContent || saved)) + "\n");
}
