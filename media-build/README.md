# Windows x64 미디어 도구 빌드

koreacut은 FFmpeg 9.0.2와 FFprobe를 별도 프로세스로 실행합니다. FFmpeg 빌드에는 x264 및 zlib 1.4를 정적으로 연결합니다.

1. Ubuntu 26.04 x64 또는 WSL에 GCC, Make, NASM, pkgconf, curl, MinGW-w64 x64 POSIX GCC 및 binutils를 준비합니다.
2. 이 폴더에서 `sh ./2026-11-08-fetch-and-build.sh`를 실행합니다. 다운로드한 원본의 SHA-256을 확인한 뒤 빌드합니다.
3. 출력된 두 EXE를 앱 소스의 `media-tools/win32-x64/`에 복사합니다. 이 폴더의 `FFmpeg-GPL-2.0.txt`, `x264-GPL-2.0.txt`, `zlib-LICENSE.txt`와 `2026-11-08-미디어도구-고지.txt`도 같은 위치에 복사합니다.
4. 상위 README에 나온 명령으로 `SHA256.json`을 만든 뒤 Windows 포터블 앱을 빌드합니다.

내장 바이너리를 배포할 때는 이 버전의 대응 소스와 빌드 안내, 라이선스를 함께 제공합니다. FFmpeg의 JPEG 처리 일부는 Independent JPEG Group의 작업을 바탕으로 합니다.


공개용 빌드에서는 바이너리의 버전 정보에 남은 컴파일러 작업 경로를 점검합니다. 개인 경로가 확인되면 `2026-11-08-sanitize-build-path.py`로 알려진 구성 문자열만 치환한 뒤 체크섬을 새로 만들고 실행과 내보내기를 다시 검증합니다.
