# LCAutoSheetTS

Typescript Node server that auto-fills a designed Spreadsheet.

# Running LCAutoSheetTS

### Pre-requisites

To run this you'll need:
- Node and Npm
- A Google Sheets API OAuth setup:
- - Allow `http://localhost:8000` origin
- - Redirect to `http://localhost:8000/oauth/callback`

### Step 1: Clone the Repository

Either run 

```git clone https://github.com/MakuAureo/LCAutoSheetTS.git```

or download the repository

### Step 2: Setup the Config File

Rename `config.example.ts` to `config.ts` and fill in the necessary fields

#### Config File
``` config.js
// App config
export const CLIENT_ID            = "PUT_YOUR_API_KEY";
export const CLIENT_SECRET        = "PUT_YOUR_CLIENT_SECRET";
export const SPREADSHEET_ID       = "PUT_YOUR_SHEET_ID";
export const ACTIVE_SHEET_NAME    = "PUT_YOUR_SHEET_NAME";

// In sheet config
export const QUOTA_COLUMN         = "B";
export const START_STATS_COLUMN   = "D";
export const SELL_COLUMN          = "AE";
export const START_PLAYERS_COLUMN = "AF";
export const PLAYER_NAME_COLUMN   = "AJ";

// Port config
export const MOD_PORT    = 2145;
export const SERVER_PORT = 8000;
```

### Step 3: Install dependecies

Run `npm install` in this directory

### Step 4: Running the Server

Run the local server

``` run.sh
node index.ts
```

### Step 5 (Optional): Customization

You can check out the browser page by going to: http://localhost:8000 in your browser.

If you add a `bg.png` image to `/public` it will be set as your background.

If you add a `favicon.ico` image to `/public` it will be set as your tab icon.

And you're done!
