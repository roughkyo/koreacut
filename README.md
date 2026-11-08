# koreacut

**koreacut**은 Windows용 한국어 오프라인 영상 편집기입니다. 여러 트랙에 사진과 영상을 배치하고 자막과 화면 효과를 넣어 MP4로 내보낼 수 있습니다.

## 어떻게 만들었나요?

**Craft Anything v0.5.0**의 심층 모드로 ReaCut v0.7.1 macOS 배포본에 들어 있는 Electron ASAR 파일을 정적 분석했습니다. 확인한 앱 진입점과 내보내기 요청 경로를 공개 소스와 대조한 다음 이 소스로 한국어판 koreacut을 개발했습니다. [ReaCut 원본 프로젝트](https://github.com/Xiangyu-CAS/rea-capcut)의 저작권과 MIT 라이선스는 그대로 유지합니다.

## Windows에서 시작하기

1. 직접 빌드하거나 별도로 받은 `korcapcut.exe` 준비하기. 이 저장소에서는 소스와 작업 기록을 공개합니다.
2. 실행 파일을 열고 **미디어 가져오기**를 눌러 사진이나 영상 열기.
3. 소재를 타임라인에 놓고 편집한 뒤 **내보내기**에서 MP4로 저장하기.

Windows x64 포터블 패키지에는 FFmpeg와 FFprobe가 들어 있습니다. 따로 Node.js나 FFmpeg를 설치할 필요 없이 편집하고 MP4로 내보낼 수 있습니다. 프로젝트를 다른 PC에서 열려면 편집에 쓴 원본 미디어도 함께 옮기세요.

## 소스에서 빌드하기

Node.js 24.11 이상이 필요합니다. [`media-build`](media-build)의 안내에 따라 Windows x64 미디어 도구를 준비한 뒤 `media-tools/win32-x64`에 넣습니다.

```powershell
$tools = 'media-tools/win32-x64'
$pins = @{}
foreach ($name in 'ffmpeg.exe', 'ffprobe.exe') {
    $pins[$name] = (Get-FileHash (Join-Path $tools $name) -Algorithm SHA256).Hash.ToLowerInvariant()
}
$pins | ConvertTo-Json | Set-Content (Join-Path $tools 'SHA256.json') -Encoding utf8
npm ci
npm run build
npx electron-builder --win portable --x64 --publish never
```

## 작업 기록

[분석, 한국어판 구현, Windows 검증 기록](docs/2026-11-08-개발과정.md)

## 라이선스

앱 소스는 MIT 라이선스를 따릅니다. 앱은 FFmpeg와 x264를 별도 프로그램으로 실행하며 각 프로그램에는 GPL 조건이 적용됩니다. 대응 소스, 빌드 방법, 라이선스 파일은 [`media-build`](media-build)에서 확인할 수 있습니다.
