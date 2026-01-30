#!/bin/bash
# bundle-macos-deps.sh
#
# Collects GStreamer, GLib, Python dylibs and GStreamer plugins into a staging
# directory, rewrites all absolute Homebrew install-names to @loader_path /
# @rpath relative references, and re-signs every modified Mach-O binary.
#
# Run from the workspace root (the directory that contains Cargo.toml).
# Prerequisites: Homebrew-installed gstreamer, glib, python@3.12

set -euo pipefail

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGING="$ROOT/target/bundle-staging"
LIBS_DIR="$STAGING/libs"
GST_PLUGINS_DIR="$STAGING/gstreamer-1.0"
GST_HELPERS_DIR="$STAGING/gstreamer-1.0/helpers"
PYTHON_DIR="$STAGING/python3.12"
SERVER_BIN="$ROOT/target/release/server"

ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
  BREW_PREFIX="/opt/homebrew"
else
  BREW_PREFIX="/usr/local"
fi

echo "==> Architecture: $ARCH"
echo "==> Homebrew prefix: $BREW_PREFIX"
echo "==> Staging directory: $STAGING"

# ---------------------------------------------------------------------------
# Clean & create staging directories
# ---------------------------------------------------------------------------
rm -rf "$STAGING"
mkdir -p "$LIBS_DIR" "$GST_PLUGINS_DIR" "$GST_HELPERS_DIR" "$PYTHON_DIR"

# ---------------------------------------------------------------------------
# Helper: resolve a dylib path through symlinks and copy to LIBS_DIR
# ---------------------------------------------------------------------------
copy_lib() {
  local src="$1"
  local dst_name="${2:-$(basename "$src")}"
  if [ ! -f "$LIBS_DIR/$dst_name" ]; then
    local real
    real=$(python3 -c "import os,sys; print(os.path.realpath(sys.argv[1]))" "$src" 2>/dev/null || readlink -f "$src" 2>/dev/null || echo "$src")
    # Use cat to avoid copying extended attributes
    cat "$real" > "$LIBS_DIR/$dst_name"
    chmod 644 "$LIBS_DIR/$dst_name"
    echo "    copied $dst_name"
  fi
}

# ---------------------------------------------------------------------------
# Helper: recursively collect non-system dylib dependencies
# ---------------------------------------------------------------------------
collect_deps() {
  local binary="$1"
  local deps
  deps=$(otool -L "$binary" 2>/dev/null | tail -n +2 | awk '{print $1}')

  local dep bn
  while IFS= read -r dep; do
    [ -z "$dep" ] && continue
    # Only process Homebrew (non-system) libraries
    if [[ "$dep" == /opt/homebrew/* ]] || [[ "$dep" == /usr/local/Cellar/* ]] || [[ "$dep" == /usr/local/opt/* ]]; then
      bn=$(basename "$dep")
      if [ ! -f "$LIBS_DIR/$bn" ]; then
        copy_lib "$dep" "$bn"
        # Recurse into the newly copied library
        collect_deps "$LIBS_DIR/$bn"
      fi
    fi
  done <<< "$deps"
}

# ---------------------------------------------------------------------------
# 1. Collect GStreamer core libraries
# ---------------------------------------------------------------------------
echo "==> Collecting GStreamer core libraries..."
GST_CORE_LIBS=(
  libgstreamer-1.0.0.dylib
  libgstbase-1.0.0.dylib
  libgstapp-1.0.0.dylib
  libgstvideo-1.0.0.dylib
  libgstaudio-1.0.0.dylib
  libgsttag-1.0.0.dylib
  libgstrtp-1.0.0.dylib
  libgstrtsp-1.0.0.dylib
  libgstsdp-1.0.0.dylib
  libgstnet-1.0.0.dylib
  libgstpbutils-1.0.0.dylib
  libgstcodecparsers-1.0.0.dylib
)

for lib in "${GST_CORE_LIBS[@]}"; do
  src="$BREW_PREFIX/lib/$lib"
  if [ ! -f "$src" ]; then
    # Try the opt path
    src=$(find "$BREW_PREFIX/opt/gstreamer" -name "$lib" -type f 2>/dev/null | head -1)
  fi
  if [ -n "$src" ] && [ -f "$src" ]; then
    copy_lib "$src" "$lib"
  else
    echo "    WARNING: $lib not found, skipping"
  fi
done

# ---------------------------------------------------------------------------
# 2. Collect GLib libraries
# ---------------------------------------------------------------------------
echo "==> Collecting GLib libraries..."
GLIB_LIBS=(libglib-2.0.0.dylib libgobject-2.0.0.dylib libgmodule-2.0.0.dylib libgio-2.0.0.dylib)
for lib in "${GLIB_LIBS[@]}"; do
  src="$BREW_PREFIX/lib/$lib"
  if [ ! -f "$src" ]; then
    src=$(find "$BREW_PREFIX/opt/glib" -name "$lib" -type f 2>/dev/null | head -1)
  fi
  if [ -n "$src" ] && [ -f "$src" ]; then
    copy_lib "$src" "$lib"
  else
    echo "    WARNING: $lib not found, skipping"
  fi
done

# ---------------------------------------------------------------------------
# 3. Collect other shared dependencies
# ---------------------------------------------------------------------------
echo "==> Collecting other shared dependencies..."
OTHER_DEPS=(
  "gettext/lib/libintl.8.dylib"
  "pcre2/lib/libpcre2-8.0.dylib"
  "orc/lib/liborc-0.4.0.dylib"
  "libiconv/lib/libiconv.2.dylib"
)
for rel in "${OTHER_DEPS[@]}"; do
  src="$BREW_PREFIX/opt/$rel"
  bn=$(basename "$rel")
  if [ -f "$src" ]; then
    copy_lib "$src" "$bn"
  else
    echo "    WARNING: $bn not found at $src, skipping"
  fi
done

# ---------------------------------------------------------------------------
# 4. Collect Python framework dylib
# ---------------------------------------------------------------------------
echo "==> Collecting Python 3.12 framework..."
PYTHON_FW="$BREW_PREFIX/opt/python@3.12/Frameworks/Python.framework/Versions/3.12"
if [ -d "$PYTHON_FW" ]; then
  cat "$PYTHON_FW/Python" > "$LIBS_DIR/Python"
  chmod 644 "$LIBS_DIR/Python"
  ln -sf Python "$LIBS_DIR/libpython3.12.dylib"
  echo "    copied Python framework dylib"
else
  echo "    WARNING: Python 3.12 framework not found"
fi

# ---------------------------------------------------------------------------
# 5. Recursively collect transitive dependencies
# ---------------------------------------------------------------------------
echo "==> Collecting transitive dependencies..."
# Run multiple passes until no new libs are discovered
for _ in 1 2 3 4 5; do
  before=$(ls "$LIBS_DIR" | wc -l)
  for f in "$LIBS_DIR"/*.dylib "$LIBS_DIR"/Python; do
    [ -f "$f" ] && collect_deps "$f"
  done
  after=$(ls "$LIBS_DIR" | wc -l)
  if [ "$before" -eq "$after" ]; then
    break
  fi
done
echo "    Total libs collected: $(ls "$LIBS_DIR" | wc -l)"

# ---------------------------------------------------------------------------
# 6. Collect GStreamer plugins
# ---------------------------------------------------------------------------
echo "==> Collecting GStreamer plugins..."
GST_PLUGINS=(
  libgstcoreelements.dylib
  libgstapp.dylib
  libgstapplemedia.dylib
  libgstrtsp.dylib
  libgstrtp.dylib
  libgstrtpmanager.dylib
  libgstvideoconvertscale.dylib
  libgstvideoparsersbad.dylib
)

GST_PLUGIN_SEARCH="$BREW_PREFIX/lib/gstreamer-1.0"
if [ ! -d "$GST_PLUGIN_SEARCH" ]; then
  GST_PLUGIN_SEARCH=$(find "$BREW_PREFIX/opt/gstreamer" -type d -name "gstreamer-1.0" 2>/dev/null | head -1)
fi

for plugin in "${GST_PLUGINS[@]}"; do
  src="$GST_PLUGIN_SEARCH/$plugin"
  if [ -f "$src" ]; then
    cat "$src" > "$GST_PLUGINS_DIR/$plugin"
    chmod 644 "$GST_PLUGINS_DIR/$plugin"
    echo "    copied plugin $plugin"
  else
    echo "    WARNING: plugin $plugin not found"
  fi
done

# Collect transitive deps of plugins too
echo "==> Collecting plugin transitive dependencies..."
for f in "$GST_PLUGINS_DIR"/*.dylib; do
  [ -f "$f" ] && collect_deps "$f"
done

# ---------------------------------------------------------------------------
# 7. Collect gst-plugin-scanner
# ---------------------------------------------------------------------------
echo "==> Collecting gst-plugin-scanner..."
GST_SCANNER=""
# Try common locations for gst-plugin-scanner
for candidate in \
  "$BREW_PREFIX/libexec/gstreamer-1.0/gst-plugin-scanner" \
  "$BREW_PREFIX/opt/gstreamer/libexec/gstreamer-1.0/gst-plugin-scanner" \
  "$BREW_PREFIX/lib/gstreamer-1.0/gst-plugin-scanner"; do
  if [ -f "$candidate" ]; then
    GST_SCANNER="$candidate"
    break
  fi
done
# Fallback: search broadly
if [ -z "$GST_SCANNER" ]; then
  GST_SCANNER=$(find "$BREW_PREFIX" -name "gst-plugin-scanner" -type f 2>/dev/null | head -1)
fi
if [ -n "$GST_SCANNER" ] && [ -f "$GST_SCANNER" ]; then
  cat "$GST_SCANNER" > "$GST_HELPERS_DIR/gst-plugin-scanner"
  chmod 755 "$GST_HELPERS_DIR/gst-plugin-scanner"
  echo "    copied gst-plugin-scanner from $GST_SCANNER"
else
  echo "    WARNING: gst-plugin-scanner not found anywhere under $BREW_PREFIX"
fi

# ---------------------------------------------------------------------------
# 8. Collect minimal Python stdlib
# ---------------------------------------------------------------------------
echo "==> Collecting Python 3.12 stdlib..."
PYTHON_STDLIB="$PYTHON_FW/lib/python3.12"
if [ -d "$PYTHON_STDLIB" ]; then
  # Use tar to copy without extended attributes
  tar -cf - -C "$PYTHON_STDLIB" . | tar -xf - -C "$PYTHON_DIR"
  # Remove unnecessary parts to save space
  rm -rf "$PYTHON_DIR/test" \
         "$PYTHON_DIR/tkinter" \
         "$PYTHON_DIR/__pycache__" \
         "$PYTHON_DIR/ensurepip" \
         "$PYTHON_DIR/idlelib" \
         "$PYTHON_DIR/turtledemo" \
         "$PYTHON_DIR/lib2to3" \
         "$PYTHON_DIR/distutils" \
         "$PYTHON_DIR/unittest" \
         "$PYTHON_DIR/pydoc_data" \
         "$PYTHON_DIR/turtle.py" \
         "$PYTHON_DIR/doctest.py"
  # Replace dead symlinks (copied from Homebrew) with empty dirs or remove them
  find "$PYTHON_DIR" -type l ! -exec test -e {} \; -print | while IFS= read -r link; do
    rm "$link"
    # If the symlink name suggests a directory (like site-packages), create one
    if [[ "$(basename "$link")" != *.* ]]; then
      mkdir -p "$link"
    fi
  done
  echo "    copied Python stdlib (trimmed)"
else
  echo "    WARNING: Python stdlib not found at $PYTHON_STDLIB"
fi

# ---------------------------------------------------------------------------
# 9. Rewrite install_names
# ---------------------------------------------------------------------------
echo "==> Rewriting install_names for bundled libs..."

rewrite_deps() {
  local binary="$1"
  local target_prefix="$2"

  # Collect deps first to avoid subshell issues with piped while-read
  local deps
  deps=$(otool -L "$binary" 2>/dev/null | tail -n +2 | awk '{print $1}')

  local dep bn
  while IFS= read -r dep; do
    if [[ "$dep" == /opt/homebrew/* ]] || [[ "$dep" == /usr/local/Cellar/* ]] || [[ "$dep" == /usr/local/opt/* ]]; then
      bn=$(basename "$dep")
      install_name_tool -change "$dep" "${target_prefix}/${bn}" "$binary" 2>/dev/null || true
    fi
  done <<< "$deps"
}

# Rewrite each lib in libs/
for f in "$LIBS_DIR"/*.dylib "$LIBS_DIR"/Python; do
  [ -f "$f" ] || continue
  bn=$(basename "$f")
  # Set the library's own id
  install_name_tool -id "@loader_path/$bn" "$f" 2>/dev/null || true
  # Rewrite references to other libs
  rewrite_deps "$f" "@loader_path"
done

# Rewrite each plugin (use rewrite_deps function to avoid 'local' in subshell)
for f in "$GST_PLUGINS_DIR"/*.dylib; do
  [ -f "$f" ] || continue
  bn=$(basename "$f")
  install_name_tool -id "@loader_path/$bn" "$f" 2>/dev/null || true
  # Plugins reference core libs in ../libs/ relative to their location
  rewrite_deps "$f" "@loader_path/../libs"
done

# Rewrite gst-plugin-scanner
GST_SCANNER_BIN="$GST_HELPERS_DIR/gst-plugin-scanner"
if [ -f "$GST_SCANNER_BIN" ]; then
  rewrite_deps "$GST_SCANNER_BIN" "@loader_path/../../libs"
fi

# Rewrite the server binary
echo "==> Rewriting install_names for server binary..."
if [ -f "$SERVER_BIN" ]; then
  # Add rpath pointing to Resources/libs in the app bundle
  # Remove existing rpath first if it exists, then add
  install_name_tool -add_rpath "@executable_path/../Resources/libs" "$SERVER_BIN" 2>/dev/null || true

  # Change absolute Homebrew refs to @rpath
  rewrite_deps "$SERVER_BIN" "@rpath"
fi

# ---------------------------------------------------------------------------
# 10. Re-sign all modified Mach-O binaries (required for arm64)
# ---------------------------------------------------------------------------
echo "==> Re-signing all binaries..."
find "$STAGING" -type f \( -name "*.dylib" -o -name "Python" -o -name "gst-plugin-scanner" \) | while read -r f; do
  codesign --force --sign - "$f" 2>/dev/null || true
done

if [ -f "$SERVER_BIN" ]; then
  codesign --force --sign - "$SERVER_BIN" 2>/dev/null || true
fi

# ---------------------------------------------------------------------------
# 11. Fix file permissions (required for Tauri build to copy files)
# ---------------------------------------------------------------------------
echo "==> Fixing file permissions..."
chmod -R u+w "$STAGING"

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
echo ""
echo "==> Bundle staging complete!"
echo "    Libs:    $(ls "$LIBS_DIR" | wc -l | tr -d ' ') files"
echo "    Plugins: $(ls "$GST_PLUGINS_DIR"/*.dylib 2>/dev/null | wc -l | tr -d ' ') files"
echo "    Python:  $(du -sh "$PYTHON_DIR" 2>/dev/null | awk '{print $1}')"
echo "    Staging: $STAGING"
