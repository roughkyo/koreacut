import { constants } from "node:fs";
import { copyFile, mkdtemp, readFile, rmdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { startExport } from "../electron/export";
import { resolvePortableDocument } from "../electron/portableProject";
import { useEditorStore } from "../src/editor/store";
import { useLanguageStore } from "../src/i18n/languageStore";
import { parseSubtitles } from "../src/core/subtitles";

const help = "사용법\n  import-srt <프로젝트.reacut> <자막.srt> <새 프로젝트.reacut>\n  export <프로젝트.reacut> <새 영상.mp4>";

async function run(): Promise<void> {
  const [command, input, second, third, ...extra] = process.argv.slice(2);
  if (!command || command === "--help") {
    console.log(help);
    return;
  }
  const importing = command === "import-srt";
  if ((!importing && command !== "export") || !input || !second || Boolean(third) !== importing || extra.length) {
    throw new Error(help);
  }
  const projectFile = path.resolve(input);
  if ((await stat(projectFile)).size > 30 * 1024 * 1024) throw new Error("프로젝트 파일은 30MB 이하여야 합니다.");
  const project = await resolvePortableDocument(JSON.parse(await readFile(projectFile, "utf8")), projectFile);
  const output = path.resolve(importing ? third : second);
  if (importing) {
    if (path.extname(second).toLowerCase() !== ".srt" || path.extname(output).toLowerCase() !== ".reacut") {
      throw new Error("SRT 자막 파일과 새 .reacut 경로를 지정하세요.");
    }
    if ((await stat(second)).size > 5 * 1024 * 1024) throw new Error("자막 파일은 5MB 이하여야 합니다.");
    const text = new TextDecoder("utf-8", { fatal: true }).decode(await readFile(second));
    const cues = parseSubtitles(text);
    if (!cues.length) throw new Error("유효한 SRT 자막을 찾을 수 없습니다.");
    useLanguageStore.getState().setLanguage("ko");
    useEditorStore.getState().setProject(project);
    useEditorStore.getState().addSubtitles(cues);
    const edited = useEditorStore.getState().project;
    await writeFile(output, JSON.stringify(edited, null, 2), { flag: "wx" });
    console.log("자막 " + (edited.clips.length - project.clips.length) + "개를 저장했습니다. " + output);
    return;
  }
  if (path.extname(output).toLowerCase() !== ".mp4") throw new Error("새 .mp4 경로를 지정하세요.");
  const directory = await mkdtemp(path.join(path.dirname(output), ".reacut-cli-"));
  const staged = path.join(directory, "export.mp4");
  try {
    await new Promise<void>((resolve, reject) => {
      void startExport(project, {
        path: staged, format: "mp4", quality: "standard",
        width: project.width, height: project.height, fps: project.fps,
      }, (event) => {
        if (event.status === "complete") resolve();
        if (event.status === "error" || event.status === "cancelled") {
          reject(new Error(event.message ?? "내보내기가 취소되었습니다."));
        }
      }).catch(reject);
    });
    await copyFile(staged, output, constants.COPYFILE_EXCL);
    console.log("영상을 내보냈습니다. " + output);
  } finally {
    await unlink(staged).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
    await rmdir(directory);
  }
}

void run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

