// Firebase configuration
(function initFirebase() {
  const firebaseConfig = {
    apiKey: "AIzaSyA1SBm0GF2NHBD5odl-ztPee7M3wC0Nd_U",
    authDomain: "wbs-orgflow.firebaseapp.com",
    projectId: "wbs-orgflow",
    storageBucket: "wbs-orgflow.firebasestorage.app",
    messagingSenderId: "890219090008",
    appId: "1:890219090008:web:a6b3b78c8f4e22c3e03a2d",
    measurementId: "G-HLJP06E9ES",
  };

  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);

  // Export Firestore for use in other modules/pages
  window.firebaseDb = firebase.firestore();
})();
