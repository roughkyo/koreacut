import { useUITranslation } from "../i18n";
import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  AudioLines,
  Check,
  FileImage,
  Film,
  FolderOpen,
  Grid2X2,
  Image,
  List,
  LoaderCircle,
  MoreHorizontal,
  Music2,
  Plus,
  Play,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { MediaAsset, MediaKind, Project } from "../core/types";
import { ASSET_DRAG_TYPE } from "./Timeline";
import "./MediaLibrary.css";

export interface MediaLibraryProps {
  project: Project;
  onImport: (paths?: string[]) => void;
  onAddAsset: (assetId: string) => void;
  onRemoveAsset: (assetId: string) => void;
  importing?: boolean;
  onImportFiles?: (files: File[]) => void;
  onRevealAsset?: (assetId: string) => void;
  onPreviewAsset?: (assetId: string) => void;
}
export function formatMediaDuration(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}
function KindIcon({ kind, size = 12 }: { kind: MediaKind; size?: number }) {
  const ui = useUITranslation();
  return kind === "audio" ? (
    <Music2 size={size} />
  ) : kind === "image" ? (
    <Image size={size} />
  ) : (
    <Film size={size} />
  );
}

export default function MediaLibrary({
  project,
  onImport,
  onAddAsset,
  onRemoveAsset,
  importing = false,
  onImportFiles,
  onRevealAsset,
  onPreviewAsset,
}: MediaLibraryProps) {
  const ui = useUITranslation();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<MediaKind | "all">("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [selected, setSelected] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const dragCounter = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setSelected(null);
    setMenu(null);
    setQuery("");
  }, [project.id]);
  const filtered = project.assets.filter(
    (asset) =>
      (kind === "all" || asset.kind === kind) &&
      asset.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const startImport = () => {
    if (!window.editorAPI && onImportFiles) fileInput.current?.click();
    else onImport();
  };
  const receiveFiles = (files: File[]) => {
    if (!files.length) return;
    if (window.editorAPI) {
      const paths = files
        .map((file) => window.editorAPI!.getPathForFile(file))
        .filter(Boolean);
      if (paths.length) onImport(paths);
    } else onImportFiles?.(files);
  };
  const dropFiles = (event: DragEvent) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.stopPropagation();
    dragCounter.current = 0;
    setDraggingFiles(false);
    receiveFiles(Array.from(event.dataTransfer.files));
  };
  const item = (asset: MediaAsset) => {
    const inTimeline = project.clips.some((c) => c.assetId === asset.id);
    return (
      <div
        key={asset.id}
        data-asset-id={asset.id}
        role="button"
        tabIndex={0}
        aria-label={`${asset.name}，${asset.kind === "audio" ? ui("오디오", "Audio") : asset.kind === "image" ? ui("사진", "Image") : ui("영상", "Video")}${asset.missing ? ui(", 파일 손실", ", missing file") : ""}`}
        aria-pressed={selected === asset.id}
        className={`media-item media-item-${asset.kind} ${selected === asset.id ? "is-selected" : ""} ${asset.missing ? "is-missing" : ""}`}
        draggable={!asset.missing}
        onDragStart={(event) => {
          event.dataTransfer.setData(ASSET_DRAG_TYPE, asset.id);
          event.dataTransfer.setData(
            `application/x-reacut-kind-${asset.kind}`,
            asset.kind,
          );
          event.dataTransfer.effectAllowed = "copy";
          setSelected(asset.id);
          setMenu(null);
        }}
        onClick={(event) => {
          setSelected(asset.id);
          setMenu(null);
          if (!(event.target as HTMLElement).closest("button")) onPreviewAsset?.(asset.id);
        }}
        onDoubleClick={(event) => {
          if (
            !(event.target as HTMLElement).closest("button") &&
            !asset.missing
          )
            onAddAsset(asset.id);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          setSelected(asset.id);
          setMenu(asset.id);
        }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === " " && onPreviewAsset) {
            event.preventDefault();
            event.stopPropagation();
            setSelected(asset.id);
            onPreviewAsset(asset.id);
          }
          if (event.key === "Enter" && !asset.missing) {
            event.preventDefault();
            onAddAsset(asset.id);
          }
          if (event.key === "Delete") {
            event.preventDefault();
            onRemoveAsset(asset.id);
          }
        }}
      >
        <div className="media-preview">
          {asset.kind !== "audio" &&
          (asset.thumbnail || asset.kind === "image") ? (
            <img
              src={asset.thumbnail || asset.url}
              alt=""
              draggable={false}
              loading="lazy"
            />
          ) : (
            <div className="media-placeholder">
              {asset.kind === "audio" ? (
                <AudioLines size={27} />
              ) : (
                <Film size={27} />
              )}
            </div>
          )}
          {asset.kind === "audio" && asset.waveform && (
            <div className="media-audio-wave" aria-hidden="true">
              {Array.from({ length: 40 }, (_, i) => (
                <i
                  key={i}
                  style={{
                    height: `${8 + (asset.waveform![Math.floor((i / 40) * asset.waveform!.length)] ?? 0.3) * 75}%`,
                  }}
                />
              ))}
            </div>
          )}
          <span className="media-kind">
            <KindIcon kind={asset.kind} />
          </span>
          <span className="media-time">
            {asset.kind === "image"
              ? ui("사진", "Image")
              : formatMediaDuration(asset.duration)}
          </span>
          {inTimeline && (
            <span className="media-used" title={ui("타임라인에서 이미 사용됨", "Used on timeline")}>
              <Check size={10} />
            </span>
          )}
          {asset.missing && <span className="media-missing"> {ui("파일 손실", "Missing file")} </span>}
          <button
            className="media-add"
            aria-label={ui(`추가 ${asset.name} 타임라인에`, `Add ${asset.name} to timeline`)}
            title={ui("재생 위치에 추가됨 · 자료 두 번 클릭", "Add at playhead · Double-click asset")}
            disabled={asset.missing}
            onClick={(event) => {
              event.stopPropagation();
              onAddAsset(asset.id);
            }}
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="media-info">
          <span className="media-name" title={asset.name}>
            {asset.name}
          </span>
          <span className="media-metadata">
            {asset.kind === "audio"
              ? ui("오디오", "Audio")
              : `${asset.width} × ${asset.height}`}{" "}
            {asset.kind === "video" && asset.fps > 0
              ? `· ${Math.round(asset.fps * 100) / 100} fps`
              : ""}
          </span>
        </div>
        <button
          className="media-more"
          title={ui("자료 작업", "Asset actions")}
          aria-label={ui(`${asset.name} 작업`, `${asset.name} actions`)}
          aria-expanded={menu === asset.id}
          onClick={(event) => {
            event.stopPropagation();
            setMenu(menu === asset.id ? null : asset.id);
            setSelected(asset.id);
          }}
        >
          <MoreHorizontal size={15} />
        </button>
        {menu === asset.id && (
          <div
            className="media-context"
            onClick={(event) => event.stopPropagation()}
          >
            {onPreviewAsset && <button onClick={() => { onPreviewAsset(asset.id);setMenu(null); }}><Play size={13} />  {ui("영상 미리보기", "Preview asset")} </button>}
            <button
              disabled={asset.missing}
              onClick={() => {
                onAddAsset(asset.id);
                setMenu(null);
              }}
            >
              <Plus size={13} />  {ui("타임라인에 추가", "Add to timeline")} </button>
            {onRevealAsset && (
              <button
                onClick={() => {
                  onRevealAsset(asset.id);
                  setMenu(null);
                }}
              >
                <FolderOpen size={13} />{" "}
                {asset.missing ? ui("영상 다시 연결", "Relink asset") : ui("폴더에 표시", "Show in folder")}
              </button>
            )}
            <button
              className="media-context-remove"
              onClick={() => {
                onRemoveAsset(asset.id);
                setMenu(null);
                if (selected === asset.id) setSelected(null);
              }}
            >
              <Trash2 size={13} />  {ui("영상 라이브러리에서 제거", "Remove from library")} </button>
          </div>
        )}
      </div>
    );
  };
  return (
    <section
      className={`media-library ${draggingFiles ? "is-file-drop" : ""}`}
      aria-label={ui("로컬 영상 라이브러리", "Local media library")}
      onDragEnter={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          dragCounter.current++;
          setDraggingFiles(true);
        }
      }}
      onDragLeave={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          dragCounter.current--;
          if (dragCounter.current <= 0) setDraggingFiles(false);
        }
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={dropFiles}
    >
      <input
        ref={fileInput}
        className="media-file-input"
        type="file"
        multiple
        accept="video/*,audio/*,image/*,.mkv,.mov,.mp4,.webm,.mp3,.wav,.aac,.flac,.m4a,.ogg"
        onChange={(event) => {
          receiveFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
      <div className="media-top">
        <div className="media-top-title">
          <FolderOpen size={15} />
          <span> {ui("프로젝트 영상", "Project media")} </span>
          <b>{project.assets.length}</b>
        </div>
        <button
          className="media-import"
          onClick={startImport}
          disabled={importing}
        >
          {importing ? (
            <LoaderCircle size={13} className="media-spin" />
          ) : (
            <Plus size={13} />
          )}{" "}
          {importing ? ui("가져오기", "Importing") : ui("영상 가져오기", "Import media")}
        </button>
      </div>
      <div className="media-tools">
        <div className="media-search">
          <Search size={13} />
          <input
            aria-label={ui("영상 검색", "Search media")}
            placeholder={ui("영상 검색", "Search media")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button aria-label={ui("검색 지우기", "Clear search")} onClick={() => setQuery("")}>
              <X size={12} />
            </button>
          )}
        </div>
        <div className="media-view">
          <button
            title={ui("그리드 보기", "Grid view")}
            aria-label={ui("그리드 보기", "Grid view")}
            className={view === "grid" ? "is-active" : ""}
            onClick={() => setView("grid")}
          >
            <Grid2X2 size={14} />
          </button>
          <button
            title={ui("목록 보기", "List view")}
            aria-label={ui("목록 보기", "List view")}
            className={view === "list" ? "is-active" : ""}
            onClick={() => setView("list")}
          >
            <List size={15} />
          </button>
        </div>
      </div>
      <div className="media-filters" role="tablist" aria-label={ui("자료 유형", "Media types")}>
        {(["all", "video", "audio", "image"] as const).map((value) => (
          <button
            role="tab"
            aria-selected={kind === value}
            key={value}
            className={kind === value ? "is-active" : ""}
            onClick={() => setKind(value)}
          >
            {value === "all"
              ? ui("모두", "All")
              : value === "video"
                ? ui("영상", "Video")
                : value === "audio"
                  ? ui("오디오", "Audio")
                  : ui("사진", "Image")}
            {value !== "all" && (
              <span>
                {project.assets.filter((a) => a.kind === value).length}
              </span>
            )}
          </button>
        ))}
      </div>
      <div
        className={`media-content media-${view}`}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setMenu(null);
            setSelected(null);
          }
        }}
      >
        {filtered.length > 0 ? (
          filtered.map(item)
        ) : project.assets.length > 0 ? (
          <div className="media-empty">
            <Search size={26} />
            <strong> {ui("일치하는 자료 없음", "No matching media")} </strong>
            <p> {ui("다른 키워드 또는 자료 유형 시도", "Try another keyword or media type")} </p>
            <button
              onClick={() => {
                setQuery("");
                setKind("all");
              }}
            >
               {ui("모든 자료 보기", "View all media")} </button>
          </div>
        ) : (
          <div className="media-empty">
            <div className="media-empty-illustration">
              <Film size={31} />
              <Music2 size={18} />
              <FileImage size={19} />
            </div>
            <strong> {ui("여기에 영감을 넣으세요", "Bring your ideas here")} </strong>
            <p>
               {ui("비디오, 오디오 및 사진 가져오기", "Import video, audio and images")} <br />
               {ui("또는 로컬 파일을 직접 드래그", "or drag local files here")} </p>
            <button
              className="media-empty-import"
              onClick={startImport}
              disabled={importing}
            >
              <Upload size={13} /> {importing ? ui("자료 로드 중...", "Loading media…") : ui("영상 가져오기", "Import media")}
            </button>
            <span> {ui("MP4, MOV, MP3, PNG 및 기타 형식 지원", "Supports MP4, MOV, MP3, PNG and more")} </span>
          </div>
        )}
      </div>
      <div className="media-footer">
        <span>{filtered.length}  {ui("자료", "assets")} </span>
        <span> {ui("추가하려면 두 번 클릭하세요. · 타임라인으로 드래그", "Double-click to add · Drag to timeline")} </span>
      </div>
      {draggingFiles && (
        <div className="media-drop-overlay">
          <Upload size={31} />
          <strong> {ui("영상을 가져오려면 해제하세요", "Drop to import media")} </strong>
          <span> {ui("파일은 로컬로 유지됩니다. 언제든지 편집 시작", "Files stay local. Start editing anytime.")} </span>
        </div>
      )}
    </section>
  );
}
