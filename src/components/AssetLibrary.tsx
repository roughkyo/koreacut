import { localizeMessage } from "../i18n/messages";
import { useLibraryLabel } from "./libraryLabels";
import { useUITranslation } from "../i18n";
import { useEffect, useRef, useState } from "react";
import { AudioLines, Check, LoaderCircle, Pause, Play, Plus, Search, X } from "lucide-react";
import { BUILTIN_ASSETS, BUILTIN_CATEGORIES, builtinAssetUrl, type BuiltinAsset, type BuiltinAssetCategory } from "../core/builtinAssets";
import "./AssetLibrary.css";
export interface AssetLibraryProps {
  onAdd: (asset: BuiltinAsset) => void | Promise<void>;
  addingId?: string | null;
}
export default function AssetLibrary({ onAdd, addingId }: AssetLibraryProps) {
  const ui = useUITranslation();
  const label = useLibraryLabel();
  const [category, setCategory] = useState<BuiltinAssetCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const [recent, setRecent] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { audio.current?.pause(); if (addedTimer.current) clearTimeout(addedTimer.current); }, []);
  useEffect(() => { audio.current?.pause(); audio.current = null; setPlaying(null); }, [category, query]);
  const filtered = BUILTIN_ASSETS.filter(asset => (category === "all" || asset.category === category) && `${asset.name} ${label(asset.name)} ${asset.tags.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase())).map(asset => ({ ...asset, name: label(asset.name) }));
  const busy = addingId || pending;
  const previewSound = async (asset: BuiltinAsset) => {
    audio.current?.pause();
    if (playing === asset.id) { audio.current = null; setPlaying(null); return; }
    const element = new Audio(builtinAssetUrl(asset));
    element.volume = 0.55;
    audio.current = element;
    element.onended = () => { if (audio.current === element) setPlaying(null); };
    element.onerror = () => { if (audio.current === element) { setPlaying(null); setError(ui("음향 효과를 일시적으로 재생할 수 없습니다. 다시 시도해 주세요.", "Cannot play this sound. Please try again.")); } };
    try { await element.play(); if (audio.current === element) setPlaying(asset.id); } catch { if (audio.current === element) setError(ui("음향 효과를 일시적으로 재생할 수 없습니다. 다시 시도해 주세요.", "Cannot play this sound. Please try again.")); }
  };
  const add = async (asset: BuiltinAsset) => {
    if (busy) return;
    setPending(asset.id); setError("");
    try {
      await onAdd(asset); setRecent(asset.id);
      if (addedTimer.current) clearTimeout(addedTimer.current);
      addedTimer.current = setTimeout(() => setRecent(null), 1800);
    } catch (reason) { setError(reason instanceof Error ? reason.message : ui("자료 추가에 실패했습니다. 다시 시도해 주세요.", "Could not add the asset. Please try again.")); }
    finally { setPending(null); }
  };
  return <section className="builtin-library" aria-label={ui("원작 자료 라이브러리", "Original asset library")}>
    <header className="builtin-header"><div><strong> {ui("영감 자료", "Creative assets")} </strong><span>{BUILTIN_ASSETS.length}  {ui("원작 항목 · 오프라인 사용 가능", "original assets · Available offline")} </span></div><span className="builtin-offline"> {ui("내장", "Included")} </span></header>
    <label className="builtin-search"><Search size={14} /><input aria-label={ui("원본 자료 검색", "Search original assets")} placeholder={ui("스티커, 배경, 음향 효과 검색...", "Search stickers, backgrounds, sounds…")} value={query} onChange={e => setQuery(e.target.value)} />{query && <button aria-label={ui("명확한 자료 검색", "Clear asset search")} onClick={() => setQuery("")}><X size={13}/></button>}</label>
    <div className="builtin-categories" role="tablist" aria-label={ui("원본 자료 분류", "Original asset categories")}>
      {[{id: "all" as const, name: ui("모두", "All")}, ...BUILTIN_CATEGORIES].map(item => <button key={item.id} role="tab" aria-selected={category === item.id} onClick={() => setCategory(item.id)}>{label(item.name)}</button>)}
    </div>
    {error && <p className="builtin-error" role="alert">{localizeMessage(error)}</p>}
    <div className="builtin-results">
      {category === "titles" && <p className="builtin-hint"> {ui("투명 베이스 플레이트를 영상에 중첩할 수 있으며, 편집 가능한 텍스트를 추가할 수 있습니다.", "Overlay a transparent title plate on video, then add editable text.")} </p>}
      {filtered.length === 0 ? <div className="builtin-empty"><Search size={25}/><strong> {ui("자료 없음", "No assets found")} </strong><span> {ui("\"별빛\" \"여행\" 또는 \"전환\"을 시도해보세요", "Try “sparkle”, “travel” or “transition”")} </span><button onClick={() => {setQuery("");setCategory("all");}}> {ui("모두 보기", "View all")} </button></div> : <div className="builtin-grid">{filtered.map(asset => <article className={`builtin-card builtin-${asset.category}`} key={asset.id} data-builtin-id={asset.id}>
        {asset.kind === "audio" ? <button className="builtin-preview builtin-audio" aria-label={`${playing === asset.id ? ui("중지", "Stop") : ui("듣기", "Preview")} ${asset.name}`} onClick={() => void previewSound(asset)}><AudioLines size={32}/><span className="builtin-play">{playing === asset.id ? <Pause size={13}/> : <Play size={13}/>}</span><small>{asset.duration.toFixed(2)}s</small></button> : <div className={`builtin-preview ${asset.transparent ? "builtin-alpha" : ""}`}><img src={builtinAssetUrl(asset)} alt={asset.name} loading="lazy" draggable={false}/>{asset.transparent && <small> {ui("투명", "Transparent")} </small>}</div>}
        <div className="builtin-card-footer"><div><strong title={asset.name}>{asset.name}</strong><span>{asset.kind === "audio" ? ui("합성 음향 효과", "Synthesized sound") : asset.category === "titles" ? ui("투명 베이스 플레이트", "Transparent title plate") : asset.category === "backgrounds" ? "1920 × 1080" : ui("투명 스티커", "Transparent sticker")}</span></div><button aria-label={ui(`추가 ${asset.name}`, `Add ${asset.name}`)} title={ui("재생 위치에 추가", "Add at playhead")} disabled={!!busy} onClick={() => void add(asset)}>{busy === asset.id ? <LoaderCircle size={15} className="builtin-spin"/> : recent === asset.id ? <Check size={15}/> : <Plus size={15}/>}</button></div>
      </article>)}</div>}
    </div>
    <footer className="builtin-footer"><span>{filtered.length}  {ui("자료", "assets")} </span><span> {ui("원본 · MIT 라이센스 · 비디오에 사용 가능", "Original · MIT licensed · Use in your videos")} </span></footer>
  </section>;
}
