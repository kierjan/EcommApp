import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const COLLECTION_NAME = "dailyOrders";

const defaultBridge = {
  status: "disabled",
  configured: false,
  app: null,
  db: null,
  error: null,
  async loadDay() {
    return null;
  },
  async saveDay() {
    return null;
  },
  async loadStore() {
    return {};
  },
  async saveStore() {
    return null;
  }
};

window.firebaseBridge = defaultBridge;

const config = window.FIREBASE_WEB_CONFIG || {};
const options = window.FIREBASE_OPTIONS || {};
const isConfigured = options.enabled && isValidFirebaseConfig(config);

if (!isConfigured) {
  window.firebaseBridge = {
    ...defaultBridge,
    configured: false,
    status: options.enabled ? "incomplete-config" : "disabled"
  };
  window.dispatchEvent(new CustomEvent("firebase-bridge-ready", { detail: window.firebaseBridge }));
} else {
  try {
    const app = initializeApp(config);
    const db = getFirestore(app);

    window.firebaseBridge = {
      status: "ready",
      configured: true,
      app,
      db,
      error: null,
      async loadDay(dateKey) {
        if (!dateKey) {
          return null;
        }
        const snapshot = await getDoc(doc(db, COLLECTION_NAME, dateKey));
        return snapshot.exists() ? snapshot.data() : null;
      },
      async saveDay(dateKey, day) {
        if (!dateKey) {
          throw new Error("A date key is required to save a day.");
        }
        await setDoc(
          doc(db, COLLECTION_NAME, dateKey),
          {
            ...day,
            dateKey,
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );
      },
      async loadStore() {
        const snapshot = await getDocs(collection(db, COLLECTION_NAME));
        const store = {};
        snapshot.forEach((entry) => {
          const data = entry.data();
          store[entry.id] = {
            approval: data.approval || {},
            platforms: data.platforms || {}
          };
        });
        return store;
      },
      async saveStore(store) {
        const entries = Object.entries(store || {});
        await Promise.all(
          entries.map(([dateKey, day]) =>
            setDoc(
              doc(db, COLLECTION_NAME, dateKey),
              {
                ...day,
                dateKey,
                updatedAt: serverTimestamp()
              },
              { merge: true }
            )
          )
        );
      }
    };
    window.dispatchEvent(new CustomEvent("firebase-bridge-ready", { detail: window.firebaseBridge }));
  } catch (error) {
    console.error("Firebase initialization failed:", error);
    window.firebaseBridge = {
      ...defaultBridge,
      configured: true,
      status: "error",
      error
    };
    window.dispatchEvent(new CustomEvent("firebase-bridge-ready", { detail: window.firebaseBridge }));
  }
}

function isValidFirebaseConfig(value) {
  const requiredKeys = ["apiKey", "authDomain", "projectId", "appId"];
  return requiredKeys.every((key) => typeof value?.[key] === "string" && value[key].trim());
}
