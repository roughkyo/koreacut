#!/usr/bin/env sh
set -eu
# Ubuntu 26.04 x64 또는 WSL에서 실행합니다.
# 필요 도구: make, nasm, pkg-config, GCC, gcc-mingw-w64-x86-64-posix, binutils-mingw-w64-x86-64, mingw-w64-x86-64-dev
root="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cd "$root"
sha256sum -c SHA256-SOURCES.txt
mkdir "$root/build-win64"
cd "$root/build-win64"
tar xf ../x264-b35605ac.tar.gz
tar xf ../ffmpeg-9.0.2.tar.xz
tar xf ../zlib-1.4.tar.xz
export PKG_CONFIG_LIBDIR="$PWD/prefix/lib/pkgconfig"
export PKG_CONFIG_PATH="$PKG_CONFIG_LIBDIR"
prefix="$PWD/prefix"
cd x264-b35605ace3ddf7c1a5d67a2eb553f034aef41d55
CC=x86_64-w64-mingw32-gcc-posix ./configure --host=x86_64-w64-mingw32 --cross-prefix=x86_64-w64-mingw32- --prefix="$prefix" --enable-static --disable-cli --disable-opencl
make -j 6
make install
cd ../zlib-1.4
make -f win32/Makefile.gcc PREFIX=x86_64-w64-mingw32- -j 6 libz.a
cp libz.a "$prefix/lib/"
cp zlib.h zconf.h "$prefix/include/"
cd ../ffmpeg-9.0.2
./configure --arch=x86_64 --target-os=mingw32 --cross-prefix=x86_64-w64-mingw32- --cc=x86_64-w64-mingw32-gcc-posix --host-cc=gcc --enable-cross-compile --enable-gpl --enable-libx264 --enable-zlib --extra-cflags="-I$prefix/include" --enable-static --disable-shared --disable-autodetect --disable-network --disable-protocols --enable-protocol=file,pipe --disable-doc --disable-ffplay --disable-debug --pkg-config=pkgconf --pkg-config-flags=--static --extra-ldflags="-static -L$prefix/lib"
make -j 12 ffmpeg.exe ffprobe.exe
printf '%s\n' "$PWD/ffmpeg.exe" "$PWD/ffprobe.exe"
