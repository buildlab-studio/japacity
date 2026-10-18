// Where the game's code and its full account of licences live (docs/rules/guide.md R-GUIDE-008,
// R-GUIDE-010). The one place the repository's address is written out for the game: the Credits
// screen and the terms take it from here.

/** The public repository. */
export const REPOSITORY_URL = "https://github.com/buildlab-studio/japacity";

/** The licences of each part of the game, with the makers and the shipped packages' notices beside it. The game itself links the licence file the build writes beside the page (licenses.txt, R-GUIDE-010), not this address. */
export const LICENCES_URL = `${REPOSITORY_URL}/blob/main/LICENSES.md`;

/** The licence file the build for players writes beside the page, every shipped package with its licence (R-GUIDE-010): what the Credits link. */
export const LICENCES_PATH = "/licenses.txt";

/** The assets register: every asset, whether it was generated, with which tool, and who approved it (R-GUIDE-011). */
export const REGISTER_URL = `${REPOSITORY_URL}/blob/main/assets-src/register.json`;
