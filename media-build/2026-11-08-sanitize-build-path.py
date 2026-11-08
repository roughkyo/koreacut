from pathlib import Path
import argparse
import re

parser = argparse.ArgumentParser(description="Windows 미디어 도구의 컴파일러 경로를 공개용 경로로 바꿉니다.")
parser.add_argument("source", type=Path)
parser.add_argument("output", type=Path)
parser.add_argument("--prefix", required=True)
args = parser.parse_args()
prefix = args.prefix.encode("ascii")
replacement = b"/build/koreacut"
if len(prefix) < len(replacement) or not prefix.startswith(b"/") or b" " in prefix:
    parser.error("공백 없는 절대 빌드 경로를 지정하세요.")
data = args.source.read_bytes()
if data[:2] != b"MZ" or args.source.name not in {"ffmpeg.exe", "ffprobe.exe"}:
    parser.error("대상은 Windows FFmpeg 또는 FFprobe여야 합니다.")
# PE의 위치와 길이는 유지하고, 알려진 구성 문자열의 빌드 루트만 치환한다.
allowed = rb"(?=/prefix(?:-final)?/(?:include|lib)|/toolchain/host|/build-win64/prefix/(?:include|lib))"
pattern = re.compile(re.escape(prefix) + allowed)
public = replacement.ljust(len(prefix), b"_")
result, count = pattern.subn(public, data)
if prefix in result or count == 0 or len(result) != len(data):
    parser.error("예상한 구성 문자열을 찾지 못했거나 다른 위치에 경로가 남았습니다.")
with args.output.open("xb") as out:
    out.write(result)
print(f"{args.source.name}: 빌드 경로 {count}개 치환")

