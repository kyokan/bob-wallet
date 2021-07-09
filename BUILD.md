# Build Instruction

### MacOS
1. uninstall gmp by running `brew uninstall gmp --ignore-dependencies`
2. run `npm run package`
3. reinstall gmp by running `brew install gmp`
4. notarize `Bob.dmg` by running `xcrun altool --notarize-app --primary-bundle-id "{bunde-id}" --username "{username}"  --password "{password}" --asc-provider "{asc-provider-id}" --file ./release/Bob.dmg`
5. you can check notarization status by running `xcrun altool --notarization-info "{notarization-id}" --username "{username} --password "{password}"`


### Windows
1. Simply build with
   ```sh
   npm run package-win
   ```
2. The `.exe` file will be placed in `./release/`.


### Linux
1. Simply build with
   ```sh
   npm run package-linux
   ```
2. The `.AppImage` file will be placed in `./release/`.
