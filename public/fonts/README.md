# Korean Font Support

To ensure proper Korean text rendering in nametags, you can place Korean font files in this directory.

## Recommended Fonts

1. **Noto Sans KR** (Recommended)
   - Download from: https://fonts.google.com/noto/specimen/Noto+Sans+KR
   - File name: `NotoSansKR-Regular.ttf`

2. **Other Compatible Fonts**
   - Any TrueType font (.ttf) that supports Korean characters
   - Place the font file in this directory
   - Update the registerFont call in the API if using a different filename

## Current Fallback Fonts

The system will automatically try these fonts in order:
1. Noto Sans KR (if available in this directory)
2. Malgun Gothic (Windows)
3. 맑은 고딕 (Windows Korean name)
4. Apple SD Gothic Neo (macOS)
5. Dotum, Gulim, Batang (Legacy Windows Korean fonts)
6. sans-serif (system default)

## Note

If no Korean font is available, the system will still work but Korean characters may appear as squares or missing characters. 