# btd6ctplanner
Contested Territory planner for BTD6

## Project structure

Application code lives in [`src/`](src/):

- [`main.jsx`](src/main.jsx) is the browser entry point.
- [`App.jsx`](src/App.jsx) contains the main React view.
- [`api.js`](src/api.js) contains API access and response normalization.
- [`layout.js`](src/layout.js) contains board geometry and tile placement.
- [`styles.css`](src/styles.css) contains application styles.
- [`firebase.js`](src/firebase.js) provides shared Firestore tile markings.

The Vite configuration and HTML entry point remain at the repository root.

## Firebase setup

The app stores shared tile marks in Cloud Firestore under:

```text
events/{eventId}/marks/{tileId}
```

Copy `.env.example` to `.env.local` and fill in the Firebase web app configuration. `.env.local` is ignored by Git. The Firebase web configuration is intended for browser use; never put service-account credentials in this project.

Create a Firestore database for the Firebase project and deploy [`firestore.rules`](firestore.rules). The current rules allow anyone to read and write marks, matching the current public marking behavior. Restrict writes with Firebase Authentication before using this for an untrusted public audience.

To deploy the rules from this repository, install the Firebase CLI, sign in, and run:

```text
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

The project is configured in [`.firebaserc`](.firebaserc) and [`firebase.json`](firebase.json). If Firestore has not been created yet, create it in the Firebase Console first, choosing the default database.

When deploying to GitHub Pages, provide the `VITE_FIREBASE_*` values as the build environment variables so the generated static site can connect to Firestore.
