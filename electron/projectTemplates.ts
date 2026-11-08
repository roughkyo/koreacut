import {
  readFile,
  writeFile,
  mkdir,
  readdir,
  stat,
  realpath,
  rm,
} from "node:fs/promises";
import path from "node:path";
import {
  collectPortableProject,
  resolvePortableDocument,
} from "./portableProject";
import {
  validateTemplate,
  type ProjectTemplate,
  type TemplateSummary,
} from "../src/core/projectTemplates";

const originalAssetLicense =
  "이 라이선스는 ReaCut의 자체 템플릿 구성과 내장 그래픽에만 적용됩니다. 사용자가 가져온 미디어의 라이선스는 그대로 적용되며, 글꼴 파일은 템플릿 패키지에 포함되지 않습니다.\n\nMIT License\n\nCopyright (c) 2026 ReaCut contributors\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the \"Software\"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n";

export const TEMPLATE_FILE = "Template.reacut-template";
export function checkTemplateCover(cover: string) {
  if (!cover) return;
  const b = Buffer.from(cover.split(",")[1] ?? "", "base64");
  if (
    b.length < 24 ||
    !b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    b.toString("ascii", 12, 16) !== "IHDR" ||
    b.readUInt32BE(16) < 1 ||
    b.readUInt32BE(20) < 1 ||
    b.readUInt32BE(16) > 960 ||
    b.readUInt32BE(20) > 540
  )
    throw new Error("템플릿 표지 크기 또는 형식이 잘못되었습니다(최대 960×540 PNG)");
}
export async function readTemplate(file: string): Promise<ProjectTemplate> {
  if ((await stat(file)).size > 30 * 1024 * 1024)
    throw new Error("템플릿 파일이 너무 큽니다.");
  const raw = validateTemplate(JSON.parse(await readFile(file, "utf8")));
  checkTemplateCover(raw.cover);
  raw.project = await resolvePortableDocument(
    { format: "reacut-portable", version: 1, project: raw.project },
    file,
  );
  for (const a of raw.project.assets)
    if (!(await stat(a.path)).isFile())
      throw new Error("템플릿 자료가 누락되었거나 일반 파일이 아닙니다.");
  return raw;
}
/** Use the existing portable collector: deduplication, hash manifest, cancellation and source stability. */
export async function writeTemplate(
  input: ProjectTemplate,
  parent: string,
  signal: AbortSignal,
  progress: (p: number, message: string) => void,
): Promise<string> {
  const t = validateTemplate(input);
  checkTemplateCover(t.cover);
  t.project.assets = t.project.assets.filter((a) =>
    t.project.clips.some((c) => c.assetId === a.id),
  );
  let folder: string | undefined;
  try {
    folder = await collectPortableProject(t.project, parent, signal, progress);
    const portable = JSON.parse(
      await readFile(path.join(folder, "Project.reacut"), "utf8"),
    );
    if (signal.aborted) throw new Error("템플릿 작업이 취소되었습니다.");
    await writeFile(
      path.join(folder, TEMPLATE_FILE),
      JSON.stringify({ ...t, project: portable.project }, null, 2),
      { mode: 0o600 },
    );
    await writeFile(
      path.join(folder, "사용 안내.txt"),
      "ReaCut의 “파일 → 프로젝트 템플릿 → 템플릿 패키지 가져오기”를 이용하여 template.reacut-template을 선택하세요. 전체 폴더와 미디어 하위 디렉터리를 유지하세요. \nProject.reacut은 일반 머티리얼 패키지로 열 수 있습니다. 템플릿 정의와 자동으로 동기화되지 않습니다. 템플릿에는 미디어 복사본이 포함되며 글꼴 파일은 포함되지 않습니다.\n",
    );
    await writeFile(
      path.join(folder, "ReaCut-Original Resource License.txt"),
      originalAssetLicense,
      { mode: 0o600 },
    );
    if (signal.aborted) throw new Error("템플릿 작업이 취소되었습니다.");
    return folder;
  } catch (e) {
    if (folder) await rm(folder, { recursive: true, force: true });
    throw e;
  }
}
// Folder names come from the collector, but the path boundary is checked independently.
export async function libraryTemplate(root: string, id: string) {
  // Use an opaque directory name returned by list; never accept path separators/dot traversal.
  if (
    typeof id !== "string" ||
    !id ||
    id.length > 120 ||
    id === "." ||
    id === ".." ||
    /[\\/\0]/.test(id)
  )
    throw new Error("잘못된 템플릿 식별");
  const parent = await realpath(root),
    dir = await realpath(path.join(parent, id));
  if (path.dirname(dir) !== parent || dir !== path.join(parent, id))
    throw new Error("템플릿 참조가 로컬 템플릿 라이브러리를 초과합니다.");
  const file = path.join(dir, TEMPLATE_FILE);
  if ((await realpath(file)) !== file)
    throw new Error("템플릿 정의가 다른 위치를 가리킬 수 없습니다.");
  return readTemplate(file);
}
export async function listTemplates(root: string): Promise<TemplateSummary[]> {
  await mkdir(root, { recursive: true });
  const entries = await readdir(root, { withFileTypes: true });
  const result: TemplateSummary[] = [];
  for (const entry of entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .slice(0, 500)) {
    try {
      const t = await libraryTemplate(root, entry.name);
      result.push({
        id: entry.name,
        name: t.name,
        cover: t.cover,
        slots: t.slots.length,
      });
    } catch {
      /* An incomplete or externally damaged folder is not offered as usable. */
    }
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}
