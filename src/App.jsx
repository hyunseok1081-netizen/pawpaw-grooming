import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';

const DEFAULT_SHOPS = [
  { id: 'default-1', name: '포포 멍뭉이 미용실', region: '인천', district: '남동구 구월동', desc: '스파/가위컷 전문 · 100% 예약제', price: '45,000원~' },
  { id: 'default-2', name: '예쁜 댕댕이 샵', region: '서울', district: '마포구 연남동', desc: '오픈형 통유리 미용실 · 대형견 가능', price: '50,000원~' },
  { id: 'default-3', name: '힐링 반려동물 케어', region: '인천', district: '연수구 송도동', desc: '노령견/특수견 저자극 케어 전문', price: '55,000원~' },
  { id: 'default-4', name: '강남 프리미엄 펫살롱', region: '서울', district: '강남구 신사동', desc: '1:1 맞춤형 프리미엄 스타일링', price: '65,000원~' },
  { id: 'default-5', name: '분당 코지 그루밍', region: '경기', district: '성남시 분당구', desc: '스트레스 프리 탄산스파 전문', price: '50,000원~' },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // 인증 폼 상태
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('user');
  const [extraInfo, setExtraInfo] = useState('');

  // 실시간 DB 데이터
  const [bookings, setBookings] = useState([]);
  const [dbShops, setDbShops] = useState([]);

  // 보호자 화면 탭 & 검색 상태
  const [userTab, setUserTab] = useState('search'); // 'search' | 'bookings' | 'pet'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('전체');

  // 보호자 예약 모달 상태
  const [bookingModalShop, setBookingModalShop] = useState(null);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('14:00');
  const [bookingService, setBookingService] = useState('전체 미용 (가위컷/클리핑)');
  const [bookingNote, setBookingNote] = useState('');

  // 보호자 반려견 상세 정보 상태
  const [petName, setPetName] = useState('');
  const [petBreed, setPetBreed] = useState('');
  const [petWeight, setPetWeight] = useState('');
  const [petNote, setPetNote] = useState('');

  // 사장님 화면 탭 & 매장 등록/수정 상태
  const [ownerTab, setOwnerTab] = useState('bookings'); // 'bookings' | 'shop'
  const [shopRegion, setShopRegion] = useState('서울');
  const [shopDistrict, setShopDistrict] = useState('');
  const [shopDesc, setShopDesc] = useState('');
  const [shopPrice, setShopPrice] = useState('50,000원~');
  const [onlyMyShopBookings, setOnlyMyShopBookings] = useState(false);

  // 1. 로그인 상태 및 사용자 프로필 로드
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const docRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserProfile(data);
          // 반려견 상세 정보 초기화
          setPetName(data.petDetail?.petName || data.extraInfo || '');
          setPetBreed(data.petDetail?.petBreed || '');
          setPetWeight(data.petDetail?.petWeight || '');
          setPetNote(data.petDetail?.petNote || '');
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. 실시간 예약 & 매장 목록 구독
  useEffect(() => {
    if (!user) return;

    const qBookings = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
    const unsubBookings = onSnapshot(qBookings, (snapshot) => {
      setBookings(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const qShops = query(collection(db, 'shops'), orderBy('createdAt', 'desc'));
    const unsubShops = onSnapshot(qShops, (snapshot) => {
      setDbShops(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubBookings();
      unsubShops();
    };
  }, [user]);

  // 3. 회원가입 / 로그인
  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      if (isSignUp) {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        const profileData = {
          uid: res.user.uid,
          email,
          name: name || '사용자',
          role,
          extraInfo: extraInfo || (role === 'user' ? '반려견' : '포포 제휴 미용실'),
          petDetail: role === 'user' ? { petName: extraInfo, petBreed: '', petWeight: '', petNote: '' } : null,
          createdAt: serverTimestamp(),
        };
        await setDoc(doc(db, 'users', res.user.uid), profileData);
        setUserProfile(profileData);
        if (role === 'user') setPetName(extraInfo);
        alert('회원가입이 완료되었습니다!');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      alert('오류가 발생했습니다: ' + err.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  // 4. 보호자: 상세 예약 신청
  const handleConfirmBooking = async (e) => {
    e.preventDefault();
    if (!bookingDate) {
      alert('예
