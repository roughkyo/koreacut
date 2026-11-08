#!/usr/bin/env sh
set -eu
# 공개 배포판을 구성하는 소스를 같은 버전으로 받습니다.
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
fetch() {
  if [ ! -f "$2" ]; then
    curl --fail --location --retry 2 "$1" --output "$2"
  fi
}
fetch https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.xz ffmpeg-9.0.2.tar.xz
fetch https://code.videolan.org/videolan/x264/-/archive/b35605ace3ddf7c1a5d67a2eb553f034aef41d55/x264-b35605ace3ddf7c1a5d67a2eb553f034aef41d55.tar.gz x264-b35605ac.tar.gz
fetch https://zlib.net/zlib-1.4.tar.xz zlib-1.4.tar.xz
sha256sum -c SHA256-SOURCES.txt
sh ./2026-11-08-build-media.sh
