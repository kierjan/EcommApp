## Firebase Setup

This project is prepared for Firebase + Firestore and now supports live syncing, but the app must be opened through `http://localhost`, not `file:///`.

### Step 1. Create the Firebase project

1. Open the Firebase console.
2. Create a new project for this app.
3. Register a Web app inside that project.
4. Copy the Firebase web config object.

Official references:
- https://firebase.google.com/docs/web/setup
- https://firebase.google.com/docs/firestore/quickstart

### Step 2. Enable Firestore

1. In Firebase console, open `Build > Firestore Database`.
2. Click `Create database`.
3. Pick a location close to your users.
4. For initial testing, you can start in test mode.

Important:
- Test mode is only for setup and early development.
- Before production, tighten Firestore security rules.

### Step 2.5. Run the app through localhost

Firebase will not initialize correctly from a `file:///` page in the browser.

Run the local server from this folder:

```powershell
powershell -ExecutionPolicy Bypass -File ".\start-dev-server.ps1"
```

Then open:

- `http://localhost:4173/index.html`

### Step 3. Paste your web config

Open [firebase-config.js](./firebase-config.js) and replace the empty values:

```js
window.FIREBASE_WEB_CONFIG = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.firebasestorage.app",
  messagingSenderId: "1234567890",
  appId: "your-app-id"
};

window.FIREBASE_OPTIONS = {
  enabled: true,
  useFirestore: true
};
```

### What is already prepared

This repo now includes:

- `firebase-config.js`
  - local config file for your Firebase web app settings
- `firebase-service.js`
  - initializes Firebase and Firestore
  - exposes `window.firebaseBridge`
  - includes Firestore-ready methods:
    - `loadDay(dateKey)`
    - `saveDay(dateKey, day)`
    - `loadStore()`
    - `saveStore(store)`
- `start-dev-server.ps1`
  - serves the app at `http://localhost:4173`
- `firestore.rules`
  - safer development rules for the `dailyOrders` collection

### Current Firestore shape

Prepared collection:

- `dailyOrders`

Prepared document ID:

- `YYYY-MM-DD`

Prepared document shape:

```js
{
  dateKey: "2026-04-18",
  approval: {
    preparedBy: "Adrian 1",
    checkedBy: "Larah"
  },
  platforms: {
    Shopee: [],
    Lazada: [],
    TikTok: []
  },
  updatedAt: serverTimestamp()
}
```

### Next step after this

After your Firebase project config is added:

1. run the app through `http://localhost:4173`
2. test add/edit/remove against Firestore
3. replace the fully open Firestore rule with the contents of `firestore.rules`
