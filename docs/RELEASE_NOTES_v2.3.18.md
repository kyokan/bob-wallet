# Bob LearnHNS v2.3.18 - acceptance candidate

This is a draft for a signed acceptance build. It is not a published release. Mike reviewed the interface with isolated fixtures only. He still needs to confirm this exact installed app before any publication.

## Changes since v2.3.17

- Register All uses one panel, keeps the leave-page warning, and leaves recovery visible. A fresh eligibility read happens before the password prompt. Unknown transaction outcomes stay locked.
- Auction summary loading is bounded. The screen keeps loading, failed, and ready states distinct, and it does not present zero as a finished result while the calculation is still running.
- Name display stays conservative for unsafe or invisible encodings. DNS records for an owned name appear before the Shakedex and ShakeX selling options.
- The localized wallet balance guide link is included.

## Acceptance and limits

- The reviewed fixtures were isolated. No live wallet, seed phrase, real funds, or DNS write was part of that review. The installed app Mike already has is still v2.3.17 until he installs this package.
- Windows and Linux packages from the usual build are checksum artifacts. They are not a substitute for installation testing.
- Back up wallet profiles and local Shakedex proof or listing files before any real upgrade. A seed phrase does not restore those local marketplace files.
- Publication stays on hold until Mike confirms the installed app. Preserve the v2.3.17 tag and release assets.
