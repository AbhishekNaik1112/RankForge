# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for the RankForge backend sidecar.

Produces backend/dist/rankforge_backend/ with a `rankforge_backend.exe`
entry point and a folder of bundled Python deps. Electron-builder then
pulls this whole folder into the installer's resources.

We use --onedir (NOT --onefile):
- onefile extracts ~700 MB to %TEMP% on every launch (5-10 s slow start
  + Windows AV often kills the launcher process during extraction)
- onedir is the boring, reliable, Windows-AV-friendly path

Build:
    cd backend
    ../.venv/Scripts/python -m PyInstaller --clean --noconfirm build_pyinstaller.spec

Output: backend/dist/rankforge_backend/rankforge_backend.exe
"""
from PyInstaller.utils.hooks import collect_all, collect_submodules

# Packages PyInstaller's import scanner doesn't fully follow on its own.
# `collect_all` returns (hiddenimports, datas, binaries) — we accumulate.
hiddenimports: list[str] = []
datas: list[tuple[str, str]] = []
binaries: list[tuple[str, str]] = []

for pkg in (
    "sentence_transformers",
    "transformers",
    "torch",
    "psycopg",
    "psycopg_pool",
    "pgvector",
    "alembic",
    "pypdf",
    "docx",          # python-docx imports as `docx`
    "pptx",          # python-pptx imports as `pptx`
    "PIL",
    "structlog",
    "uvicorn",
    "fastapi",
    "starlette",
    "pydantic",
    "pydantic_core",
):
    # collect_all returns (datas, binaries, hiddenimports) — note the order.
    d, b, h = collect_all(pkg)
    datas += d
    binaries += b
    hiddenimports += h

# Belt-and-suspenders for things torch/transformers load lazily
hiddenimports += collect_submodules("torch")
hiddenimports += collect_submodules("transformers")

# Project-local data files that aren't auto-detected by import scanning.
# Paths are relative to backend/ (we run pyinstaller from there).
datas += [
    ("alembic.ini", "."),
    ("db/migrations", "db/migrations"),
    ("db/schema.sql", "db"),
]

a = Analysis(
    ["run.py"],
    pathex=["."],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    # Trim the bundle: drop GUI/dev libs we never use
    excludes=[
        "matplotlib",
        "tkinter",
        "jupyter",
        "IPython",
        "notebook",
        "pytest",
        "sphinx",
    ],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="rankforge_backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    # UPX compression trips Windows AV. Disable.
    upx=False,
    console=True,   # keep the console for stdout piping into Electron's [backend] log
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="rankforge_backend",
)
