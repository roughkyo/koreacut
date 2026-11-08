import { constants } from "node:fs";
import { lstat, open, readlink, realpath, stat } from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import {
  CAPCUT_SIDECAR_MAX_BYTES,
  describeCapcutProjectSelection,
  planCapcutProjectImport,
  selectCapcutTimelineDraft,
  type CapcutProjectImportPlan,
} from "./capcutProject";

export const CAPCUT_DRAFT_MAX_BYTES = 20 * 1024 * 1024;

export interface CapcutProjectIOPlan extends CapcutProjectImportPlan {
  sourceSelection: { path: string; kind: "file" | "directory" };
  /** Captured canonical directory. Subsequent reads reject a retargeted root. */
  realProjectDirectory: string;
}

function isMissing(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function assertContained(root: string, path: string): void {
  const displacement = relative(root, path);
  if (
    displacement === ".." ||
    displacement.startsWith(`..${sep}`) ||
    isAbsolute(displacement)
  )
    throw new Error("선택한 프로젝트 디렉터리를 벗어나기 위해 초안 경로 자르기");
}

/** Missing sidecars are optional only when their nearest existing location is
 * still confined. A dangling link to a missing external file is not absence. */
async function verifyMissingPath(root: string, path: string): Promise<void> {
  let cursor = path;
  for (let depth = 0; depth < 256; depth++) {
    try {
      assertContained(root, await realpath(cursor));
      return;
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
    try {
      if ((await lstat(cursor)).isSymbolicLink()) {
        cursor = resolve(dirname(cursor), await readlink(cursor));
        continue;
      }
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
    const parent = dirname(cursor);
    if (parent === cursor)
      throw new Error("클립 초안의 누락된 경로에 대한 프로젝트 디렉터리 경계를 확인할 수 없습니다.");
    cursor = parent;
  }
  throw new Error("클립 초안 경로 수준이 유효성 검사 제한을 초과합니다.");
}

async function confinedRealpath(root: string, path: string): Promise<string> {
  try {
    const canonical = await realpath(path);
    assertContained(root, canonical);
    return canonical;
  } catch (error) {
    if (isMissing(error)) await verifyMissingPath(root, path);
    throw error;
  }
}

/** Read bounded bytes from one regular, confined file without decoding its payload. */
async function readConfinedFile(
  root: string,
  path: string,
  limit: number,
): Promise<Buffer> {
  const canonical = await confinedRealpath(root, path);
  const handle = await open(
    canonical,
    constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
  );
  try {
    const before = await handle.stat();
    if (!before.isFile()) throw new Error("클립 초안 파일이 일반 파일이 아닙니다.");
    if (before.size > limit) throw new Error("클립 초안 파일이 읽기 크기 제한을 초과합니다.");
    // Revalidate after open as well: a directory/symlink may have changed while
    // resolving. Never read bytes until the open descriptor matches this path.
    const afterPath = await realpath(path);
    assertContained(root, afterPath);
    const visible = await stat(afterPath);
    if (before.dev !== visible.dev || before.ino !== visible.ino)
      throw new Error("클립 초안 파일이 읽기 전에 변경되었습니다. 다시 시도하십시오.");
    const chunks: Buffer[] = [];
    let length = 0;
    while (length <= limit) {
      const buffer = Buffer.allocUnsafe(Math.min(64 * 1024, limit + 1 - length));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      length += bytesRead;
      if (length > limit) throw new Error("클립 초안 파일이 읽기 크기 제한을 초과합니다.");
      chunks.push(buffer.subarray(0, bytesRead));
    }
    const after = await handle.stat();
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs)
      throw new Error("클립 초안 파일이 읽는 동안 변경되었습니다. 다시 시도하십시오.");
    return Buffer.concat(chunks, length);
  } finally {
    await handle.close();
  }
}

function utf8(buffer: Buffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(buffer);
  } catch {
    throw new Error("클립 초안 파일에 UTF-8 바이트가 포함되어 있지 않습니다. 현재 읽기 인터페이스는 아직 이 캐리어를 지원하지 않습니다.");
  }
}

async function optionalSidecar(root: string, path: string) {
  try {
    return utf8(await readConfinedFile(root, path, CAPCUT_SIDECAR_MAX_BYTES));
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }
}

/**
 * Read project/layout sidecars only. No decryption, source modification or
 * directory enumeration. A malformed/unreadable modern manifest never silently
 * falls back to a potentially empty root draft.
 */
export async function discoverSelectedCapcutProject(
  selectedPath: string,
  kind: "file" | "directory",
): Promise<CapcutProjectIOPlan> {
  const selection = describeCapcutProjectSelection(selectedPath, kind);
  const root = await realpath(selection.projectDirectory);
  if (!(await stat(root)).isDirectory())
    throw new Error("클리핑 프로젝트 경로");
  const manifest = await optionalSidecar(root, selection.manifestPath);
  const layout =
    manifest === undefined
      ? undefined
      : await optionalSidecar(root, selection.layoutPath);
  return {
    ...planCapcutProjectImport(selectedPath, kind, manifest, layout),
    sourceSelection: { path: selectedPath, kind },
    realProjectDirectory: root,
  };
}

/**
 * Read one selected draft as UTF-8 text. For a classic selected directory only,
 * try draft_content.json when draft_info.json does not exist. An explicit file
 * selection has no fallback, and a modern manifest always selects its listed
 * timeline payload rather than the root draft or plaintext temporary backups.
 */
export async function readSelectedCapcutTimeline(
  plan: CapcutProjectIOPlan,
  chosenTimelineId?: string,
): Promise<{ text: string; name: string; path: string }> {
  const root = await realpath(plan.selection.projectDirectory);
  if (root !== plan.realProjectDirectory)
    throw new Error("선택한 클리핑 프로젝트 디렉터리가 변경되었습니다. 프로젝트를 다시 선택하세요.");
  let path = selectCapcutTimelineDraft(plan, chosenTimelineId);
  let bytes: Buffer;
  try {
    bytes = await readConfinedFile(root, path, CAPCUT_DRAFT_MAX_BYTES);
  } catch (error) {
    if (
      plan.kind !== "single-draft" ||
      plan.sourceSelection.kind !== "directory" ||
      basename(path) !== "draft_info.json" ||
      !isMissing(error)
    )
      throw error;
    path = join(dirname(path), "draft_content.json");
    bytes = await readConfinedFile(root, path, CAPCUT_DRAFT_MAX_BYTES);
  }
  const choice = plan.timelines.find((timeline) => timeline.draftPath === path);
  return {
    text: utf8(bytes),
    name: choice?.name || basename(plan.selection.projectDirectory),
    path,
  };
}
