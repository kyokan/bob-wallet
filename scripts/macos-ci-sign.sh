set -e

if command -v rcodesign &> /dev/null; then
    # If rcodesign is in PATH, call it directly
    program="rcodesign"
else
    # If not, check if a path was provided as first argument
    if [[ -n "$1" && "$1" == *rcodesign ]]; then
        # If a path was provided, call rcodesign with that path
        program="$1"
    else
        # If no path was provided, print an error message
        echo "Error: rcodesign not found in PATH and no path provided as argument" >&2
        echo "Usage: ./macos-ci-sign.sh [</path/to/rcodesign>]" >&2
        exit 1
    fi
fi

entitlements="`pwd`/resources/entitlements.plist"
release_dir="`pwd`/release/Bob.app"

echo "using rcodesign: $program"
echo "using entitlements: $entitlements"
echo "using release_dir: $release_dir"

# Sign
echo "[*] Signing..."

additional_files=(
    "Contents/Resources/app.asar.unpacked/node_modules/leveldown/build/Release/leveldown.node"
    "Contents/Resources/app.asar.unpacked/node_modules/leveldown/build/node_gyp_bins/python3"
    "Contents/Resources/app.asar.unpacked/node_modules/leveldown/prebuilds/darwin-x64/node.napi.node"
    "Contents/Resources/app.asar.unpacked/node_modules/mrmr/build/Release/mrmr.node"
    "Contents/Resources/app.asar.unpacked/node_modules/mrmr/build/node_gyp_bins/python3"
    "Contents/Resources/app.asar.unpacked/node_modules/node-hid/build/Release/HID.node"
    "Contents/Resources/app.asar.unpacked/node_modules/node-hid/build/node_gyp_bins/python3"
    "Contents/Resources/app.asar.unpacked/node_modules/bdb/build/Release/leveldown.node"
    "Contents/Resources/app.asar.unpacked/node_modules/bdb/build/node_gyp_bins/python3"
    "Contents/Resources/app.asar.unpacked/node_modules/bcrypto/build/Release/bcrypto.node"
    "Contents/Resources/app.asar.unpacked/node_modules/bcrypto/build/node_gyp_bins/python3"
    "Contents/Frameworks/Squirrel.framework/Versions/A/Resources/ShipIt"
    "Contents/Frameworks/Electron\ Framework.framework/Versions/A/Libraries/libffmpeg.dylib"
)

# Sign each file individally, rcodesign does not pick them up (bug)
echo "[*] Signing ${#additional_files[@]} additional files first..."
for s in "${additional_files[@]}"; do
    $program sign --remote-signer --remote-public-key-pem-file /tmp/signing_public_key.pem --code-signature-flags runtime --entitlements-xml-path $entitlements $release_dir/$s
done

echo "[*] Signing final bundle..."
$program sign --remote-signer --remote-public-key-pem-file /tmp/signing_public_key.pem --code-signature-flags runtime --entitlements-xml-path $entitlements $release_dir

# Notarize
echo "[*] Notarizing..."
$program notary-submit --api-key-path /tmp/appstoreconnect_key.json --staple $release_dir

echo "[*] Done."
