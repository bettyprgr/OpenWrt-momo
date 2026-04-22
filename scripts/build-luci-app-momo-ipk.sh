#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PKG_DIR="$REPO_ROOT/luci-app-momo"
MAKEFILE="$PKG_DIR/Makefile"
DIST_DIR="$REPO_ROOT/dist"

pkg_version="$(awk -F':=' '/^PKG_VERSION:=/{gsub(/[[:space:]]/,"",$2); print $2; exit}' "$MAKEFILE")"
pkg_release="$(awk -F':=' '/^PKG_RELEASE:=/{gsub(/[[:space:]]/,"",$2); print $2; exit}' "$MAKEFILE")"

if [[ -z "${pkg_version:-}" || -z "${pkg_release:-}" ]]; then
  echo "ERROR: PKG_VERSION/PKG_RELEASE not found in $MAKEFILE" >&2
  exit 1
fi

pkg_name="luci-app-momo"
pkg_full_version="${pkg_version}-r${pkg_release}"
out_ipk="$DIST_DIR/${pkg_name}_${pkg_full_version}_all.ipk"

mkdir -p "$DIST_DIR"
workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

mkdir -p "$workdir/rootfs"
cp -a "$PKG_DIR/root/." "$workdir/rootfs/"
mkdir -p "$workdir/rootfs/www/luci-static/resources"
cp -a "$PKG_DIR/htdocs/luci-static/resources/." "$workdir/rootfs/www/luci-static/resources/"

installed_kb="$(du -sk "$workdir/rootfs" | awk '{print $1}')"
installed_size="$((installed_kb * 1024))"

cat > "$workdir/control" <<EOF
Package: ${pkg_name}
Version: ${pkg_full_version}
Depends: libc, luci-base, momo
Source: ${PKG_DIR}
SourceName: ${pkg_name}
Section: luci
URL: https://github.com/openwrt/luci
Maintainer: OpenWrt LuCI community
Architecture: all
Installed-Size: ${installed_size}
Description:  LuCI Support for momo
EOF

printf '2.0\n' > "$workdir/debian-binary"

(
  cd "$workdir"
  tar -czf control.tar.gz control
  tar -czf data.tar.gz -C rootfs usr www
  # Build as gzipped tar to match OpenWrt feed artifacts expected by opkg on target routers.
  tar -czf "$out_ipk" debian-binary control.tar.gz data.tar.gz
)

echo "Built: $out_ipk"
