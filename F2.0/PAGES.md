# F 2.0 public demonstration

The local application remains a Node/WebSocket/PCSC installation. GitHub Pages
runs a separate browser-only simulation adapter and never connects a real reader.

## Public pages

- Wall: https://vistwinproject.github.io/F-wall/
- Table: https://vistwinproject.github.io/F-table/
- iPad: https://vistwinproject.github.io/F-Ipad/

Open all three pages in tabs of the same browser/profile. They must use the same
https://vistwinproject.github.io origin. localStorage shares state and Web Locks
serialize commands. Different computers, browsers or profiles are not synchronized.

Keys 1-9 simulate individual NFC cards; A shows all cards without narration; 0
clears the cards and stops audio. E opens the per-view editor. Positions and tuning
remain private to this browser. The simulation is not an actual equipment monitor.

Table plays appliance narration. iPad plays introduction/completion narration.
Keep Table open for the final appliance narration to release iPad's completion
screen. Browsers may require a click to enable audio; background tabs may throttle
visual animations. A remains a silent visual-only demonstration.

## Deployment

Each repository has an independent v2.0 branch. Its workflow installs the locked
dependencies, runs `node scripts/build-pages.mjs <role>` inside F2.0, uploads only
F2.0/dist and deploys to GitHub Pages. main and its original application source
are not modified. The public Pages URL displays the latest deployed version, not
multiple branches at once. Deploying the old main workflow later can replace it.

Source exports remain relative ES modules. The builder rewrites hosted asset
paths, fixes the view role and substitutes PagesSession only in the deployment
output. Local preview uses Session and the original Node server unchanged.

Do not include real reader/UID maps, environment files or credentials in this
public demonstration. The Pages output contains only web assets and no server.
