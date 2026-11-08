import { useEditorStore } from './store';
import { previewAssistantEdits } from '../core/assistantEdits';
import { projectDuration } from '../core/model';
import { BUILTIN_ASSETS } from '../core/builtinAssets';

/** A narrow bridge shared by the MCP tools and the editor. Never evaluates code. */
export function installPluginBridge() {
  if (!window.reacutPlugin) return;
  let revision = 0;
  useEditorStore.subscribe((state, previous) => {
    if (state.project !== previous.project) revision++;
  });
  const snapshot = () => {
    const s = useEditorStore.getState();
    return { revision, name: s.project.name, id: s.project.id, width: s.project.width,
      height: s.project.height, fps: s.project.fps, duration: projectDuration(s.project),
      selectedIds: s.selectedIds, playhead: s.playhead, playing: s.playing, dirty: s.dirty,
      tracks: s.project.tracks, clips: s.project.clips,
      assets: s.project.assets.map(({ id, name, kind, duration, width, height, missing }) =>
        ({ id, name, kind, duration, width, height, missing })) };
  };
  window.reacutPlugin.onCommand(async (request) => {
    const s = useEditorStore.getState();
    const a = request.args;
    if (request.action === 'selectInput') {
      const focused = document.activeElement;
      if (focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement) { focused.select(); return { handled: true }; }
      return { handled: false };
    }
    if (request.action === 'flush') {
      await window.editorAPI!.autosaveProject(s.project);
      return { saved: true };
    }
    if (request.action === 'state') return snapshot();
    if (request.action === 'catalog') return { assets: BUILTIN_ASSETS };
    if (request.action === 'edit') {
      if (!Number.isInteger(a.revision) || a.revision !== revision) throw new Error("프로젝트가 변경되었습니다. 편집하기 전에 상태를 다시 읽어보십시오.");
      if (s.transactionOpen) throw new Error("사용자가 매개변수를 드래그하거나 조정하는 중입니다. 나중에 다시 시도하십시오.");
      const result = previewAssistantEdits(s.project, a.actions);
      s.commit(result.project);
      return { ...snapshot(), changes: result.descriptions };
    }
    if (request.action === 'import') {
      const assets = a.builtinId ? [await window.editorAPI!.importBuiltinAsset(a.builtinId)] :
        await window.editorAPI!.importMedia(a.paths);
      useEditorStore.getState().addAssets(assets);
      return snapshot();
    }
    if (request.action === 'control') {
      if (a.command === 'undo') s.undo();
      else if (a.command === 'redo') s.redo();
      else if (a.command === 'play') s.setPlaying(true);
      else if (a.command === 'pause') s.setPlaying(false);
      else if (a.command === 'seek') {
        if (typeof a.time !== 'number' || !Number.isFinite(a.time) || a.time < 0 || a.time > projectDuration(s.project)) throw new Error("잘못된 재생 위치");
        s.seek(a.time);
      } else throw new Error("지원되지 않는 편집기 작업");
      return snapshot();
    }
    throw new Error("지원되지 않는 플러그인 작업");
  });
}

declare global {
  interface Window {
    reacutPlugin?: {
      onCommand: (callback: (request: { action: string; args: Record<string, any> }) => Promise<unknown>) => void;
    };
  }
}
