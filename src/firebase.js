import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// 본인의 Firebase 콘솔에서 복사한 설정값으로 덮어씌우세요
const firebaseConfig = {
  apiKey: "AIzaSyAUinvmc7k7bEXD1j3N1UoqhAXFwDE9yB8",
  authDomain: "pawpaw-grooming-cc5f7.firebaseapp.com",
  projectId: "pawpaw-grooming-cc5f7",
  storageBucket: "pawpaw-grooming-cc5f7.firebasestorage.app",
  messagingSenderId: "881075073417",
  appId: "1:881075073417:web:effe3efa46ec86b0307158",
  measurementId: "G-DFJNVJDQZY"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
