# Build Instruction

### MacOS
1. uninstall gmp by running `brew uninstall gmp --ignore-dependencies`
2. run `npm run package`
3. reinstall gmp by running `brew install gmp`
4. notarize `Bob.dmg` by running `xcrun altool --notarize-app --primary-bundle-id "{bunde-id}" --username "{username}"  --password "{password}" --asc-provider "{asc-provider-id}" --file ./release/Bob.dmg`
5. you can check notarization status by running `xcrun altool --notarization-info "{notarization-id}" --username "{username} --password "{password}"`


### Window
1. simple run `npm run package-win`
