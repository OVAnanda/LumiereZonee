PROJECT TITLE
LumiereZone

MEMBERS:
Gero Dingal
Renz Lagnaoda

Course and section: BSIT 2A
Instructor: Arianne Joy Cari-an

SHORT PROJECT DESCRIPTION
LumiereZone is a website for finding anime and keeping track of
what you watch. Visitors can:

  - See the featured title and the anime airing this season
  - Filter the seasonal list with genre chips
  - Browse the 12 most popular anime of any genre from the
    Genre menu in the top navigation
  - Search for any anime by title
  - Open a detail window (synopsis, genres, score, status)
  - Watch the official trailer inside the website
  - Save titles to "My List" and update episode progress with
    the + and - buttons (saved in the browser)

Invalid searches, empty results and failed requests show clear
messages, and the interface offers a Retry button.

DEPLOYED WEBSITE LINK
[FILL IN: paste the deployed website link here]

INSTRUCTIONS FOR ACCESSING / USING THE WEBSITE
Option A - Online (recommended)
  1. Open the deployed website link above in any modern browser
     (Chrome, Edge, Firefox). An internet connection is required.

Option B - Run locally from the Source_Code folder
  1. Do NOT double-click index.html. Browsers block the API
     request when a page is opened as a local file (file://).
  2. Open the Source_Code folder in Visual Studio Code and
     install the "Live Server" extension.
  3. Right-click index.html and choose "Open with Live Server".
     (Alternative: open a terminal in the Source_Code folder,
     run  python -m http.server 5500  and visit
     http://localhost:5500 in the browser.)

How to use
  - Click a poster to open its details.
  - Click "Watch Trailer" to play the trailer in the website.
  - Click "+ Add to My List" to save a title, then use the + and
    - buttons to change your episode progress.
  - Use the Genre menu, the genre chips or the search bar to
    find other titles.

API USED
AniList GraphQL API
  Endpoint : https://graphql.anilist.co
  Docs     : https://docs.anilist.co
  Key      : none required (free, public)

Information retrieved: titles (English, romaji, native), cover
images, average score, episode count, genres, synopsis, airing
status and trailer (YouTube ID).

Trailers are played with the standard YouTube embed player.

OTHER IMPORTANT INFORMATION
Technologies : HTML5, CSS3, JavaScript (ES6), AniList GraphQL
               API, YouTube embed player, localStorage,
               Google Fonts (Bebas Neue, Inter)

Files        : index.html  - page structure
               style.css   - all styling
               script.js   - API requests and all interactivity
               Keep these three files in the same folder.

Notes
  - Anime information, cover art and trailers come from AniList
    and belong to their respective owners.
  - The "My List" is stored in the visitor's own browser
    (localStorage), so it is not shared between devices.
  - LumiereZone does not host or stream anime episodes; it is a
    discovery and tracking website.
  - The project originally used the Jikan API but was switched
    to AniList because Jikan frequently returned 504 timeouts.
