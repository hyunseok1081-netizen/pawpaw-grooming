import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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

// 기본 제휴 미용실 (매장별 고유 예약 시간대 & 특화 미용 메뉴 포함)
const DEFAULT_SHOPS = [
  {
    id: 'default-1',
    name: '포포 멍뭉이 미용실',
    region: '인천',
    district: '남동구 구월동',
    desc: '스파/가위컷 전문 · 100% 예약제',
    price: '45,000원~',
    lat: 37.4482,
    lng: 126.7015,
    timeSlots: ['10:00', '12:00', '14:00', '16:00', '18:00'],
    services: [
      { name: '전체 가위컷 풀케어', price: '65,000원', duration: '2시간' },
      { name: '클리핑(기계컷) + 얼굴컷', price: '45,000원', duration: '1시간 30분' },
      { name: '탄산 버블 스파 + 부분미용', price: '40,000원', duration: '1시간' },
    ],
  },
  {
    id: 'default-2',
    name: '예쁜 댕댕이 샵',
    region: '서울',
    district: '마포구 연남동',
    desc: '오픈형 통유리 미용실 · 대형견 가능',
    price: '50,000원~',
    lat: 37.5612,
    lng: 126.9248,
    timeSlots: ['11:00', '13:30', '15:30', '17:30', '19:30'],
    services: [
      { name: '곰돌이컷 / 브로콜리컷 특화', price: '70,000원', duration: '2시간' },
      { name: '중·대형견 목욕 + 죽은털 제거', price: '60,000원', duration: '1시간 30분' },
      { name: '위생미용 + 발바닥/눈가 케어', price: '25,000원', duration: '40분' },
    ],
  },
  {
    id: 'default-3',
    name: '힐링 반려동물 케어',
    region: '인천',
    district: '연수구 송도동',
    desc: '노령견/특수견 저자극 케어 전문',
    price: '55,000원~',
    lat: 37.3827,
    lng: 126.6563,
    timeSlots: ['10:30', '13:00', '15:00', '17:00'],
    services: [
      { name: '노령견 맞춤 1:1 저자극 미용', price: '65,000원', duration: '2시간' },
      { name: '약용 입욕 + 피부 진정 스파', price: '55,000원', duration: '1시간' },
      { name: '엉킴 풀기 + 전체 클리핑', price: '55,000원', duration: '1시간 30분' },
    ],
  },
  {
    id: 'default-4',
    name: '강남 프리미엄 펫살롱',
    region: '서울',
    district: '강남구 신사동',
    desc: '1:1 맞춤형 프리미엄 스타일링',
    price: '65,000원~',
    lat: 37.5236,
    lng: 127.0232,
    timeSlots: ['11:00', '14:00', '16:30', '19:00'],
    services: [
      { name: '시그니처 스포팅 + 머즐 스타일링', price: '85,000원', duration: '2시간 30분' },
      { name: '머드팩 + 아로마 테라피 목욕', price: '65,000원', duration: '1시간 20분' },
      { name: '퍼피 첫 배냇미용 적응 패키지', price: '55,000원', duration: '1시간 30분' },
    ],
  },
  {
    id: 'default-5',
    name: '분당 코지 그루밍',
    region: '경기',
    district: '성남시 분당구',
    desc: '스트레스 프리 탄산스파 전문',
    price: '50,000원~',
    lat: 37.3826,
    lng: 127.1189,
    timeSlots: ['10:00', '11:30', '14:00', '16:00', '18:00'],
    services: [
      { name: '전체 클리핑 + 탄산스파 패키지', price: '55,000원', duration: '1시간 40분' },
      { name: '가위컷 디자인 + 귀/발 케어', price: '75,000원', duration: '2시간 10분' },
      { name: '목욕 + 부분 위생미용', price: '35,000원', duration: '1시간' },
    ],
  },
];

const REGION_CENTERS = {
  서울: { lat: 37.5665, lng: 126.978 },
  인천: { lat: 37.4563, lng: 126.7052 },
  경기: { lat: 37.4138, lng: 127.5183 },
};

function calcDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(1);
}

// 인터랙티브 지도 컴포넌트
function GroomingMap({ shops, myLocation, onLocateMe, onSelectShop, selectedShop }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialCenter = myLocation
      ? [myLocation.lat, myLocation.lng]
      : [37.5172, 126.86];

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 11,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (mapInstanceRef.current && myLocation) {
      mapInstanceRef.current.flyTo([myLocation.lat, myLocation.lng], 13, {
        duration: 0.8,
      });
    }
  }, [myLocation]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    if (myLocation) {
      const myIcon = L.divIcon({
        className: 'custom-my-location',
        html: `<div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;width:24px;height:24px;background:rgba(59,130,246,0.3);border-radius:9999px;"></div>
          <div style="width:13px;height:13px;background:#2563eb;border:2.5px solid #ffffff;border-radius:9999px;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>
        </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      L.marker([myLocation.lat, myLocation.lng], { icon: myIcon })
        .addTo(layer)
        .bindPopup('<b>📍 현재 내 위치</b>');
    }

    shops.forEach((shop) => {
      if (!shop.lat || !shop.lng) return;
      const isSelected = selectedShop?.id === shop.id;

      const shopIcon = L.divIcon({
        className: 'custom-shop-marker',
        html: `<div style="
          background:${isSelected ? '#0f172a' : '#f97316'};
          color:#ffffff;
          padding:5px 10px;
          border-radius:9999px;
          font-size:11px;
          font-weight:800;
          white-space:nowrap;
          border:2px solid #ffffff;
          box-shadow:0 4px 10px rgba(0,0,0,0.25);
          display:inline-flex;
          align-items:center;
          gap:3px;
          transform:translate(-50%, -100%);
        ">
          <span>🐾</span><span>${shop.name}</span>
        </div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([shop.lat, shop.lng], { icon: shopIcon }).addTo(layer);
      marker.on('click', () => {
        onSelectShop(shop);
        map.flyTo([shop.lat, shop.lng], 14, { duration: 0.5 });
      });
    });
  }, [shops, myLocation, selectedShop]);

  return (
    <div className="relative w-full h-[330px] rounded-3xl overflow-hidden shadow-md border border-gray-200 bg-gray-100">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      <button
        type="button"
        onClick={onLocateMe}
        className="absolute bottom-3 right-3 z-[400] bg-white hover:bg-gray-50 text-slate-800 px-3.5 py-2 rounded-2xl shadow-lg border border-gray-200 text-xs font-extrabold flex items-center space-x-1.5 active:scale-95 transition"
      >
        <span className="text-blue-600">📍</span>
        <span>내 위치</span>
      </button>

      <div className="absolute top-3 left-3 z-[400] bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-3 text-[11px] font-bold text-gray-700">
        <span className="flex items-center space-x-1">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
          <span>내 위치</span>
        </span>
        <span className="flex items-center space-x-1">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block"></span>
          <span>제휴 샵 ({shops.length})</span>
        </span>
      </div>
    </div>
  );
}

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

  // 보호자 화면 탭 & 검색 & 지도 상태
  const [userTab, setUserTab] = useState('search');
  const [viewMode, setViewMode] = useState('map');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('전체');
  const [myLocation, setMyLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('');
  const [selectedMapShop, setSelectedMapShop] = useState(null);

  // 보호자 상세 예약 모달 상태 (업체별 날짜·시간·미용방식 선택)
  const [bookingModalShop, setBookingModalShop] = useState(null);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [selectedServiceIdx, setSelectedServiceIdx] = useState(0);
  const [customStyleDetail, setCustomStyleDetail] = useState('얼굴 동그랗게 (곰돌이컷)');
  const [bookingNote, setBookingNote] = useState('');

  // 보호자 반려견 상세 정보 상태
  const [petName, setPetName] = useState('');
  const [petBreed, setPetBreed] = useState('');
  const [petWeight, setPetWeight] = useState('');
  const [petNote, setPetNote] = useState('');

  // 사장님 화면 탭 & 매장 등록/커스텀 상태
  const [ownerTab, setOwnerTab] = useState('bookings');
  const [shopRegion, setShopRegion] = useState('서울');
  const [shopDistrict, setShopDistrict] = useState('');
  const [shopDesc, setShopDesc] = useState('');
  const [shopPrice, setShopPrice] = useState('50,000원~');
  const [shopTimeSlotsInput, setShopTimeSlotsInput] = useState('10:00, 12:00, 14:00, 16:00, 18:00');
  const [shopSvc1Name, setShopSvc1Name] = useState('전체 가위컷 풀케어');
  const [shopSvc1Price, setShopSvc1Price] = useState('65,000원');
  const [shopSvc2Name, setShopSvc2Name] = useState('클리핑(기계컷) + 목욕');
  const [shopSvc2Price, setShopSvc2Price] = useState('45,000원');
  const [shopSvc3Name, setShopSvc3Name] = useState('탄산 스파 + 부분 위생미용');
  const [shopSvc3Price, setShopSvc3Price] = useState('35,000원');
  const [onlyMyShopBookings, setOnlyMyShopBookings] = useState(false);

  const detectMyLocation = (showAlert = false) => {
    if (!navigator.geolocation) {
      setLocationStatus('GPS 미지원 기기 (기본 위치 표시)');
      return;
    }
    setLocationStatus('내 위치 찾는 중...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMyLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setLocationStatus('현재 GPS 위치 기준');
      },
      () => {
        setMyLocation((prev) => prev || { lat: 37.4563, lng: 126.7052 });
        setLocationStatus('기본 위치 기준 (위치 권한 허용 시 정밀 측정)');
        if (showAlert) {
          alert('스마트폰 위치(GPS) 권한을 허용하시면 현재 내 위치가 정확히 표시됩니다.');
        }
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const docRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserProfile(data);
          setPetName(data.petDetail?.petName || data.extraInfo || '');
          setPetBreed(data.petDetail?.petBreed || '');
          setPetWeight(data.petDetail?.petWeight || '');
          setPetNote(data.petDetail?.petNote || '');
          if (data.role === 'user') {
            detectMyLocation(false);
          }
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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
        if (role === 'user') {
          setPetName(extraInfo);
          detectMyLocation(false);
        }
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

  // 매장별 예약 모달 열기 헬퍼
  const openShopBookingModal = (shop) => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const slots = shop.timeSlots && shop.timeSlots.length > 0 ? shop.timeSlots : ['10:00', '13:00', '15:00', '17:00'];
    setBookingModalShop(shop);
    setBookingDate(tomorrow);
    setBookingTime(slots[0]);
    setSelectedServiceIdx(0);
    setCustomStyleDetail('얼굴 동그랗게 (곰돌이컷)');
    setBookingNote('');
  };

  // 보호자: 업체별 날짜·시간·미용방식 지정 예약 확정
  const handleConfirmBooking = async (e) => {
    e.preventDefault();
    if (!bookingDate) {
      alert('희망 예약 날짜를 선택해 주세요.');
      return;
    }
    if (!bookingTime) {
      alert('예약 가능한 시간을 선택해 주세요.');
      return;
    }

    const shopServices =
      bookingModalShop.services && bookingModalShop.services.length > 0
        ? bookingModalShop.services
        : [{ name: '전체 미용 기본', price: bookingModalShop.price || '50,000원', duration: '1시간 30분' }];

    const chosenService = shopServices[selectedServiceIdx] || shopServices[0];

    const petSummary = petBreed
      ? `${petName} (${petBreed}${petWeight ? `, ${petWeight}kg` : ''})`
      : petName || userProfile?.extraInfo || '반려견';

    try {
      await addDoc(collection(db, 'bookings'), {
        shopId: bookingModalShop.id,
        shop: bookingModalShop.name,
        shopRegion: `${bookingModalShop.region} ${bookingModalShop.district || ''}`.trim(),
        customerId: user.uid,
        customer: userProfile?.name || '보호자',
        pet: petSummary,
        petNote: petNote || '특이사항 없음',
        service: `${chosenService.name} (${chosenService.price})`,
        styleDetail: customStyleDetail,
        requestNote: bookingNote || '없음',
        bookingDate,
        bookingTime,
        time: `${bookingDate} ${bookingTime}`,
        status: '대기 중',
        createdAt: serverTimestamp(),
      });
      alert(`"${bookingModalShop.name}" (${bookingDate} ${bookingTime}) 예약 신청이 완료되었습니다!`);
      setBookingModalShop(null);
      setUserTab('bookings');
    } catch (err) {
      alert('예약 저장 실패: ' + err.message);
    }
  };

  const handleCancelBooking = async (id) => {
    if (!window.confirm('정말 이 예약을 취소하시겠습니까?')) return;
    try {
      await deleteDoc(doc(db, 'bookings', id));
    } catch (err) {
      alert('취소 실패: ' + err.message);
    }
  };

  const handleSavePetDetail = async (e) => {
    e.preventDefault();
    try {
      const petDetail = { petName, petBreed, petWeight, petNote };
      const summary = petBreed ? `${petName} (${petBreed})` : petName;
      await updateDoc(doc(db, 'users', user.uid), {
        extraInfo: summary,
        petDetail,
      });
      setUserProfile({ ...userProfile, extraInfo: summary, petDetail });
      alert('반려견 프로필이 안전하게 저장되었습니다!');
    } catch (err) {
      alert('저장 실패: ' + err.message);
    }
  };

  // 사장님: 매장 등록 (운영시간 슬롯 + 매장별 미용 메뉴 3종 함께 저장)
  const handleRegisterShop = async (e) => {
    e.preventDefault();
    const baseCoord = REGION_CENTERS[shopRegion] || REGION_CENTERS['서울'];
    const randomOffsetLat = (Math.random() - 0.5) * 0.02;
    const randomOffsetLng = (Math.random() - 0.5) * 0.02;

    const parsedSlots = shopTimeSlotsInput
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const customServices = [
      { name: shopSvc1Name || '전체 가위컷', price: shopSvc1Price || '65,000원', duration: '2시간' },
      { name: shopSvc2Name || '클리핑 + 목욕', price: shopSvc2Price || '45,000원', duration: '1시간 30분' },
      { name: shopSvc3Name || '스파 + 부분미용', price: shopSvc3Price || '35,000원', duration: '1시간' },
    ];

    try {
      await setDoc(doc(db, 'shops', user.uid), {
        ownerId: user.uid,
        name: userProfile.extraInfo,
        region: shopRegion,
        district: shopDistrict || '중심가',
        desc: shopDesc || '정성껏 케어하는 반려견 전문 미용실',
        price: shopSvc2Price || shopPrice || '45,000원~',
        lat: baseCoord.lat + randomOffsetLat,
        lng: baseCoord.lng + randomOffsetLng,
        timeSlots: parsedSlots.length > 0 ? parsedSlots : ['10:00', '13:00', '15:00', '17:00'],
        services: customServices,
        createdAt: serverTimestamp(),
      });
      alert('매장 정보와 예약 시간대/미용 메뉴가 등록되었습니다!');
      setOwnerTab('bookings');
    } catch (err) {
      alert('매장 등록 실패: ' + err.message);
    }
  };

  const updateStatus = async (id, newStatus) => {
    try {
      await updateDoc(doc(db, 'bookings', id), { status: newStatus });
    } catch (err) {
      alert('상태 변경 실패: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-orange-50 to-amber-100">
        <div className="animate-bounce text-5xl mb-3">🐾</div>
        <p className="text-orange-600 font-extrabold text-sm tracking-wide">포포그루밍 로딩 중...</p>
      </div>
    );
  }

  // [화면 A] 로그인 / 회원가입
  if (!user || !userProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 flex flex-col justify-center items-center p-6">
        <div className="max-w-md w-full bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl p-8 border border-orange-100">
          <div className="text-center mb-6">
            <div className="inline-block bg-orange-100 text-orange-600 p-3 rounded-2xl text-3xl mb-3 shadow-inner">
              🐾
            </div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">포포그루밍</h1>
            <p className="text-xs text-gray-500 mt-1 font-medium">
              {isSignUp ? '반려견과 사장님을 위한 스마트 미용 플랫폼' : '다시 오신 것을 환영합니다!'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <>
                <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setRole('user')}
                    className={`py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                      role === 'user'
                        ? 'bg-white text-orange-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    🐶 반려견 보호자
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('owner')}
                    className={`py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                      role === 'owner'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    ✂️ 미용실 사장님
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-600 mb-1 ml-1">이름</label>
                  <input
                    type="text"
                    placeholder="예: 홍길동"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:bg-white focus:border-orange-500 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-600 mb-1 ml-1">
                    {role === 'user' ? '반려견 이름' : '미용실 상호명'}
                  </label>
                  <input
                    type="text"
                    placeholder={role === 'user' ? '예: 초코' : '예: 포포 멍뭉이 미용실'}
                    value={extraInfo}
                    onChange={(e) => setExtraInfo(e.target.value)}
                    required
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:bg-white focus:border-orange-500 focus:outline-none transition"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1 ml-1">이메일 주소</label>
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:bg-white focus:border-orange-500 focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1 ml-1">비밀번호</label>
              <input
                type="password"
                placeholder="6자 이상 입력"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:bg-white focus:border-orange-500 focus:outline-none transition"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-orange-500/30 hover:opacity-95 transition text-sm active:scale-[0.99]"
            >
              {isSignUp ? '회원가입 완료하기' : '로그인하기'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs text-gray-500 hover:text-orange-600 font-semibold transition"
            >
              {isSignUp ? '이미 계정이 있으신가요? 로그인' : '처음이신가요? 계정 만들기'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // [화면 B] 이용자(보호자) 홈 화면
  if (userProfile.role === 'user') {
    const allShops = [...dbShops, ...DEFAULT_SHOPS].map((shop) => ({
      ...shop,
      distanceKm: myLocation ? calcDistanceKm(myLocation.lat, myLocation.lng, shop.lat, shop.lng) : null,
    }));

    const myBookings = bookings.filter((b) => b.customerId === user.uid);

    const filteredShops = allShops
      .filter((shop) => {
        const matchesRegion = selectedRegion === '전체' || shop.region === selectedRegion;
        const keyword = searchTerm.toLowerCase();
        const matchesSearch =
          shop.name.toLowerCase().includes(keyword) ||
          (shop.district && shop.district.toLowerCase().includes(keyword)) ||
          (shop.desc && shop.desc.toLowerCase().includes(keyword));
        return matchesRegion && matchesSearch;
      })
      .sort((a, b) => {
        if (a.distanceKm && b.distanceKm) {
          return parseFloat(a.distanceKm) - parseFloat(b.distanceKm);
        }
        return 0;
      });

    // 모달에 띄울 선택 매장의 시간대 & 이미 예약된 시간 계산
    const modalTimeSlots =
      bookingModalShop?.timeSlots && bookingModalShop.timeSlots.length > 0
        ? bookingModalShop.timeSlots
        : ['10:00', '13:00', '15:00', '17:00'];

    const modalServices =
      bookingModalShop?.services && bookingModalShop.services.length > 0
        ? bookingModalShop.services
        : [{ name: '전체 미용 기본', price: bookingModalShop?.price || '50,000원', duration: '1시간 30분' }];

    const bookedTimesForShopAndDate = bookingModalShop
      ? bookings
          .filter(
            (b) =>
              b.shop === bookingModalShop.name &&
              b.status !== '거절됨' &&
              (b.bookingDate === bookingDate || (b.time && b.time.startsWith(bookingDate)))
          )
          .map((b) => b.bookingTime || (b.time ? b.time.split(' ')[1] : ''))
      : [];

    const todayStr = new Date().toISOString().split('T')[0];

    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <header className="bg-white/80 backdrop-blur-md shadow-sm px-4 py-3.5 flex justify-between items-center sticky top-0 z-20 border-b border-gray-100">
          <div className="flex items-center space-x-2">
            <div className="bg-orange-100 text-orange-600 p-1.5 rounded-xl text-base shadow-sm">🐾</div>
            <div>
              <p className="text-[11px] text-gray-400 font-bold leading-none">반려견 보호자</p>
              <h2 className="font-extrabold text-gray-800 text-sm mt-0.5">{userProfile.name}님</h2>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-xl font-bold transition"
          >
            로그아웃
          </button>
        </header>

        <div className="bg-white border-b border-gray-100 sticky top-[57px] z-10 shadow-sm">
          <div className="max-w-md mx-auto grid grid-cols-3 text-center text-xs font-bold">
            <button
              onClick={() => setUserTab('search')}
              className={`py-3.5 border-b-2 transition flex items-center justify-center space-x-1 ${
                userTab === 'search'
                  ? 'border-orange-500 text-orange-600 bg-orange-50/30'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <span>🗺️</span>
              <span>미용실 찾기</span>
            </button>
            <button
              onClick={() => setUserTab('bookings')}
              className={`py-3.5 border-b-2 transition flex items-center justify-center space-x-1 ${
                userTab === 'bookings'
                  ? 'border-orange-500 text-orange-600 bg-orange-50/30'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <span>📋</span>
              <span>내 예약 ({myBookings.length})</span>
            </button>
            <button
              onClick={() => setUserTab('pet')}
              className={`py-3.5 border-b-2 transition flex items-center justify-center space-x-1 ${
                userTab === 'pet'
                  ? 'border-orange-500 text-orange-600 bg-orange-50/30'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <span>🐶</span>
              <span>반려견 관리</span>
            </button>
          </div>
        </div>

        <main className="max-w-md mx-auto p-4 space-y-4">
          {userTab === 'search' && (
            <>
              <div className="space-y-2.5">
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">🔍</span>
                  <input
                    type="text"
                    placeholder="지역(구/동), 미용실 이름, 특징 검색"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-2xl pl-10 pr-4 py-3 text-sm shadow-sm focus:border-orange-500 focus:outline-none transition"
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="grid grid-cols-4 gap-1.5 flex-1">
                    {['전체', '서울', '인천', '경기'].map((region) => (
                      <button
                        key={region}
                        onClick={() => setSelectedRegion(region)}
                        className={`py-2 rounded-xl text-xs font-bold transition shadow-sm ${
                          selectedRegion === region
                            ? 'bg-slate-900 text-white'
                            : 'bg-white text-gray-600 border border-gray-200'
                        }`}
                      >
                        {region}
                      </button>
                    ))}
                  </div>

                  <div className="bg-gray-200 p-1 rounded-xl flex text-[11px] font-extrabold shrink-0">
                    <button
                      onClick={() => setViewMode('map')}
                      className={`px-2.5 py-1.5 rounded-lg transition ${
                        viewMode === 'map' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500'
                      }`}
                    >
                      🗺️ 지도
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`px-2.5 py-1.5 rounded-lg transition ${
                        viewMode === 'list' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500'
                      }`}
                    >
                      📋 목록
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center px-1 text-[11px] text-gray-500 font-semibold">
                <span>📡 {locationStatus || '내 주변 제휴 미용실 탐색'}</span>
                <button
                  onClick={() => detectMyLocation(true)}
                  className="text-blue-600 font-bold underline"
                >
                  위치 새로고침
                </button>
              </div>

              {viewMode === 'map' && (
                <div className="space-y-3">
                  <GroomingMap
                    shops={filteredShops}
                    myLocation={myLocation}
                    onLocateMe={() => detectMyLocation(true)}
                    onSelectShop={(shop) => setSelectedMapShop(shop)}
                    selectedShop={selectedMapShop}
                  />

                  {selectedMapShop ? (
                    <div className="bg-white p-4 rounded-2xl shadow-lg border-2 border-orange-400 flex justify-between items-center transition">
                      <div className="pr-2 space-y-1">
                        <div className="flex items-center space-x-1.5 flex-wrap">
                          <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">
                            {selectedMapShop.region} {selectedMapShop.district}
                          </span>
                          {selectedMapShop.distanceKm && (
                            <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">
                              내 위치에서 {selectedMapShop.distanceKm}km
                            </span>
                          )}
                        </div>
                        <h4 className="font-black text-gray-900 text-sm">{selectedMapShop.name}</h4>
                        <p className="text-xs text-gray-500">{selectedMapShop.desc}</p>
                        <p className="text-xs font-extrabold text-orange-600">{selectedMapShop.price}</p>
                      </div>
                      <button
                        onClick={() => openShopBookingModal(selectedMapShop)}
                        className="shrink-0 bg-orange-500 hover:bg-orange-600 text-white text-xs px-4 py-3 rounded-xl font-bold shadow-md transition"
                      >
                        날짜·시간 선택
                      </button>
                    </div>
                  ) : (
                    <p className="text-center text-xs text-gray-400 py-1 font-medium">
                      👆 지도 위의 주황색 🐾 매장 핀을 누르면 상세 정보와 예약 버튼이 나타납니다.
                    </p>
                  )}
                </div>
              )}

              <div>
                <h3 className="font-extrabold mb-2.5 text-xs tracking-wide uppercase text-gray-400">
                  {myLocation ? '내 위치에서 가까운 순' : '추천 제휴 미용실'} ({filteredShops.length}곳)
                </h3>
                {filteredShops.length === 0 ? (
                  <div className="bg-white p-8 rounded-3xl text-center shadow-sm border border-gray-100">
                    <p className="text-2xl mb-2">🥲</p>
                    <p className="text-xs text-gray-400 font-medium">조건에 일치하는 미용실이 없습니다.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredShops.map((shop) => (
                      <div
                        key={shop.id}
                        onClick={() => {
                          setSelectedMapShop(shop);
                          if (viewMode === 'list') setViewMode('map');
                        }}
                        className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center hover:shadow-md transition cursor-pointer"
                      >
                        <div className="pr-2 space-y-1">
                          <div className="flex items-center space-x-1.5 flex-wrap">
                            <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">
                              {shop.region} {shop.district}
                            </span>
                            {shop.distanceKm && (
                              <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">
                                {shop.distanceKm}km
                              </span>
                            )}
                          </div>
                          <h4 className="font-extrabold text-gray-900 text-sm">{shop.name}</h4>
                          <p className="text-xs text-gray-500 font-medium">{shop.desc}</p>
                          <p className="text-xs font-bold text-orange-600">{shop.price || '50,000원~'}</p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openShopBookingModal(shop);
                          }}
                          className="shrink-0 bg-orange-500 hover:bg-orange-600 text-white text-xs px-3.5 py-2.5 rounded-xl font-bold shadow-sm transition active:scale-95"
                        >
                          예약하기
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {userTab === 'bookings' && (
            <div className="space-y-3">
              <h3 className="font-extrabold text-gray-800 text-sm">📋 내 예약 신청 내역</h3>
              {myBookings.length === 0 ? (
                <div className="bg-white p-8 rounded-3xl text-center shadow-sm border border-gray-100">
                  <p className="text-2xl mb-2">🗓️</p>
                  <p className="text-xs text-gray-400 font-medium">아직 신청한 미용 예약이 없습니다.</p>
                </div>
              ) : (
                myBookings.map((b) => (
                  <div
                    key={b.id}
                    className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-3"
                  >
                    <div className="flex justify-between items-center">
                      <h4 className="font-extrabold text-gray-900 text-sm">{b.shop}</h4>
                      <span
                        className={`text-xs font-bold px-3 py-1 rounded-full ${
                          b.status === '승인됨'
                            ? 'bg-emerald-100 text-emerald-700'
                            : b.status === '거절됨'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {b.status}
                      </span>
                    </div>
                    <div className="text-xs space-y-1 text-gray-600 font-medium bg-gray-50 p-3 rounded-xl">
                      <p>🗓️ 예약 일시: <span className="font-bold text-gray-800">{b.time}</span></p>
                      <p>✂️ 선택 메뉴: <span className="font-bold text-gray-800">{b.service || '기본 미용'}</span></p>
                      {b.styleDetail && (
                        <p>🐩 미용 스타일: <span className="font-bold text-orange-600">{b.styleDetail}</span></p>
                      )}
                      {b.requestNote && b.requestNote !== '없음' && (
                        <p>💬 요청사항: <span className="text-gray-700">{b.requestNote}</span></p>
                      )}
                    </div>
                    {b.status === '대기 중' && (
                      <div className="pt-1 text-right">
                        <button
                          onClick={() => handleCancelBooking(b.id)}
                          className="text-xs text-rose-500 font-bold hover:underline"
                        >
                          예약 취소하기
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {userTab === 'pet' && (
            <form onSubmit={handleSavePetDetail} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
              <div>
                <h3 className="font-black text-gray-900 text-base">🐶 반려견 상세 프로필</h3>
                <p className="text-xs text-gray-400 mt-0.5">미용 예약 시 사장님께 안전하게 전달됩니다.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">반려견 이름</label>
                <input
                  type="text"
                  value={petName}
                  onChange={(e) => setPetName(e.target.value)}
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:bg-white focus:border-orange-500 focus:outline-none transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">견종</label>
                  <input
                    type="text"
                    placeholder="예: 말티푸"
                    value={petBreed}
                    onChange={(e) => setPetBreed(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:bg-white focus:border-orange-500 focus:outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">몸무게 (kg)</label>
                  <input
                    type="text"
                    placeholder="예: 4.5"
                    value={petWeight}
                    onChange={(e) => setPetWeight(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:bg-white focus:border-orange-500 focus:outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">특이사항 (입질, 겁 많음 등)</label>
                <textarea
                  rows="3"
                  placeholder="미용사님이 미리 참고해야 할 사항을 적어주세요."
                  value={petNote}
                  onChange={(e) => setPetNote(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm focus:bg-white focus:border-orange-500 focus:outline-none transition resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 rounded-2xl shadow-md shadow-orange-500/20 text-sm transition"
              >
                프로필 저장하기
              </button>
            </form>
          )}
        </main>

        {/* 제휴 업체별 날짜 · 시간 · 미용 방식 상세 선택 모달 */}
        {bookingModalShop && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
            <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl border border-gray-100">
              <div className="flex justify-between items-start border-b border-gray-100 pb-3">
                <div>
                  <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">
                    {bookingModalShop.region} {bookingModalShop.district}
                  </span>
                  <h3 className="font-black text-gray-900 text-base mt-1">{bookingModalShop.name}</h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">{bookingModalShop.desc}</p>
                </div>
                <button
                  onClick={() => setBookingModalShop(null)}
                  className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 font-bold hover:bg-gray-200 transition shrink-0"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleConfirmBooking} className="space-y-4">
                {/* 1. 희망 날짜 선택 */}
                <div>
                  <label className="block text-xs font-extrabold text-gray-700 mb-1.5">
                    1️⃣ 예약 날짜 선택
                  </label>
                  <input
                    type="date"
                    min={todayStr}
                    value={bookingDate}
                    onChange={(e) => {
                      setBookingDate(e.target.value);
                      setBookingTime('');
                    }}
                    required
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm font-bold text-gray-800 focus:bg-white focus:border-orange-500 focus:outline-none"
                  />
                </div>

                {/* 2. 해당 매장의 예약 가능 시간대 버튼 선택 */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-extrabold text-gray-700">
                      2️⃣ 매장별 가능 시간 선택
                    </label>
                    <span className="text-[10px] text-gray-400 font-semibold">
                      회색은 예약 마감 시간
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {modalTimeSlots.map((slot) => {
                      const isBooked = bookedTimesForShopAndDate.includes(slot);
                      const isSelected = bookingTime === slot;
                      return (
                        <button
                          key={slot}
                          type="button"
                          disabled={isBooked}
                          onClick={() => setBookingTime(slot)}
                          className={`py-2.5 rounded-xl text-xs font-extrabold border transition ${
                            isBooked
                              ? 'bg-gray-100 text-gray-300 border-gray-100 cursor-not-allowed line-through'
                              : isSelected
                              ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                              : 'bg-white text-gray-700 border-gray-200 hover:border-orange-300'
                          }`}
                        >
                          {slot} {isBooked ? '(마감)' : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. 제휴 업체별 제공 미용 코스 선택 */}
                <div>
                  <label className="block text-xs font-extrabold text-gray-700 mb-1.5">
                    3️⃣ 미용 메뉴 선택 ({bookingModalShop.name} 전용)
                  </label>
                  <div className="space-y-2">
                    {modalServices.map((svc, idx) => {
                      const active = selectedServiceIdx === idx;
                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedServiceIdx(idx)}
                          className={`p-3 rounded-2xl border-2 cursor-pointer transition flex justify-between items-center ${
                            active
                              ? 'border-orange-500 bg-orange-50/60'
                              : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                          }`}
                        >
                          <div>
                            <p className="text-xs font-extrabold text-gray-900">{svc.name}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">소요 약 {svc.duration}</p>
                          </div>
                          <span className="text-xs font-black text-orange-600">{svc.price}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 4. 세부 미용 방식(컷 스타일) 선택 */}
                <div>
                  <label className="block text-xs font-extrabold text-gray-700 mb-1.5">
                    4️⃣ 원하는 미용 방식 / 컷 스타일
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      '얼굴 동그랗게 (곰돌이컷)',
                      '전체 가위컷 (스포팅)',
                      '깔끔 클리핑 (3mm/6mm)',
                      '위생·목욕 중심 (최소 컷)',
                    ].map((styleOption) => (
                      <button
                        key={styleOption}
                        type="button"
                        onClick={() => setCustomStyleDetail(styleOption)}
                        className={`py-2 px-2.5 rounded-xl text-[11px] font-bold border text-left transition ${
                          customStyleDetail === styleOption
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {styleOption}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 5. 추가 요청사항 */}
                <div>
                  <label className="block text-xs font-extrabold text-gray-700 mb-1">
                    5️⃣ 사장님께 전달할 요청사항
                  </label>
                  <input
                    type="text"
                    placeholder="예: 발바닥 털은 바짝 밀어주시고 귀는 길게 남겨주세요"
                    value={bookingNote}
                    onChange={(e) => setBookingNote(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="flex space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setBookingModalShop(null)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-3 rounded-2xl text-xs font-bold transition"
                  >
                    닫기
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-2xl text-xs font-bold shadow-md shadow-orange-500/20 transition"
                  >
                    예약 신청 확정
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // [화면 C] 사장님(그로머) 대시보드 화면
  const displayedBookings = onlyMyShopBookings
    ? bookings.filter((b) => b.shop === userProfile.extraInfo)
    : bookings;

  return (
    <div className="min-h-screen bg-slate-900 pb-20 text-slate-100">
      <header className="bg-slate-950 px-4 py-3.5 flex justify-between items-center sticky top-0 z-20 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <div className="bg-slate-800 text-slate-200 p-1.5 rounded-xl text-base shadow-sm">✂️</div>
          <div>
            <p className="text-[11px] text-slate-400 font-bold leading-none">애견 미용사 사장님</p>
            <h2 className="font-extrabold text-white text-sm mt-0.5">{userProfile.extraInfo}</h2>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-xl font-bold transition"
        >
          로그아웃
        </button>
      </header>

      <div className="bg-slate-950 border-b border-slate-800 sticky top-[57px] z-10 shadow-sm">
        <div className="max-w-md mx-auto grid grid-cols-2 text-center text-xs font-bold">
          <button
            onClick={() => setOwnerTab('bookings')}
            className={`py-3.5 border-b-2 transition ${
              ownerTab === 'bookings' ? 'border-orange-500 text-orange-400 bg-slate-900/50' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            📅 예약 관리
          </button>
          <button
            onClick={() => setOwnerTab('shop')}
            className={`py-3.5 border-b-2 transition ${
              ownerTab === 'shop' ? 'border-orange-500 text-orange-400 bg-slate-900/50' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            🏪 매장·메뉴 설정
          </button>
        </div>
      </div>

      <main className="max-w-md mx-auto p-4 space-y-5">
        {ownerTab === 'bookings' ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700/60 shadow-sm">
                <p className="text-xs text-slate-400 font-medium">전체 접수 예약</p>
                <p className="text-2xl font-black text-white mt-1">{displayedBookings.length}건</p>
              </div>
              <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700/60 shadow-sm">
                <p className="text-xs text-slate-400 font-medium">승인 완료</p>
                <p className="text-2xl font-black text-emerald-400 mt-1">
                  {displayedBookings.filter((b) => b.status === '승인됨').length}건
                </p>
              </div>
            </div>

            <div className="flex justify-between items-center px-1">
              <h3 className="font-extrabold text-slate-200 text-xs tracking-wider uppercase">실시간 예약 리스트</h3>
              <label className="flex items-center space-x-1.5 text-xs text-slate-400 cursor-pointer font-medium">
                <input
                  type="checkbox"
                  checked={onlyMyShopBookings}
                  onChange={(e) => setOnlyMyShopBookings(e.target.checked)}
                  className="rounded text-orange-500 focus:ring-orange-500 bg-slate-800 border-slate-700"
                />
                <span>내 매장 예약만 보기</span>
              </label>
            </div>

            {displayedBookings.length === 0 ? (
              <div className="bg-slate-800 p-8 rounded-3xl text-center border border-slate-700/60">
                <p className="text-2xl mb-2">📭</p>
                <p className="text-xs text-slate-400 font-medium">접수된 예약 내역이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {displayedBookings.map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-800 p-5 rounded-2xl border border-slate-700/60 space-y-3 shadow-sm"
                  >
                    <div className="flex justify-between items-center">
                      <span
                        className={`text-xs font-bold px-3 py-1 rounded-full ${
                          item.status === '승인됨'
                            ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/50'
                            : item.status === '거절됨'
                            ? 'bg-rose-900/60 text-rose-300 border border-rose-700/50'
                            : 'bg-amber-900/60 text-amber-300 border border-amber-700/50'
                        }`}
                      >
                        {item.status}
                      </span>
                      <span className="text-xs font-bold text-slate-300">{item.time}</span>
                    </div>

                    <div className="space-y-1.5 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 text-xs">
                      <p className="font-bold text-white text-sm">👤 {item.customer} 보호자님</p>
                      <p className="text-slate-300">🐶 반려견: <span className="font-bold text-white">{item.pet}</span></p>
                      <p className="text-orange-400 font-semibold">✂️ 선택 메뉴: {item.service || '기본 미용'}</p>
                      {item.styleDetail && (
                        <p className="text-amber-300 font-medium">🐩 미용 방식: {item.styleDetail}</p>
                      )}
                      {item.petNote && item.petNote !== '특이사항 없음' && (
                        <p className="text-rose-400 font-medium">⚠️ 아이 특이사항: {item.petNote}</p>
                      )}
                      {item.requestNote && item.requestNote !== '없음' && (
                        <p className="text-slate-400">💬 보호자 요청: {item.requestNote}</p>
                      )}
                      <p className="text-[11px] text-slate-500 pt-1">요청 샵: {item.shop}</p>
                    </div>

                    <div className="flex space-x-2 pt-1">
                      <button
                        onClick={() => updateStatus(item.id, '승인됨')}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs py-2.5 rounded-xl font-bold transition shadow-sm"
                      >
                        예약 승인
                      </button>
                      <button
                        onClick={() => updateStatus(item.id, '거절됨')}
                        className="flex-1 bg-rose-600 hover:bg-rose-500 text-white text-xs py-2.5 rounded-xl font-bold transition shadow-sm"
                      >
                        거절
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <form onSubmit={handleRegisterShop} className="bg-slate-800 p-6 rounded-3xl border border-slate-700/60 space-y-4 shadow-sm">
            <div>
              <h3 className="font-black text-white text-base">🏪 매장 정보 & 예약 시간·메뉴 설정</h3>
              <p className="text-xs text-slate-400 mt-0.5">설정한 시간대와 미용 메뉴가 보호자 예약 화면에 그대로 표시됩니다.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">매장명</label>
              <input
                type="text"
                value={userProfile.extraInfo}
                disabled
                className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-slate-400 cursor-not-allowed"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">시/도</label>
                <select
                  value={shopRegion}
                  onChange={(e) => setShopRegion(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-3.5 py-3 text-sm text-white focus:outline-none"
                >
                  <option value="서울">서울</option>
                  <option value="인천">인천</option>
                  <option value="경기">경기</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">구/동네</label>
                <input
                  type="text"
                  placeholder="예: 남동구 구월동"
                  value={shopDistrict}
                  onChange={(e) => setShopDistrict(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">매장 한 줄 소개</label>
              <input
                type="text"
                placeholder="예: 가위컷 전문 · 스파 케어 · 100% 예약제"
                value={shopDesc}
                onChange={(e) => setShopDesc(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">예약 가능 시간대 (쉼표로 구분)</label>
              <input
                type="text"
                placeholder="예: 10:00, 12:00, 14:00, 16:00, 18:00"
                value={shopTimeSlotsInput}
                onChange={(e) => setShopTimeSlotsInput(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none"
              />
            </div>

            <div className="space-y-2 pt-1">
              <label className="block text-xs font-bold text-orange-400">✂️ 우리 매장 대표 미용 메뉴 3종</label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={shopSvc1Name}
                  onChange={(e) => setShopSvc1Name(e.target.value)}
                  placeholder="메뉴 1"
                  className="col-span-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
                <input
                  type="text"
                  value={shopSvc1Price}
                  onChange={(e) => setShopSvc1Price(e.target.value)}
                  placeholder="가격"
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={shopSvc2Name}
                  onChange={(e) => setShopSvc2Name(e.target.value)}
                  placeholder="메뉴 2"
                  className="col-span-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
                <input
                  type="text"
                  value={shopSvc2Price}
                  onChange={(e) => setShopSvc2Price(e.target.value)}
                  placeholder="가격"
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={shopSvc3Name}
                  onChange={(e) => setShopSvc3Name(e.target.value)}
                  placeholder="메뉴 3"
                  className="col-span-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
                <input
                  type="text"
                  value={shopSvc3Price}
                  onChange={(e) => setShopSvc3Price(e.target.value)}
                  placeholder="가격"
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 rounded-2xl shadow-md shadow-orange-500/20 text-sm transition"
            >
              매장 및 예약 설정 저장하기
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
