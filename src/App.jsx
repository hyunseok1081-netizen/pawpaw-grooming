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
  writeBatch,
} from 'firebase/firestore';

const BLIND_REVIEW_MESSAGE = '해당 후기는 비방성/욕설로 인하여 가리기 처리되었습니다.';
const MAX_COMPRESSED_DATA_URL_CHARS = 700000; // Firestore 1MB 문서 한도 안전선

// 보호자 이름 가운데 마스킹 (예: 홍길동 -> 홍*동, 홍길 -> 홍*, 남궁민수 -> 남궁*수)
function maskCustomerName(rawName) {
  const clean = String(rawName || '보호자').trim();
  if (!clean) return '보*자';
  const chars = Array.from(clean);
  if (chars.length === 1) return `${chars[0]}*`;
  if (chars.length === 2) return `${chars[0]}*`;
  const middleStars = '*'.repeat(chars.length - 2);
  return `${chars[0]}${middleStars}${chars[chars.length - 1]}`;
}

// 대중적인 반려동물 체급 기준 (소형 7kg 미만 / 중형 7~15kg 미만 / 대형 15kg 이상)
const SIZE_TIERS = {
  small: {
    id: 'small',
    label: '소형 (7kg 미만)',
    shortLabel: '소형',
    extraFee: 0,
  },
  medium: {
    id: 'medium',
    label: '중형 (7~15kg 미만)',
    shortLabel: '중형',
    extraFee: 15000,
  },
  large: {
    id: 'large',
    label: '대형 (15kg 이상)',
    shortLabel: '대형',
    extraFee: 30000,
  },
};

function getSizeTierByWeight(weightValue) {
  const num = parseFloat(String(weightValue ?? '').replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(num) || num <= 0) return 'small';
  if (num < 7) return 'small';
  if (num < 15) return 'medium';
  return 'large';
}

function parsePriceNumber(priceStr, fallback = 50000) {
  if (typeof priceStr === 'number' && Number.isFinite(priceStr)) return priceStr;
  const digits = String(priceStr || '').replace(/[^0-9]/g, '');
  const parsed = parseInt(digits, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function formatKrw(amount) {
  return `${Number(amount || 0).toLocaleString('ko-KR')}원`;
}

// 기본 제휴 미용실 (1시간 30분 단위 타임슬롯 + 샘플 후기/답글 포함)
const DEFAULT_SHOPS = [
  {
    id: 'default-1',
    name: '포포 멍뭉이 미용실',
    petType: 'dog',
    region: '인천',
    district: '남동구 구월동',
    desc: '강아지 스파/가위컷 전문 · 100% 예약제',
    price: '45,000원~',
    baseRating: 4.9,
    baseReviewCount: 2,
    defaultReviews: [
      {
        id: 'def-rev-1',
        customerName: '김민지',
        pet: '🐶 초코 (말티푸)',
        rating: 5,
        comment:
          '가위컷 라인이 정말 동글동글 예쁘게 나왔어요! 아이가 전혀 스트레스 안 받아해서 다음에도 또 예약할 예정입니다.',
        ownerReply:
          '초코 보호자님 소중한 후기 감사합니다! 초코가 너무 얌전하고 착해서 가위컷이 예쁘게 나왔어요. 다음에 또 뵈어요 🐾',
        hidden: false,
        date: '2026.11.12',
      },
      {
        id: 'def-rev-2',
        customerName: '박준영',
        pet: '🐶 몽이 (비숑)',
        rating: 5,
        comment:
          '탄산 스파하고 나서 털이 훨씬 부드러워졌어요. 1시간 30분 딱 맞춰서 꼼꼼하게 케어해 주십니다.',
        ownerReply: '',
        hidden: false,
        date: '2026.11.05',
      },
    ],
    lat: 37.4482,
    lng: 126.7015,
    timeSlots: ['10:00', '11:30', '13:00', '14:30', '16:00', '17:30'],
    services: [
      { name: '전체 가위컷 풀케어', price: '65,000원', duration: '1시간 30분' },
      { name: '클리핑(기계컷) + 얼굴컷', price: '45,000원', duration: '1시간 30분' },
      { name: '탄산 버블 스파 + 부분미용', price: '40,000원', duration: '1시간 30분' },
    ],
  },
  {
    id: 'default-2',
    name: '나비야 무마취 고양이 미용실',
    petType: 'cat',
    region: '서울',
    district: '마포구 연남동',
    desc: '고양이 전문 무마취 미용 · 강아지 출입 분리',
    price: '60,000원~',
    baseRating: 4.9,
    baseReviewCount: 2,
    defaultReviews: [
      {
        id: 'def-rev-3',
        customerName: '이서연',
        pet: '🐱 나비 (코리안숏헤어)',
        rating: 5,
        comment:
          '예민한 냥이라 걱정했는데 강아지 소리가 전혀 안 나고 핸들러님이 능숙하셔서 하악질 한 번 없이 끝났어요!',
        ownerReply:
          '나비가 용기를 내서 잘 견뎌줘서 정말 대견했어요! 편안한 집에서 푹 쉬게 해주세요 🐱',
        hidden: false,
        date: '2026.11.14',
      },
      {
        id: 'def-rev-4',
        customerName: '정현우',
        pet: '🐱 치즈 (페르시안)',
        rating: 5,
        comment:
          '배 쪽 엉킴이 심했는데 피부 상처 하나 없이 깔끔하게 정리해 주셨습니다. 집사님들께 강추해요.',
        ownerReply: '',
        hidden: false,
        date: '2026.11.08',
      },
    ],
    lat: 37.5612,
    lng: 126.9248,
    timeSlots: ['10:00', '11:30', '13:00', '14:30', '16:00', '17:30'],
    services: [
      { name: '고양이 무마취 전체 미용 (사자컷/올빡)', price: '75,000원', duration: '1시간 30분' },
      { name: '장모종 엉킴 제거 + 저자극 목욕', price: '65,000원', duration: '1시간 30분' },
      { name: '고양이 위생·발톱·귀 집중 케어', price: '30,000원', duration: '1시간 30분' },
    ],
  },
  {
    id: 'default-3',
    name: '힐링 멍냥 반려동물 케어',
    petType: 'both',
    region: '인천',
    district: '연수구 송도동',
    desc: '강아지·고양이 분리 묘실 운영 · 노령 반려동물 전문',
    price: '55,000원~',
    baseRating: 4.9,
    baseReviewCount: 2,
    defaultReviews: [
      {
        id: 'def-rev-5',
        customerName: '최유진',
        pet: '🐶 보리 (푸들)',
        rating: 5,
        comment:
          '노령견이라 다리 관절이 약한데 중간중간 쉬어가면서 배려해 주셔서 너무 감사했습니다.',
        ownerReply: '',
        hidden: false,
        date: '2026.11.10',
      },
      {
        id: 'def-rev-6',
        customerName: '강다혜',
        pet: '🐱 루나 (러시안블루)',
        rating: 5,
        comment:
          '강아지랑 고양이 공간이 완전히 분리되어 있어서 냥이가 안심하고 목욕까지 잘 마쳤어요.',
        ownerReply: '',
        hidden: false,
        date: '2026.11.02',
      },
    ],
    lat: 37.3827,
    lng: 126.6563,
    timeSlots: ['10:00', '11:30', '13:00', '14:30', '16:00', '17:30'],
    services: [
      { name: '[강아지] 노령견 맞춤 1:1 저자극 미용', price: '65,000원', duration: '1시간 30분' },
      { name: '[고양이] 스트레스 프리 무마취 미용', price: '70,000원', duration: '1시간 30분' },
      { name: '[공통] 약용 입욕 + 피부 진정 스파', price: '55,000원', duration: '1시간 30분' },
    ],
  },
  {
    id: 'default-4',
    name: '강남 프리미엄 펫살롱',
    petType: 'both',
    region: '서울',
    district: '강남구 신사동',
    desc: '강아지 스포팅 & 고양이 전담 핸들러 상주',
    price: '65,000원~',
    baseRating: 4.8,
    baseReviewCount: 1,
    defaultReviews: [
      {
        id: 'def-rev-7',
        customerName: '한지민',
        pet: '🐶 두부 (포메라니안)',
        rating: 5,
        comment:
          '스포팅 스타일 디테일이 남다릅니다. 미용 끝나고 케어 일지도 꼼꼼하게 보내주셔서 믿음이 가요.',
        ownerReply: '',
        hidden: false,
        date: '2026.11.15',
      },
    ],
    lat: 37.5236,
    lng: 127.0232,
    timeSlots: ['10:00', '11:30', '13:00', '14:30', '16:00', '17:30', '19:00'],
    services: [
      { name: '[강아지] 시그니처 스포팅 + 머즐 스타일링', price: '85,000원', duration: '1시간 30분' },
      { name: '[고양이] 2인 1조 안전 무마취 미용 + 목욕', price: '80,000원', duration: '1시간 30분' },
      { name: '[공통] 아로마 테라피 스파 패키지', price: '60,000원', duration: '1시간 30분' },
    ],
  },
  {
    id: 'default-5',
    name: '분당 냥이네 그루밍 스튜디오',
    petType: 'cat',
    region: '경기',
    district: '성남시 분당구',
    desc: '100% 고양이 전용 예약제 · 호르몬 디퓨저 케어',
    price: '60,000원~',
    baseRating: 5.0,
    baseReviewCount: 1,
    defaultReviews: [
      {
        id: 'def-rev-8',
        customerName: '오세훈',
        pet: '🐱 모찌 (스코티시폴드)',
        rating: 5,
        comment:
          '100% 예약제라 다른 손님이랑 마주칠 일이 없어서 고양이가 훨씬 편안해합니다.',
        ownerReply: '',
        hidden: false,
        date: '2026.11.11',
      },
    ],
    lat: 37.3826,
    lng: 127.1189,
    timeSlots: ['10:00', '11:30', '13:00', '14:30', '16:00', '17:30'],
    services: [
      { name: '고양이 전체 클리핑 + 목욕 풀코스', price: '75,000원', duration: '1시간 30분' },
      { name: '단모/장모 털빠짐 방지 딥클렌징 목욕', price: '60,000원', duration: '1시간 30분' },
      { name: '고양이 부분 미용 + 발톱/귀 케어', price: '35,000원', duration: '1시간 30분' },
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

function getPetTypeBadge(petType) {
  if (petType === 'cat') {
    return { label: '🐱 고양이 전문', bg: 'bg-purple-100 text-purple-700', icon: '🐱', color: '#9333ea' };
  }
  if (petType === 'both') {
    return { label: '🐶🐱 멍냥 모두', bg: 'bg-emerald-100 text-emerald-700', icon: '🐾', color: '#ea580c' };
  }
  return { label: '🐶 강아지 전문', bg: 'bg-amber-100 text-amber-800', icon: '🐶', color: '#f97316' };
}

// 후기 사진 안전 리사이징 및 압축 (Firestore 1MB 한도 초과 방지)
function renderCompressedDataUrl(img, maxWidth, quality) {
  const scale = img.width > maxWidth ? maxWidth / img.width : 1;
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

function compressImageFile(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const attempts = [
        [480, 0.62],
        [380, 0.52],
        [300, 0.45],
      ];
      let resultUrl = '';
      for (const [w, q] of attempts) {
        resultUrl = renderCompressedDataUrl(img, w, q);
        if (resultUrl.length <= MAX_COMPRESSED_DATA_URL_CHARS) {
          resolve(resultUrl);
          return;
        }
      }
      reject(new Error('사진 용량이 너무 커서 첨부할 수 없습니다. 더 작은 사진을 선택해 주세요.'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('이미지 파일을 읽을 수 없습니다.'));
    };
    img.src = objectUrl;
  });
}

// 인터랙티브 지도 컴포넌트
function GroomingMap({ shops, myLocation, onLocateMe, onSelectShop, selectedShop, isOverlayOpen }) {
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

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    setTimeout(() => {
      map.invalidateSize();
    }, 200);

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
      const badge = getPetTypeBadge(shop.petType);

      const shopIcon = L.divIcon({
        className: 'custom-shop-marker',
        html: `<div style="
          background:${isSelected ? '#0f172a' : badge.color};
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
          <span>${badge.icon}</span><span>${shop.name}</span>
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
    <div
      className={`relative w-full h-[330px] rounded-3xl overflow-hidden shadow-md border border-gray-200 bg-gray-100 ${
        isOverlayOpen ? 'invisible pointer-events-none' : 'z-0'
      }`}
    >
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {!isOverlayOpen && (
        <>
          <button
            type="button"
            onClick={onLocateMe}
            className="absolute bottom-3 right-3 z-[400] bg-white hover:bg-gray-50 text-slate-800 px-3.5 py-2 rounded-2xl shadow-lg border border-gray-200 text-xs font-extrabold flex items-center space-x-1.5 active:scale-95 transition"
          >
            <span className="text-blue-600">📍</span>
            <span>내 위치</span>
          </button>

          <div className="absolute top-3 left-3 z-[400] bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-2.5 text-[10px] font-bold text-gray-700">
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span>
              <span>내 위치</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-orange-500 inline-block"></span>
              <span>강아지/공통</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-purple-600 inline-block"></span>
              <span>고양이전문</span>
            </span>
          </div>
        </>
      )}
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
  const [signUpPetSpecies, setSignUpPetSpecies] = useState('dog');
  const [extraInfo, setExtraInfo] = useState('');

  // 실시간 DB 데이터
  const [bookings, setBookings] = useState([]);
  const [dbShops, setDbShops] = useState([]);
  const [blockedSlots, setBlockedSlots] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [notifications, setNotifications] = useState([]);

  // 알림 센터 모달 & 인앱 토스트 알림 상태
  const [showNotiModal, setShowNotiModal] = useState(false);
  const [liveToastNoti, setLiveToastNoti] = useState(null);
  const seenNotiIdsRef = useRef(new Set());
  const initialNotiLoadedRef = useRef(false);

  // 보호자 화면 탭 & 검색 & 지도 상태
  const [userTab, setUserTab] = useState('search');
  const [viewMode, setViewMode] = useState('map');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('전체');
  const [selectedSpeciesFilter, setSelectedSpeciesFilter] = useState('all');
  const [myLocation, setMyLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('');
  const [selectedMapShop, setSelectedMapShop] = useState(null);

  // 보호자 다둥이 반려동물 목록 상태
  const [petsList, setPetsList] = useState([]);
  const [editingPetId, setEditingPetId] = useState(null);
  const [petSpecies, setPetSpecies] = useState('dog');
  const [petName, setPetName] = useState('');
  const [petBreed, setPetBreed] = useState('');
  const [petWeight, setPetWeight] = useState('');
  const [petNote, setPetNote] = useState('');

  // 보호자 상세 예약 모달 상태 (체급별 비용 포함)
  const [bookingModalShop, setBookingModalShop] = useState(null);
  const [selectedBookingPetId, setSelectedBookingPetId] = useState('');
  const [bookingPetSpecies, setBookingPetSpecies] = useState('dog');
  const [bookingSizeTier, setBookingSizeTier] = useState('small');
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [selectedServiceIdx, setSelectedServiceIdx] = useState(0);
  const [customStyleDetail, setCustomStyleDetail] = useState('얼굴 동그랗게 (곰돌이컷)');
  const [bookingNote, setBookingNote] = useState('');

  // 매장 후기 전체 보기 모달 상태
  const [viewReviewsShopId, setViewReviewsShopId] = useState(null);

  // 보호자 리뷰 작성 모달 상태 (사진 첨부 포함)
  const [reviewModalBooking, setReviewModalBooking] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewPhotoData, setReviewPhotoData] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // 사장님 후기 답글 상태
  const [replyingReviewId, setReplyingReviewId] = useState(null);
  const [replyDraftText, setReplyDraftText] = useState('');

  // 사장님 화면 탭 & 매장/사장님 정보 수정 상태
  const [ownerTab, setOwnerTab] = useState('bookings');
  const [ownerNameInput, setOwnerNameInput] = useState('');
  const [shopNameInput, setShopNameInput] = useState('');
  const [shopPetType, setShopPetType] = useState('both');
  const [shopRegion, setShopRegion] = useState('서울');
  const [shopDistrict, setShopDistrict] = useState('');
  const [shopDesc, setShopDesc] = useState('');
  const [shopPrice, setShopPrice] = useState('50,000원~');
  const [shopTimeSlotsInput, setShopTimeSlotsInput] = useState(
    '10:00, 11:30, 13:00, 14:30, 16:00, 17:30'
  );
  const [shopSvc1Name, setShopSvc1Name] = useState('전체 가위컷 풀케어');
  const [shopSvc1Price, setShopSvc1Price] = useState('65,000원');
  const [shopSvc2Name, setShopSvc2Name] = useState('고양이 무마취 전체 미용');
  const [shopSvc2Price, setShopSvc2Price] = useState('70,000원');
  const [shopSvc3Name, setShopSvc3Name] = useState('탄산 스파 + 부분 위생미용');
  const [shopSvc3Price, setShopSvc3Price] = useState('35,000원');
  const [onlyMyShopBookings, setOnlyMyShopBookings] = useState(false);

  // 사장님 일정 차단(휴무/브레이크타임) 상태
  const [blockDate, setBlockDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [blockType, setBlockType] = useState('slot');
  const [blockTimeSlot, setBlockTimeSlot] = useState('13:00');
  const [blockReason, setBlockReason] = useState('점심시간 / 휴게');

  // 사장님 미용 완료 케어 일지 모달 상태
  const [careModalBooking, setCareModalBooking] = useState(null);
  const [careCondition, setCareCondition] = useState('컨디션 좋음 · 협조적');
  const [careNoteInput, setCareNoteInput] = useState('');

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

  // 상대방에게 인앱 알림 발송 헬퍼
  const sendNotification = async ({ recipientId, title, message, type }) => {
    if (!recipientId || recipientId === user?.uid || String(recipientId).startsWith('default-')) {
      return;
    }
    try {
      await addDoc(collection(db, 'notifications'), {
        recipientId,
        senderId: user?.uid || '',
        senderName: maskCustomerName(userProfile?.name || '사용자'),
        title,
        message,
        type: type || 'info',
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('알림 발송 실패:', err);
    }
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

          if (data.role === 'user') {
            let loadedPets = [];
            if (Array.isArray(data.pets) && data.pets.length > 0) {
              loadedPets = data.pets;
            } else if (data.petDetail && data.petDetail.petName) {
              loadedPets = [
                {
                  id: 'pet-initial',
                  petSpecies: data.petDetail.petSpecies || 'dog',
                  petName: data.petDetail.petName,
                  petBreed: data.petDetail.petBreed || '',
                  petWeight: data.petDetail.petWeight || '',
                  petNote: data.petDetail.petNote || '',
                },
              ];
            } else if (data.extraInfo) {
              loadedPets = [
                {
                  id: 'pet-initial',
                  petSpecies: 'dog',
                  petName: data.extraInfo.replace(/^[🐶🐱]\s*/, ''),
                  petBreed: '',
                  petWeight: '',
                  petNote: '',
                },
              ];
            }
            setPetsList(loadedPets);
            detectMyLocation(false);
          } else if (data.role === 'owner') {
            setOwnerNameInput(data.name || '');
            setShopNameInput(data.extraInfo || '');
            const shopSnap = await getDoc(doc(db, 'shops', currentUser.uid));
            if (shopSnap.exists()) {
              const sData = shopSnap.data();
              setShopNameInput(sData.name || data.extraInfo || '');
              setShopPetType(sData.petType || 'both');
              setShopRegion(sData.region || '서울');
              setShopDistrict(sData.district || '');
              setShopDesc(sData.desc || '');
              setShopPrice(sData.price || '50,000원~');
              if (sData.timeSlots && sData.timeSlots.length > 0) {
                setShopTimeSlotsInput(sData.timeSlots.join(', '));
              }
              if (sData.services && sData.services.length >= 3) {
                setShopSvc1Name(sData.services[0].name || '');
                setShopSvc1Price(sData.services[0].price || '');
                setShopSvc2Name(sData.services[1].name || '');
                setShopSvc2Price(sData.services[1].price || '');
                setShopSvc3Name(sData.services[2].name || '');
                setShopSvc3Price(sData.services[2].price || '');
              }
            }
          }
        }
      } else {
        setUser(null);
        setUserProfile(null);
        setPetsList([]);
        setNotifications([]);
        initialNotiLoadedRef.current = false;
        seenNotiIdsRef.current = new Set();
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

    const qBlocked = query(collection(db, 'blockedSlots'), orderBy('createdAt', 'desc'));
    const unsubBlocked = onSnapshot(qBlocked, (snapshot) => {
      setBlockedSlots(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const qReviews = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'));
    const unsubReviews = onSnapshot(qReviews, (snapshot) => {
      setReviews(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const qNoti = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'));
    const unsubNoti = onSnapshot(qNoti, (snapshot) => {
      const mine = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((n) => n.recipientId === user.uid);

      setNotifications(mine);

      if (!initialNotiLoadedRef.current) {
        mine.forEach((n) => seenNotiIdsRef.current.add(n.id));
        initialNotiLoadedRef.current = true;
        return;
      }

      const brandNew = mine.filter((n) => !seenNotiIdsRef.current.has(n.id) && !n.read);
      mine.forEach((n) => seenNotiIdsRef.current.add(n.id));

      if (brandNew.length > 0) {
        setLiveToastNoti(brandNew[0]);
      }
    });

    return () => {
      unsubBookings();
      unsubShops();
      unsubBlocked();
      unsubReviews();
      unsubNoti();
    };
  }, [user]);

  useEffect(() => {
    if (!liveToastNoti) return;
    const timer = setTimeout(() => setLiveToastNoti(null), 4500);
    return () => clearTimeout(timer);
  }, [liveToastNoti]);

  const handleMarkNotiRead = async (notiId) => {
    try {
      await updateDoc(doc(db, 'notifications', notiId), { read: true });
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllNotiRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    try {
      const batch = writeBatch(db);
      unread.forEach((n) => {
        batch.update(doc(db, 'notifications', n.id), { read: true });
      });
      await batch.commit();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      if (isSignUp) {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        const defaultLabel = signUpPetSpecies === 'cat' ? '반려묘' : '반려견';
        const firstPet =
          role === 'user'
            ? [
                {
                  id: `pet-${Date.now()}`,
                  petSpecies: signUpPetSpecies,
                  petName: extraInfo || defaultLabel,
                  petBreed: '',
                  petWeight: '',
                  petNote: '',
                },
              ]
            : [];
        const profileData = {
          uid: res.user.uid,
          email,
          name: name || '사용자',
          role,
          extraInfo: extraInfo || (role === 'user' ? defaultLabel : '포포 제휴 미용실'),
          pets: firstPet,
          createdAt: serverTimestamp(),
        };
        await setDoc(doc(db, 'users', res.user.uid), profileData);
        setUserProfile(profileData);
        if (role === 'user') {
          setPetsList(firstPet);
          detectMyLocation(false);
        } else {
          setOwnerNameInput(name || '사장님');
          setShopNameInput(extraInfo || '포포 제휴 미용실');
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

  const openShopBookingModal = (shop) => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const compatiblePets = petsList.filter((p) => {
      if (shop.petType === 'cat') return p.petSpecies === 'cat';
      if (shop.petType === 'dog') return p.petSpecies === 'dog';
      return true;
    });

    const chosenPet = compatiblePets[0] || petsList[0] || null;
    const initialSpecies = chosenPet
      ? chosenPet.petSpecies
      : shop.petType === 'cat'
      ? 'cat'
      : 'dog';
    const inferredTier = chosenPet ? getSizeTierByWeight(chosenPet.petWeight) : 'small';

    setBookingModalShop(shop);
    setSelectedBookingPetId(chosenPet ? chosenPet.id : 'manual');
    setBookingPetSpecies(initialSpecies);
    setBookingSizeTier(inferredTier);
    setBookingDate(tomorrow);
    setBookingTime('');
    setSelectedServiceIdx(0);
    setCustomStyleDetail(
      initialSpecies === 'cat' ? '무마취 전체 클리핑 (사자컷/올빡)' : '얼굴 동그랗게 (곰돌이컷)'
    );
    setBookingNote('');
  };

  const handleSelectPetForBooking = (pet) => {
    setSelectedBookingPetId(pet.id);
    setBookingPetSpecies(pet.petSpecies);
    setBookingSizeTier(getSizeTierByWeight(pet.petWeight));
    setCustomStyleDetail(
      pet.petSpecies === 'cat' ? '무마취 전체 클리핑 (사자컷/올빡)' : '얼굴 동그랗게 (곰돌이컷)'
    );
  };

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
        : [
            {
              name: '전체 미용 기본 (1시간30분 소요)',
              price: bookingModalShop.price || '50,000원',
              duration: '1시간 30분',
            },
          ];

    const chosenService = shopServices[selectedServiceIdx] || shopServices[0];
    const baseAmount = parsePriceNumber(chosenService.price, 50000);
    const tierInfo = SIZE_TIERS[bookingSizeTier] || SIZE_TIERS.small;
    const totalAmount = baseAmount + tierInfo.extraFee;

    const selectedPetObj = petsList.find((p) => p.id === selectedBookingPetId);
    const activeSpecies = selectedPetObj ? selectedPetObj.petSpecies : bookingPetSpecies;
    const speciesTag = activeSpecies === 'cat' ? '🐱 고양이' : '🐶 강아지';

    const petSummary = selectedPetObj
      ? `[${speciesTag}] ${selectedPetObj.petName}${
          selectedPetObj.petBreed
            ? ` (${selectedPetObj.petBreed}${selectedPetObj.petWeight ? `, ${selectedPetObj.petWeight}kg` : ''})`
            : selectedPetObj.petWeight
            ? ` (${selectedPetObj.petWeight}kg)`
            : ''
        }`
      : `[${speciesTag}] ${userProfile?.extraInfo || '반려동물'}`;

    const finalPetNote = selectedPetObj?.petNote || '특이사항 없음';

    try {
      await addDoc(collection(db, 'bookings'), {
        shopId: bookingModalShop.id,
        shop: bookingModalShop.name,
        shopRegion: `${bookingModalShop.region} ${bookingModalShop.district || ''}`.trim(),
        customerId: user.uid,
        customer: userProfile?.name || '보호자',
        petId: selectedPetObj?.id || '',
        petSpecies: activeSpecies,
        sizeTier: tierInfo.id,
        sizeTierLabel: tierInfo.label,
        pet: petSummary,
        petNote: finalPetNote,
        service: `${chosenService.name} · ${tierInfo.shortLabel} (${formatKrw(totalAmount)})`,
        styleDetail: customStyleDetail,
        requestNote: bookingNote || '없음',
        bookingDate,
        bookingTime,
        time: `${bookingDate} ${bookingTime} (1시간30분)`,
        status: '대기 중',
        reviewed: false,
        createdAt: serverTimestamp(),
      });
      alert(
        `"${bookingModalShop.name}" (${bookingDate} ${bookingTime}, ${tierInfo.shortLabel} ${formatKrw(
          totalAmount
        )}) 예약 신청이 완료되었습니다!`
      );
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

  // 리뷰 사진 파일 선택 핸들러
  const handleReviewPhotoChange = async (e) => {
    const inputEl = e.target;
    const file = inputEl.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const compressed = await compressImageFile(file);
      setReviewPhotoData(compressed);
    } catch (err) {
      alert(err?.message || '사진을 불러오지 못했습니다.');
      setReviewPhotoData('');
    } finally {
      setUploadingPhoto(false);
      inputEl.value = '';
    }
  };

  // 보호자: 별점/후기 + 사진 등록 + 사장님 알림 발송
  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!reviewModalBooking || uploadingPhoto) return;
    const finalComment = reviewText.trim() || '꼼꼼하고 친절하게 잘 미용해 주셨어요!';
    const displayCustomerName = maskCustomerName(userProfile?.name || '보호자');

    try {
      await addDoc(collection(db, 'reviews'), {
        bookingId: reviewModalBooking.id,
        shopId: reviewModalBooking.shopId,
        shopName: reviewModalBooking.shop,
        customerId: user.uid,
        customerName: displayCustomerName,
        pet: reviewModalBooking.pet,
        rating: Number(reviewRating),
        comment: finalComment,
        photoUrl: reviewPhotoData || '',
        ownerReply: '',
        hidden: false,
        date: new Date().toLocaleDateString('ko-KR'),
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'bookings', reviewModalBooking.id), {
        reviewed: true,
        reviewRating: Number(reviewRating),
        reviewComment: finalComment,
        reviewPhotoUrl: reviewPhotoData || '',
      });

      await sendNotification({
        recipientId: reviewModalBooking.shopId,
        title: `⭐ 새 후기 등록 (${reviewRating}점)`,
        message: `${displayCustomerName}님이 "${reviewModalBooking.shop}"에 후기를 남겼습니다: "${finalComment.slice(
          0,
          36
        )}"`,
        type: 'review',
      });

      alert('소중한 별점 후기가 등록되었습니다!');
      setReviewModalBooking(null);
      setReviewText('');
      setReviewRating(5);
      setReviewPhotoData('');
    } catch (err) {
      alert('후기 등록 실패: ' + err.message);
    }
  };

  // 사장님: 후기 가리기 / 해제 토글
  const handleToggleHideReview = async (rev) => {
    if (!rev?.id) return;
    if (String(rev.id).startsWith('def-rev-')) {
      alert('기본 샘플 후기는 가리기 상태를 변경할 수 없습니다.');
      return;
    }
    const nextHidden = !Boolean(rev.hidden);
    try {
      await updateDoc(doc(db, 'reviews', rev.id), {
        hidden: nextHidden,
      });
      alert(
        nextHidden
          ? '후기가 비방성/욕설 가리기 처리되었습니다.'
          : '후기 가리기가 해제되었습니다.'
      );
    } catch (err) {
      alert('가리기 상태 변경 실패: ' + err.message);
    }
  };

  // 사장님: 후기 답글 저장 + 보호자 알림 발송
  const handleSaveOwnerReply = async (reviewId) => {
    const trimmedReply = replyDraftText.trim();
    if (!trimmedReply) {
      alert('답글 내용을 입력해 주세요.');
      return;
    }
    try {
      const targetReview = reviews.find((r) => r.id === reviewId);
      await updateDoc(doc(db, 'reviews', reviewId), {
        ownerReply: trimmedReply,
        ownerReplyAt: new Date().toLocaleDateString('ko-KR'),
      });
      if (targetReview?.bookingId) {
        const linkedBooking = bookings.find((b) => b.id === targetReview.bookingId);
        if (linkedBooking) {
          await updateDoc(doc(db, 'bookings', linkedBooking.id), {
            ownerReply: trimmedReply,
          });
        }
      }

      if (targetReview?.customerId) {
        await sendNotification({
          recipientId: targetReview.customerId,
          title: `💬 ${targetReview.shopName || '미용실'} 사장님 답글`,
          message: `작성하신 후기에 사장님 답글이 달렸습니다: "${trimmedReply.slice(0, 36)}"`,
          type: 'reply',
        });
      }

      setReplyingReviewId(null);
      setReplyDraftText('');
      alert('사장님 답글이 등록되었습니다!');
    } catch (err) {
      alert('답글 저장 실패: ' + err.message);
    }
  };

  // 리뷰 삭제 (보호자 본인 후기 또는 사장님 매장 후기)
  const handleDeleteReview = async (rev) => {
    if (!rev?.id) return;
    if (String(rev.id).startsWith('def-rev-')) {
      alert('기본 샘플 후기는 삭제할 수 없습니다.');
      return;
    }
    if (!window.confirm('이 리뷰를 삭제하시겠습니까?')) return;

    try {
      await deleteDoc(doc(db, 'reviews', rev.id));
      if (rev.bookingId) {
        const targetBooking = bookings.find((b) => b.id === rev.bookingId);
        if (targetBooking) {
          await updateDoc(doc(db, 'bookings', rev.bookingId), {
            reviewed: false,
            reviewRating: null,
            reviewComment: '',
            reviewPhotoUrl: '',
            ownerReply: '',
          });
        }
      }
      if (replyingReviewId === rev.id) {
        setReplyingReviewId(null);
        setReplyDraftText('');
      }
      alert('리뷰가 삭제되었습니다.');
    } catch (err) {
      alert('리뷰 삭제 실패: ' + err.message);
    }
  };

  // 다둥이 반려동물 추가 또는 수정 저장
  const handleSavePetItem = async (e) => {
    e.preventDefault();
    const trimmedName = petName.trim();
    if (!trimmedName) {
      alert('반려동물 이름을 입력해 주세요.');
      return;
    }

    let updatedPets = [];
    if (editingPetId) {
      updatedPets = petsList.map((p) =>
        p.id === editingPetId
          ? {
              ...p,
              petSpecies,
              petName: trimmedName,
              petBreed: petBreed.trim(),
              petWeight: petWeight.trim(),
              petNote: petNote.trim(),
            }
          : p
      );
    } else {
      const newPet = {
        id: `pet-${Date.now()}`,
        petSpecies,
        petName: trimmedName,
        petBreed: petBreed.trim(),
        petWeight: petWeight.trim(),
        petNote: petNote.trim(),
      };
      updatedPets = [...petsList, newPet];
    }

    const summaryText =
      updatedPets.length > 1
        ? `${updatedPets[0].petName} 외 ${updatedPets.length - 1}마리`
        : updatedPets[0]?.petName || '반려동물';

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        pets: updatedPets,
        extraInfo: summaryText,
      });
      setPetsList(updatedPets);
      setUserProfile({ ...userProfile, pets: updatedPets, extraInfo: summaryText });
      resetPetForm();
      alert(editingPetId ? '반려동물 정보가 수정되었습니다!' : '새 반려동물이 추가되었습니다!');
    } catch (err) {
      alert('저장 실패: ' + err.message);
    }
  };

  const handleEditPetClick = (pet) => {
    setEditingPetId(pet.id);
    setPetSpecies(pet.petSpecies || 'dog');
    setPetName(pet.petName || '');
    setPetBreed(pet.petBreed || '');
    setPetWeight(pet.petWeight || '');
    setPetNote(pet.petNote || '');
  };

  const handleDeletePet = async (petId) => {
    if (!window.confirm('이 반려동물 프로필을 삭제하시겠습니까?')) return;
    const updatedPets = petsList.filter((p) => p.id !== petId);
    const summaryText =
      updatedPets.length > 1
        ? `${updatedPets[0].petName} 외 ${updatedPets.length - 1}마리`
        : updatedPets[0]?.petName || '반려동물';

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        pets: updatedPets,
        extraInfo: summaryText,
      });
      setPetsList(updatedPets);
      setUserProfile({ ...userProfile, pets: updatedPets, extraInfo: summaryText });
      if (editingPetId === petId) resetPetForm();
    } catch (err) {
      alert('삭제 실패: ' + err.message);
    }
  };

  const resetPetForm = () => {
    setEditingPetId(null);
    setPetSpecies('dog');
    setPetName('');
    setPetBreed('');
    setPetWeight('');
    setPetNote('');
  };

  // 사장님: 일정 차단 등록
  const handleAddBlockedSlot = async (e) => {
    e.preventDefault();
    if (!blockDate) {
      alert('차단할 날짜를 선택해 주세요.');
      return;
    }
    try {
      await addDoc(collection(db, 'blockedSlots'), {
        shopId: user.uid,
        shopName: userProfile.extraInfo,
        date: blockDate,
        type: blockType,
        timeSlot: blockType === 'full' ? 'ALL' : blockTimeSlot,
        reason: blockReason.trim() || (blockType === 'full' ? '매장 휴무일' : '일정 마감'),
        createdAt: serverTimestamp(),
      });
      alert(
        blockType === 'full'
          ? `${blockDate} 하루 전체 예약이 차단되었습니다.`
          : `${blockDate} ${blockTimeSlot} 타임 예약이 차단되었습니다.`
      );
    } catch (err) {
      alert('일정 차단 실패: ' + err.message);
    }
  };

  const handleRemoveBlockedSlot = async (id) => {
    try {
      await deleteDoc(doc(db, 'blockedSlots', id));
    } catch (err) {
      alert('차단 해제 실패: ' + err.message);
    }
  };

  // 사장님: 미용 완료 처리 + 그루머 케어 일지 저장 + 보호자 알림 발송
  const handleCompleteWithCareNote = async (e) => {
    e.preventDefault();
    if (!careModalBooking) return;
    const finalCareNote = careNoteInput.trim() || '오늘 미용도 스트레스 없이 얌전히 잘 받았습니다!';
    try {
      await updateDoc(doc(db, 'bookings', careModalBooking.id), {
        status: '미용 완료',
        careReport: {
          condition: careCondition,
          note: finalCareNote,
          completedAt: new Date().toLocaleDateString('ko-KR'),
        },
      });

      if (careModalBooking.customerId) {
        await sendNotification({
          recipientId: careModalBooking.customerId,
          title: `✂️ ${careModalBooking.shop || '미용실'} 미용 완료!`,
          message: `${careModalBooking.pet} 미용이 완료되고 케어 일지(${careCondition})가 도착했습니다.`,
          type: 'care',
        });
      }

      alert('미용 완료 처리 및 보호자 케어 일지가 전송되었습니다!');
      setCareModalBooking(null);
      setCareNoteInput('');
    } catch (err) {
      alert('케어 일지 저장 실패: ' + err.message);
    }
  };

  const handleRegisterShop = async (e) => {
    e.preventDefault();
    const trimmedShopName = shopNameInput.trim();
    const trimmedOwnerName = ownerNameInput.trim() || userProfile.name || '사장님';

    if (!trimmedShopName) {
      alert('매장명을 입력해 주세요.');
      return;
    }

    const oldShopName = userProfile.extraInfo;
    const baseCoord = REGION_CENTERS[shopRegion] || REGION_CENTERS['서울'];
    const randomOffsetLat = (Math.random() - 0.5) * 0.02;
    const randomOffsetLng = (Math.random() - 0.5) * 0.02;

    const parsedSlots = shopTimeSlotsInput
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const customServices = [
      { name: shopSvc1Name || '전체 가위컷', price: shopSvc1Price || '65,000원', duration: '1시간 30분' },
      { name: shopSvc2Name || '고양이 무마취 미용', price: shopSvc2Price || '70,000원', duration: '1시간 30분' },
      { name: shopSvc3Name || '스파 + 부분미용', price: shopSvc3Price || '35,000원', duration: '1시간 30분' },
    ];

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name: trimmedOwnerName,
        extraInfo: trimmedShopName,
      });
      setUserProfile({
        ...userProfile,
        name: trimmedOwnerName,
        extraInfo: trimmedShopName,
      });

      const existingShop = dbShops.find((s) => s.id === user.uid);
      await setDoc(doc(db, 'shops', user.uid), {
        ownerId: user.uid,
        name: trimmedShopName,
        petType: shopPetType,
        region: shopRegion,
        district: shopDistrict || '중심가',
        desc: shopDesc || '정성껏 케어하는 강아지·고양이 전문 미용실',
        price: shopSvc2Price || shopPrice || '50,000원~',
        lat: existingShop?.lat || baseCoord.lat + randomOffsetLat,
        lng: existingShop?.lng || baseCoord.lng + randomOffsetLng,
        timeSlots:
          parsedSlots.length > 0
            ? parsedSlots
            : ['10:00', '11:30', '13:00', '14:30', '16:00', '17:30'],
        services: customServices,
        createdAt: existingShop?.createdAt || serverTimestamp(),
      });

      if (oldShopName && oldShopName !== trimmedShopName) {
        const myShopBookings = bookings.filter(
          (b) => b.shopId === user.uid || b.shop === oldShopName
        );
        await Promise.all(
          myShopBookings.map((b) =>
            updateDoc(doc(db, 'bookings', b.id), {
              shop: trimmedShopName,
              shopId: user.uid,
            })
          )
        );
      }

      alert(`"${trimmedShopName}" 매장 및 사장님 정보가 성공적으로 저장되었습니다!`);
      setOwnerTab('bookings');
    } catch (err) {
      alert('정보 저장 실패: ' + err.message);
    }
  };

  const updateStatus = async (id, newStatus) => {
    try {
      await updateDoc(doc(db, 'bookings', id), { status: newStatus });
    } catch (err) {
      alert('상태 변경 실패: ' + err.message);
    }
  };

  const unreadNotiCount = notifications.filter((n) => !n.read).length;

  const renderNotiModal = () =>
    showNotiModal && (
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-[10001]">
        <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[80vh] overflow-y-auto p-6 space-y-4 shadow-2xl border border-gray-100 text-gray-900">
          <div className="flex justify-between items-center border-b border-gray-100 pb-3">
            <div>
              <h3 className="font-black text-gray-900 text-base">🔔 알림 센터</h3>
              <p className="text-[11px] text-gray-400">
                미용 완료, 후기 등록, 사장님 답글 알림 내역
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {unreadNotiCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllNotiRead}
                  className="text-[11px] text-orange-600 font-bold underline"
                >
                  모두 읽음
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowNotiModal(false)}
                className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 font-bold hover:bg-gray-200 transition"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-400">
                아직 도착한 알림이 없습니다.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.read && handleMarkNotiRead(n.id)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition space-y-1 ${
                    n.read
                      ? 'bg-gray-50 border-gray-100 text-gray-500'
                      : 'bg-orange-50/70 border-orange-200 text-gray-900'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-extrabold">{n.title}</span>
                    {!n.read && (
                      <span className="text-[10px] bg-orange-500 text-white px-2 py-0.5 rounded-full font-bold">
                        NEW
                      </span>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed">{n.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );

  const renderLiveToast = () =>
    liveToastNoti && (
      <div
        onClick={() => {
          setLiveToastNoti(null);
          setShowNotiModal(true);
        }}
        className="fixed bottom-5 left-1/2 -translate-x-1/2 max-w-sm w-[92%] bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-orange-400/60 z-[10002] cursor-pointer flex items-start space-x-3"
      >
        <span className="text-lg">🔔</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-orange-300 truncate">{liveToastNoti.title}</p>
          <p className="text-xs text-slate-200 mt-0.5 line-clamp-2">{liveToastNoti.message}</p>
        </div>
      </div>
    );

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
              {isSignUp
                ? '강아지·고양이 보호자와 미용실을 잇는 스마트 플랫폼'
                : '다시 오신 것을 환영합니다!'}
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
                    🐶🐱 멍냥 보호자
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

                {role === 'user' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSignUpPetSpecies('dog')}
                      className={`py-2 rounded-xl text-xs font-bold border transition ${
                        signUpPetSpecies === 'dog'
                          ? 'bg-orange-50 border-orange-500 text-orange-700'
                          : 'bg-white border-gray-200 text-gray-500'
                      }`}
                    >
                      🐶 강아지 보호자
                    </button>
                    <button
                      type="button"
                      onClick={() => setSignUpPetSpecies('cat')}
                      className={`py-2 rounded-xl text-xs font-bold border transition ${
                        signUpPetSpecies === 'cat'
                          ? 'bg-purple-50 border-purple-500 text-purple-700'
                          : 'bg-white border-gray-200 text-gray-500'
                      }`}
                    >
                      🐱 고양이 집사
                    </button>
                  </div>
                )}

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
                    {role === 'user'
                      ? signUpPetSpecies === 'cat'
                        ? '첫째 반려묘 이름 (가입 후 추가 가능)'
                        : '첫째 반려견 이름 (가입 후 추가 가능)'
                      : '미용실 상호명'}
                  </label>
                  <input
                    type="text"
                    placeholder={
                      role === 'user'
                        ? signUpPetSpecies === 'cat'
                          ? '예: 나비'
                          : '예: 초코'
                        : '예: 포포 멍냥 미용실'
                    }
                    value={extraInfo}
                    onChange={(e) => setExtraInfo(e.target.value)}
                    required
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:bg-white focus:border-orange-500 focus:outline-none transition"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1 ml-1">
                이메일 주소
              </label>
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
    const allShops = [...dbShops, ...DEFAULT_SHOPS].map((shop) => {
      const liveReviews = reviews.filter((r) => r.shopId === shop.id || r.shopName === shop.name);
      const sampleReviews = Array.isArray(shop.defaultReviews) ? shop.defaultReviews : [];
      const mergedReviews = [...liveReviews, ...sampleReviews];

      const visibleReviewsForRating = mergedReviews.filter((r) => !r.hidden);
      const totalReviews = mergedReviews.length;
      const sumScore = visibleReviewsForRating.reduce(
        (acc, r) => acc + (Number(r.rating) || 5),
        0
      );
      const avgRating =
        visibleReviewsForRating.length > 0
          ? (sumScore / visibleReviewsForRating.length).toFixed(1)
          : shop.baseRating
          ? Number(shop.baseRating).toFixed(1)
          : '5.0';

      return {
        ...shop,
        petType: shop.petType || 'dog',
        avgRating,
        totalReviews,
        shopReviews: mergedReviews,
        distanceKm: myLocation
          ? calcDistanceKm(myLocation.lat, myLocation.lng, shop.lat, shop.lng)
          : null,
      };
    });

    const activeReviewsShop = viewReviewsShopId
      ? allShops.find((s) => s.id === viewReviewsShopId) || null
      : null;

    const myBookings = bookings.filter((b) => b.customerId === user.uid);

    const filteredShops = allShops
      .filter((shop) => {
        const matchesRegion = selectedRegion === '전체' || shop.region === selectedRegion;
        const matchesSpecies =
          selectedSpeciesFilter === 'all' ||
          shop.petType === 'both' ||
          shop.petType === selectedSpeciesFilter;
        const keyword = searchTerm.toLowerCase();
        const matchesSearch =
          shop.name.toLowerCase().includes(keyword) ||
          (shop.district && shop.district.toLowerCase().includes(keyword)) ||
          (shop.desc && shop.desc.toLowerCase().includes(keyword));
        return matchesRegion && matchesSpecies && matchesSearch;
      })
      .sort((a, b) => {
        if (a.distanceKm && b.distanceKm) {
          return parseFloat(a.distanceKm) - parseFloat(b.distanceKm);
        }
        return 0;
      });

    const modalTimeSlots =
      bookingModalShop?.timeSlots && bookingModalShop.timeSlots.length > 0
        ? bookingModalShop.timeSlots
        : ['10:00', '11:30', '13:00', '14:30', '16:00', '17:30'];

    const modalServices =
      bookingModalShop?.services && bookingModalShop.services.length > 0
        ? bookingModalShop.services
        : [
            {
              name: '전체 미용 기본 (1시간30분 소요)',
              price: bookingModalShop?.price || '50,000원',
              duration: '1시간 30분',
            },
          ];

    const activeServiceObj = modalServices[selectedServiceIdx] || modalServices[0];
    const activeBasePrice = parsePriceNumber(activeServiceObj?.price, 50000);
    const activeTierObj = SIZE_TIERS[bookingSizeTier] || SIZE_TIERS.small;
    const estimatedTotalPrice = activeBasePrice + activeTierObj.extraFee;

    const bookedTimesForShopAndDate = bookingModalShop
      ? bookings
          .filter(
            (b) =>
              (b.shopId === bookingModalShop.id || b.shop === bookingModalShop.name) &&
              b.status !== '거절됨' &&
              (b.bookingDate === bookingDate || (b.time && b.time.startsWith(bookingDate)))
          )
          .map((b) => b.bookingTime || (b.time ? b.time.split(' ')[1] : ''))
      : [];

    const shopBlocksOnDate = bookingModalShop
      ? blockedSlots.filter(
          (blk) =>
            (blk.shopId === bookingModalShop.id || blk.shopName === bookingModalShop.name) &&
            blk.date === bookingDate
        )
      : [];
    const isFullDayBlocked = shopBlocksOnDate.some((blk) => blk.type === 'full');
    const blockedTimeList = shopBlocksOnDate
      .filter((blk) => blk.type === 'slot')
      .map((blk) => blk.timeSlot);

    const todayStr = new Date().toISOString().split('T')[0];

    const styleOptionsBySpecies =
      bookingPetSpecies === 'cat'
        ? [
            '무마취 전체 클리핑 (사자컷/올빡)',
            '장모종 엉킴 제거 + 썸머컷',
            '저자극 목욕 + 죽은털(언더코트) 케어',
            '위생미용 + 발톱·귀 집중 관리',
          ]
        : [
            '얼굴 동그랗게 (곰돌이컷)',
            '전체 가위컷 (스포팅)',
            '깔끔 클리핑 (3mm/6mm)',
            '위생·목욕 중심 (최소 컷)',
          ];

    const isAnyModalOpen = Boolean(
      bookingModalShop || reviewModalBooking || activeReviewsShop || showNotiModal
    );

    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <header className="bg-white/80 backdrop-blur-md shadow-sm px-4 py-3.5 flex justify-between items-center sticky top-0 z-20 border-b border-gray-100">
          <div className="flex items-center space-x-2">
            <div className="bg-orange-100 text-orange-600 p-1.5 rounded-xl text-base shadow-sm">🐾</div>
            <div>
              <p className="text-[11px] text-gray-400 font-bold leading-none">
                반려동물 {petsList.length}마리 등록됨
              </p>
              <h2 className="font-extrabold text-gray-800 text-sm mt-0.5">{userProfile.name}님</h2>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setShowNotiModal(true)}
              className="relative text-xs bg-orange-50 hover:bg-orange-100 text-orange-700 px-3 py-1.5 rounded-xl font-extrabold border border-orange-200 transition"
            >
              🔔 알림
              {unreadNotiCount > 0 && (
                <span className="ml-1 bg-rose-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                  {unreadNotiCount}
                </span>
              )}
            </button>
            <button
              onClick={handleLogout}
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-xl font-bold transition"
            >
              로그아웃
            </button>
          </div>
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
              <span>🐾</span>
              <span>내 아이 ({petsList.length})</span>
            </button>
          </div>
        </div>

        <main className="max-w-md mx-auto p-4 space-y-4">
          {userTab === 'search' && (
            <>
              <div className="grid grid-cols-3 gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100">
                {[
                  { id: 'all', label: '🐾 전체 미용실' },
                  { id: 'dog', label: '🐶 강아지' },
                  { id: 'cat', label: '🐱 고양이 (무마취)' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelectedSpeciesFilter(item.id);
                      setSelectedMapShop(null);
                    }}
                    className={`py-2 rounded-xl text-xs font-extrabold transition ${
                      selectedSpeciesFilter === item.id
                        ? item.id === 'cat'
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'bg-orange-500 text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="space-y-2.5">
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
                    🔍
                  </span>
                  <input
                    type="text"
                    placeholder="지역(구/동), 미용실 이름, 무마취·스파 검색"
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
                    isOverlayOpen={isAnyModalOpen}
                  />

                  {selectedMapShop ? (
                    <div className="bg-white p-4 rounded-2xl shadow-lg border-2 border-orange-400 flex justify-between items-center transition">
                      <div className="pr-2 space-y-1">
                        <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              getPetTypeBadge(selectedMapShop.petType).bg
                            }`}
                          >
                            {getPetTypeBadge(selectedMapShop.petType).label}
                          </span>
                          <button
                            type="button"
                            onClick={() => setViewReviewsShopId(selectedMapShop.id)}
                            className="text-[10px] bg-amber-100 hover:bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-extrabold underline"
                          >
                            ⭐ {selectedMapShop.avgRating} · 후기 {selectedMapShop.totalReviews}건 보기
                          </button>
                          {selectedMapShop.distanceKm && (
                            <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">
                              {selectedMapShop.distanceKm}km
                            </span>
                          )}
                        </div>
                        <h4 className="font-black text-gray-900 text-sm">{selectedMapShop.name}</h4>
                        <p className="text-xs text-gray-500">{selectedMapShop.desc}</p>
                        <p className="text-xs font-extrabold text-orange-600">
                          {selectedMapShop.price} (소·중·대형 체급별 차등)
                        </p>
                      </div>
                      <button
                        onClick={() => openShopBookingModal(selectedMapShop)}
                        className="shrink-0 bg-orange-500 hover:bg-orange-600 text-white text-xs px-4 py-3 rounded-xl font-bold shadow-md transition"
                      >
                        예약하기
                      </button>
                    </div>
                  ) : (
                    <p className="text-center text-xs text-gray-400 py-1 font-medium">
                      👆 지도 위의 매장 핀을 누르면 상세 정보와 후기·예약 버튼이 나타납니다.
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
                    <p className="text-xs text-gray-400 font-medium">
                      조건에 일치하는 미용실이 없습니다.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredShops.map((shop) => {
                      const badge = getPetTypeBadge(shop.petType);
                      return (
                        <div
                          key={shop.id}
                          onClick={() => {
                            setSelectedMapShop(shop);
                            if (viewMode === 'list') setViewMode('map');
                          }}
                          className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center hover:shadow-md transition cursor-pointer"
                        >
                          <div className="pr-2 space-y-1">
                            <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${badge.bg}`}
                              >
                                {badge.label}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewReviewsShopId(shop.id);
                                }}
                                className="text-[10px] bg-amber-100 hover:bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-extrabold transition"
                              >
                                ⭐ {shop.avgRating} · 후기 {shop.totalReviews}건 보기
                              </button>
                              {shop.distanceKm && (
                                <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">
                                  {shop.distanceKm}km
                                </span>
                              )}
                            </div>
                            <h4 className="font-extrabold text-gray-900 text-sm">{shop.name}</h4>
                            <p className="text-xs text-gray-500 font-medium">
                              {shop.region} {shop.district} · {shop.desc}
                            </p>
                            <p className="text-xs font-bold text-orange-600">
                              {shop.price || '50,000원~'} · 체급별 요금 차등
                            </p>
                          </div>
                          <div className="flex flex-col space-y-1.5 shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openShopBookingModal(shop);
                              }}
                              className="bg-orange-500 hover:bg-orange-600 text-white text-xs px-3.5 py-2.5 rounded-xl font-bold shadow-sm transition active:scale-95"
                            >
                              예약하기
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewReviewsShopId(shop.id);
                              }}
                              className="bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] px-2.5 py-1.5 rounded-xl font-bold border border-amber-200 transition"
                            >
                              💬 후기 ({shop.totalReviews})
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {userTab === 'bookings' && (
            <div className="space-y-3">
              <h3 className="font-extrabold text-gray-800 text-sm">📋 내 예약 & 미용 후기 작성</h3>
              {myBookings.length === 0 ? (
                <div className="bg-white p-8 rounded-3xl text-center shadow-sm border border-gray-100">
                  <p className="text-2xl mb-2">🗓️</p>
                  <p className="text-xs text-gray-400 font-medium">
                    아직 신청한 미용 예약이 없습니다.
                  </p>
                </div>
              ) : (
                myBookings.map((b) => {
                  const linkedReview = reviews.find((r) => r.bookingId === b.id);
                  const isHidden = Boolean(linkedReview?.hidden);
                  return (
                    <div
                      key={b.id}
                      className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-3"
                    >
                      <div className="flex justify-between items-center">
                        <h4 className="font-extrabold text-gray-900 text-sm">{b.shop}</h4>
                        <span
                          className={`text-xs font-bold px-3 py-1 rounded-full ${
                            b.status === '미용 완료'
                              ? 'bg-blue-100 text-blue-700'
                              : b.status === '승인됨'
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
                        <p>
                          🐾 대상: <span className="font-bold text-gray-800">{b.pet}</span>
                        </p>
                        <p>
                          🗓️ 예약 일시 (1시간30분 코스):{' '}
                          <span className="font-bold text-gray-800">{b.time}</span>
                        </p>
                        <p>
                          ✂️ 선택 메뉴/비용:{' '}
                          <span className="font-bold text-gray-800">{b.service || '기본 미용'}</span>
                        </p>
                        {b.styleDetail && (
                          <p>
                            ✨ 미용 방식:{' '}
                            <span className="font-bold text-orange-600">{b.styleDetail}</span>
                          </p>
                        )}
                      </div>

                      {b.careReport && (
                        <div className="bg-blue-50/80 border border-blue-200 p-3.5 rounded-2xl space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-[11px] font-black text-blue-800">
                              ✂️ 사장님 미용 케어 일지
                            </span>
                            <span className="text-[10px] text-blue-500 font-bold">
                              {b.careReport.completedAt}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-blue-900">
                            컨디션: {b.careReport.condition}
                          </p>
                          <p className="text-xs text-blue-800 leading-relaxed">{b.careReport.note}</p>
                        </div>
                      )}

                      {b.status !== '거절됨' && (
                        <div className="pt-1">
                          {b.reviewed ? (
                            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl text-xs space-y-2">
                              <div className="flex justify-between items-center">
                                <p className="font-extrabold text-amber-800">
                                  내가 남긴 후기: {'⭐'.repeat(b.reviewRating || 5)} ({b.reviewRating}점)
                                </p>
                                {linkedReview && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteReview(linkedReview)}
                                    className="text-[11px] text-rose-600 font-bold hover:underline"
                                  >
                                    리뷰 삭제
                                  </button>
                                )}
                              </div>
                              {isHidden ? (
                                <p className="text-gray-500 italic bg-gray-100 p-2.5 rounded-xl">
                                  {BLIND_REVIEW_MESSAGE}
                                </p>
                              ) : (
                                <>
                                  <p className="text-gray-700 leading-relaxed">{b.reviewComment}</p>
                                  {(b.reviewPhotoUrl || linkedReview?.photoUrl) && (
                                    <img
                                      src={b.reviewPhotoUrl || linkedReview?.photoUrl}
                                      alt="후기 첨부 사진"
                                      className="w-full max-h-48 object-cover rounded-xl border border-amber-200"
                                    />
                                  )}
                                </>
                              )}
                              {linkedReview?.ownerReply && (
                                <div className="bg-white border border-amber-200/80 p-2.5 rounded-xl space-y-0.5">
                                  <p className="text-[11px] font-black text-orange-600">
                                    ✂️ 사장님 답글
                                  </p>
                                  <p className="text-xs text-gray-700">{linkedReview.ownerReply}</p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setReviewModalBooking(b);
                                setReviewRating(5);
                                setReviewText('');
                                setReviewPhotoData('');
                              }}
                              className="w-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold py-2.5 rounded-xl shadow-sm transition"
                            >
                              ⭐ 별점 & 사진 후기 작성하기
                            </button>
                          )}
                        </div>
                      )}

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
                  );
                })
              )}
            </div>
          )}

          {/* 보호자 탭 3: 다둥이 반려동물 추가/수정/삭제 관리 */}
          {userTab === 'pet' && (
            <div className="space-y-4">
              <div className="bg-white p-3.5 rounded-2xl border border-orange-100 text-[11px] text-gray-600 leading-relaxed">
                <p className="font-extrabold text-orange-700 mb-0.5">
                  📏 소·중·대형 체급 요금 기준 안내
                </p>
                <p>• 소형 (7kg 미만): 기본가 · 중형 (7~15kg 미만): +15,000원 · 대형 (15kg 이상): +30,000원</p>
              </div>

              <div className="space-y-2.5">
                <div className="flex justify-between items-center px-1">
                  <h3 className="font-black text-gray-900 text-sm">
                    🐾 우리 집 등록된 아이들 ({petsList.length}마리)
                  </h3>
                  {editingPetId && (
                    <button
                      type="button"
                      onClick={resetPetForm}
                      className="text-xs text-orange-600 font-bold underline"
                    >
                      + 새 아이 등록 모드로
                    </button>
                  )}
                </div>

                {petsList.length === 0 ? (
                  <div className="bg-white p-6 rounded-3xl text-center shadow-sm border border-gray-100">
                    <p className="text-2xl mb-1.5">🐶🐱</p>
                    <p className="text-xs text-gray-500 font-medium">
                      아직 등록된 반려동물이 없습니다. 아래에서 첫 번째 아이를 등록해 주세요!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {petsList.map((p) => {
                      const isCat = p.petSpecies === 'cat';
                      const tier = SIZE_TIERS[getSizeTierByWeight(p.petWeight)];
                      return (
                        <div
                          key={p.id}
                          className={`bg-white p-4 rounded-2xl shadow-sm border transition flex justify-between items-start ${
                            editingPetId === p.id
                              ? 'border-orange-500 ring-2 ring-orange-100'
                              : 'border-gray-100'
                          }`}
                        >
                          <div className="space-y-1 pr-2">
                            <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                                  isCat
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'bg-orange-100 text-orange-700'
                                }`}
                              >
                                {isCat ? '🐱 고양이' : '🐶 강아지'}
                              </span>
                              <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                                {tier.shortLabel}
                                {tier.extraFee > 0 ? ` (+${tier.extraFee.toLocaleString()}원)` : ' (기본)'}
                              </span>
                              <h4 className="font-black text-gray-900 text-sm">{p.petName}</h4>
                              {p.petWeight && (
                                <span className="text-[11px] text-gray-400 font-bold">
                                  · {p.petWeight}kg
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-600 font-medium">
                              {p.petBreed ? p.petBreed : isCat ? '묘종 미입력' : '견종 미입력'}
                            </p>
                            {p.petNote && (
                              <p className="text-[11px] text-rose-500 font-medium bg-rose-50 px-2.5 py-1 rounded-lg inline-block">
                                ⚠️ {p.petNote}
                              </p>
                            )}
                          </div>

                          <div className="flex space-x-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleEditPetClick(p)}
                              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1.5 rounded-xl font-bold"
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePet(p.id)}
                              className="text-xs bg-rose-50 hover:bg-rose-100 text-rose-600 px-2.5 py-1.5 rounded-xl font-bold"
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <form
                onSubmit={handleSavePetItem}
                className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4"
              >
                <div>
                  <h3 className="font-black text-gray-900 text-base">
                    {editingPetId ? '✏️ 반려동물 정보 수정' : '➕ 새 반려동물 추가 등록'}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    몸무게를 입력하면 소형(7kg 미만)·중형(7~15kg 미만)·대형(15kg 이상) 요금이 자동 반영됩니다.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    반려동물 구분
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPetSpecies('dog')}
                      className={`py-2.5 rounded-2xl text-xs font-extrabold border transition ${
                        petSpecies === 'dog'
                          ? 'bg-orange-500 text-white border-orange-500'
                          : 'bg-gray-50 text-gray-600 border-gray-200'
                      }`}
                    >
                      🐶 강아지
                    </button>
                    <button
                      type="button"
                      onClick={() => setPetSpecies('cat')}
                      className={`py-2.5 rounded-2xl text-xs font-extrabold border transition ${
                        petSpecies === 'cat'
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-gray-50 text-gray-600 border-gray-200'
                      }`}
                    >
                      🐱 고양이
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    {petSpecies === 'cat' ? '반려묘 이름' : '반려견 이름'}
                  </label>
                  <input
                    type="text"
                    placeholder={petSpecies === 'cat' ? '예: 치즈, 나비' : '예: 보리, 초코'}
                    value={petName}
                    onChange={(e) => setPetName(e.target.value)}
                    required
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:bg-white focus:border-orange-500 focus:outline-none transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      {petSpecies === 'cat' ? '묘종' : '견종'}
                    </label>
                    <input
                      type="text"
                      placeholder={petSpecies === 'cat' ? '예: 코리안숏헤어' : '예: 말티푸'}
                      value={petBreed}
                      onChange={(e) => setPetBreed(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:bg-white focus:border-orange-500 focus:outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">몸무게 (kg)</label>
                    <input
                      type="text"
                      placeholder="예: 4.5 / 9 / 18"
                      value={petWeight}
                      onChange={(e) => setPetWeight(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:bg-white focus:border-orange-500 focus:outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    {petSpecies === 'cat'
                      ? '특이사항 (예민함, 하악질, 무마취 경험 등)'
                      : '특이사항 (입질, 겁 많음, 피부질환 등)'}
                  </label>
                  <textarea
                    rows="2"
                    placeholder="미용사님이 미리 참고해야 할 사항을 적어주세요."
                    value={petNote}
                    onChange={(e) => setPetNote(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-3.5 text-sm focus:bg-white focus:border-orange-500 focus:outline-none transition resize-none"
                  />
                </div>

                <div className="flex space-x-2">
                  {editingPetId && (
                    <button
                      type="button"
                      onClick={resetPetForm}
                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3.5 rounded-2xl text-sm transition"
                    >
                      수정 취소
                    </button>
                  )}
                  <button
                    type="submit"
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 rounded-2xl shadow-md shadow-orange-500/20 text-sm transition"
                  >
                    {editingPetId ? '수정 내용 저장' : '+ 반려동물 추가하기'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>

        {/* [모달 1] 제휴 업체별 예약 모달 (소·중·대형 체급 요금 계산 포함) */}
        {bookingModalShop && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-[9999]">
            <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl border border-gray-100">
              <div className="flex justify-between items-start border-b border-gray-100 pb-3">
                <div>
                  <div className="flex items-center space-x-1.5">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        getPetTypeBadge(bookingModalShop.petType).bg
                      }`}
                    >
                      {getPetTypeBadge(bookingModalShop.petType).label}
                    </span>
                    <button
                      type="button"
                      onClick={() => setViewReviewsShopId(bookingModalShop.id)}
                      className="text-[10px] bg-amber-100 hover:bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-extrabold underline"
                    >
                      ⭐ {bookingModalShop.avgRating} · 후기 {bookingModalShop.totalReviews}건 전체보기
                    </button>
                  </div>
                  <h3 className="font-black text-gray-900 text-base mt-1">{bookingModalShop.name}</h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    ⏱️ 1시간 30분 단위 · 소(&lt;7kg) 기본 / 중(7~15kg) +1.5만 / 대(15kg+) +3만
                  </p>
                </div>
                <button
                  onClick={() => setBookingModalShop(null)}
                  className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 font-bold hover:bg-gray-200 transition shrink-0"
                >
                  ✕
                </button>
              </div>

              {bookingModalShop.shopReviews && bookingModalShop.shopReviews.length > 0 && (
                <div
                  onClick={() => setViewReviewsShopId(bookingModalShop.id)}
                  className="bg-amber-50/80 hover:bg-amber-100/70 border border-amber-200 p-3 rounded-2xl space-y-1 cursor-pointer transition"
                >
                  <div className="flex justify-between items-center">
                    <p className="text-[11px] font-extrabold text-amber-800">
                      💬 최근 방문 후기 ({'⭐'.repeat(bookingModalShop.shopReviews[0].rating || 5)})
                    </p>
                    <span className="text-[10px] font-extrabold text-amber-700 underline">
                      전체 후기 ({bookingModalShop.totalReviews}건) &gt;
                    </span>
                  </div>
                  <p className="text-xs text-gray-700 line-clamp-2">
                    {bookingModalShop.shopReviews[0].hidden
                      ? BLIND_REVIEW_MESSAGE
                      : `"${bookingModalShop.shopReviews[0].comment}" — ${maskCustomerName(
                          bookingModalShop.shopReviews[0].customerName
                        )}님`}
                  </p>
                </div>
              )}

              <form onSubmit={handleConfirmBooking} className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-extrabold text-gray-700">
                      🐾 이번에 미용할 아이 선택
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setBookingModalShop(null);
                        setUserTab('pet');
                      }}
                      className="text-[11px] text-orange-600 font-bold underline"
                    >
                      + 아이 추가/관리
                    </button>
                  </div>

                  {petsList.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {petsList.map((pet) => {
                        const isIncompatible =
                          (bookingModalShop.petType === 'cat' && pet.petSpecies !== 'cat') ||
                          (bookingModalShop.petType === 'dog' && pet.petSpecies !== 'dog');
                        const isChosen = selectedBookingPetId === pet.id;
                        const petTier = SIZE_TIERS[getSizeTierByWeight(pet.petWeight)];
                        return (
                          <button
                            key={pet.id}
                            type="button"
                            disabled={isIncompatible}
                            onClick={() => handleSelectPetForBooking(pet)}
                            className={`p-2.5 rounded-2xl border-2 text-left transition ${
                              isIncompatible
                                ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                                : isChosen
                                ? pet.petSpecies === 'cat'
                                  ? 'bg-purple-50 border-purple-600 text-purple-900'
                                  : 'bg-orange-50 border-orange-500 text-orange-900'
                                : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                            }`}
                          >
                            <p className="text-xs font-black">
                              {pet.petSpecies === 'cat' ? '🐱' : '🐶'} {pet.petName}
                            </p>
                            <p className="text-[10px] opacity-75 truncate mt-0.5">
                              {isIncompatible
                                ? '이 매장 미취급 축종'
                                : `${petTier.shortLabel}${pet.petWeight ? ` (${pet.petWeight}kg)` : ''}`}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={bookingModalShop.petType === 'cat'}
                        onClick={() => {
                          setBookingPetSpecies('dog');
                          setCustomStyleDetail('얼굴 동그랗게 (곰돌이컷)');
                        }}
                        className={`py-2.5 rounded-xl text-xs font-extrabold border transition ${
                          bookingModalShop.petType === 'cat'
                            ? 'bg-gray-100 text-gray-300 border-gray-100 cursor-not-allowed'
                            : bookingPetSpecies === 'dog'
                            ? 'bg-orange-500 text-white border-orange-500'
                            : 'bg-white text-gray-600 border-gray-200'
                        }`}
                      >
                        🐶 강아지 미용
                      </button>
                      <button
                        type="button"
                        disabled={bookingModalShop.petType === 'dog'}
                        onClick={() => {
                          setBookingPetSpecies('cat');
                          setCustomStyleDetail('무마취 전체 클리핑 (사자컷/올빡)');
                        }}
                        className={`py-2.5 rounded-xl text-xs font-extrabold border transition ${
                          bookingModalShop.petType === 'dog'
                            ? 'bg-gray-100 text-gray-300 border-gray-100 cursor-not-allowed'
                            : bookingPetSpecies === 'cat'
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'bg-white text-gray-600 border-gray-200'
                        }`}
                      >
                        🐱 고양이 미용
                      </button>
                    </div>
                  )}
                </div>

                {/* 체급(소·중·대형) 요금 구분 선택 */}
                <div>
                  <label className="block text-xs font-extrabold text-gray-700 mb-1.5">
                    ⚖️ 체급(몸무게) 기준 요금 구분
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {Object.values(SIZE_TIERS).map((tier) => {
                      const isSelected = bookingSizeTier === tier.id;
                      return (
                        <button
                          key={tier.id}
                          type="button"
                          onClick={() => setBookingSizeTier(tier.id)}
                          className={`py-2 px-2 rounded-xl text-[11px] font-extrabold border transition text-center ${
                            isSelected
                              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <div>{tier.label}</div>
                          <div className="text-[10px] opacity-80 mt-0.5">
                            {tier.extraFee === 0
                              ? '기본가'
                              : `+${tier.extraFee.toLocaleString('ko-KR')}원`}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

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

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-extrabold text-gray-700">
                      2️⃣ 1시간 30분 단위 시간 선택
                    </label>
                    <span className="text-[10px] text-gray-400 font-semibold">
                      회색은 마감/휴무 시간
                    </span>
                  </div>

                  {isFullDayBlocked ? (
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold p-3.5 rounded-2xl text-center">
                      ⛔ 선택하신 날짜({bookingDate})는 매장 휴무 및 일정 차단으로 예약이 불가합니다.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {modalTimeSlots.map((slot) => {
                        const isBooked = bookedTimesForShopAndDate.includes(slot);
                        const isBlocked = blockedTimeList.includes(slot);
                        const unavailable = isBooked || isBlocked;
                        const isSelected = bookingTime === slot;
                        return (
                          <button
                            key={slot}
                            type="button"
                            disabled={unavailable}
                            onClick={() => setBookingTime(slot)}
                            className={`py-2.5 rounded-xl text-xs font-extrabold border transition ${
                              unavailable
                                ? 'bg-gray-100 text-gray-300 border-gray-100 cursor-not-allowed line-through'
                                : isSelected
                                ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                                : 'bg-white text-gray-700 border-gray-200 hover:border-orange-300'
                            }`}
                          >
                            {slot} {isBlocked ? '(휴게)' : isBooked ? '(마감)' : ''}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-gray-700 mb-1.5">
                    3️⃣ 미용 메뉴 선택 (1시간 30분 코스)
                  </label>
                  <div className="space-y-2">
                    {modalServices.map((svc, idx) => {
                      const active = selectedServiceIdx === idx;
                      const svcBase = parsePriceNumber(svc.price, 50000);
                      const svcWithTier = svcBase + activeTierObj.extraFee;
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
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              기본 {formatKrw(svcBase)} · {activeTierObj.shortLabel} 적용
                            </p>
                          </div>
                          <span className="text-xs font-black text-orange-600">
                            {formatKrw(svcWithTier)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 flex justify-between items-center">
                  <span className="text-xs font-extrabold text-gray-700">
                    예상 미용 비용 ({activeTierObj.shortLabel})
                  </span>
                  <span className="text-sm font-black text-orange-600">
                    {formatKrw(estimatedTotalPrice)}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-gray-700 mb-1.5">
                    4️⃣{' '}
                    {bookingPetSpecies === 'cat'
                      ? '고양이 미용 방식 선택'
                      : '강아지 미용 방식 / 컷 스타일'}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {styleOptionsBySpecies.map((styleOption) => (
                      <button
                        key={styleOption}
                        type="button"
                        onClick={() => setCustomStyleDetail(styleOption)}
                        className={`py-2 px-2.5 rounded-xl text-[11px] font-bold border text-left transition ${
                          customStyleDetail === styleOption
                            ? bookingPetSpecies === 'cat'
                              ? 'bg-purple-700 text-white border-purple-700'
                              : 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {styleOption}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-gray-700 mb-1">
                    5️⃣ 사장님께 전달할 요청사항
                  </label>
                  <input
                    type="text"
                    placeholder="예: 1시간 30분 내에 안전하게 마무리 부탁드려요"
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
                    disabled={isFullDayBlocked}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white py-3 rounded-2xl text-xs font-bold shadow-md shadow-orange-500/20 transition"
                  >
                    예약 신청 확정
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* [모달 2] 매장 보호자 후기 전체 보기 모달 (이름 마스킹 · 가리기 안내 · 사진 · 사장님 답글 · 본인 리뷰 삭제 포함) */}
        {activeReviewsShop && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-[10000]">
            <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[85vh] overflow-y-auto p-6 space-y-4 shadow-2xl border border-gray-100">
              <div className="flex justify-between items-start border-b border-gray-100 pb-3">
                <div>
                  <span className="text-xs font-extrabold text-amber-600">
                    ⭐ 평균 {activeReviewsShop.avgRating}점 · 총 {activeReviewsShop.totalReviews}개 후기
                  </span>
                  <h3 className="font-black text-gray-900 text-base mt-0.5">
                    {activeReviewsShop.name} 후기
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setViewReviewsShopId(null)}
                  className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 font-bold hover:bg-gray-200 transition"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                {activeReviewsShop.shopReviews && activeReviewsShop.shopReviews.length > 0 ? (
                  activeReviewsShop.shopReviews.map((rev, idx) => {
                    const isMine = rev.customerId && rev.customerId === user.uid;
                    const isHidden = Boolean(rev.hidden);
                    const maskedName = maskCustomerName(rev.customerName);
                    return (
                      <div
                        key={rev.id || idx}
                        className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-2"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-black text-amber-500">
                            {'⭐'.repeat(Number(rev.rating) || 5)} ({rev.rating || 5}점)
                          </span>
                          <div className="flex items-center space-x-2">
                            <span className="text-[11px] text-gray-400 font-semibold">
                              {rev.date || '최근 방문'}
                            </span>
                            {isMine && (
                              <button
                                type="button"
                                onClick={() => handleDeleteReview(rev)}
                                className="text-[11px] text-rose-600 font-bold hover:underline"
                              >
                                삭제
                              </button>
                            )}
                          </div>
                        </div>

                        {isHidden ? (
                          <div className="bg-gray-100 border border-gray-200 text-gray-500 text-xs font-semibold p-3 rounded-xl">
                            🙈 {BLIND_REVIEW_MESSAGE}
                          </div>
                        ) : (
                          <>
                            <p className="text-xs text-gray-800 leading-relaxed font-medium">
                              {rev.comment}
                            </p>

                            {rev.photoUrl && (
                              <img
                                src={rev.photoUrl}
                                alt="보호자 첨부 후기 사진"
                                className="w-full max-h-52 object-cover rounded-xl border border-gray-200"
                              />
                            )}
                          </>
                        )}

                        <p className="text-[11px] text-gray-500 font-bold">
                          👤 {maskedName} 보호자님 {rev.pet ? `· ${rev.pet}` : ''}
                        </p>

                        {rev.ownerReply && (
                          <div className="bg-orange-50/90 border border-orange-200 p-3 rounded-xl space-y-0.5 mt-1">
                            <p className="text-[11px] font-black text-orange-700">✂️ 사장님 답글</p>
                            <p className="text-xs text-gray-800 leading-relaxed">{rev.ownerReply}</p>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-xs text-gray-400">
                    아직 등록된 상세 후기가 없습니다. 첫 후기를 남겨보세요!
                  </div>
                )}
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setViewReviewsShopId(null)}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-2xl text-xs font-bold"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = activeReviewsShop;
                    setViewReviewsShopId(null);
                    openShopBookingModal(target);
                  }}
                  className="flex-1 bg-orange-500 text-white py-3 rounded-2xl text-xs font-bold shadow-sm"
                >
                  이 매장 예약하기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* [모달 3] 보호자 별점 & 사진 후기 작성 모달 */}
        {reviewModalBooking && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-[10000]">
            <form
              onSubmit={handleSubmitReview}
              className="bg-white rounded-3xl max-w-sm w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl"
            >
              <div>
                <h3 className="font-black text-gray-900 text-base">⭐ 미용 후기 남기기</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {reviewModalBooking.shop} · {reviewModalBooking.pet}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  후기 작성 시 보호자 이름은{' '}
                  <span className="font-bold text-gray-600">
                    {maskCustomerName(userProfile?.name || '보호자')}
                  </span>
                  님으로 표시됩니다.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">별점 선택</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setReviewRating(num)}
                      className={`py-2.5 rounded-xl text-xs font-black border transition ${
                        reviewRating === num
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-gray-50 text-gray-600 border-gray-200'
                      }`}
                    >
                      ⭐ {num}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">후기 내용</label>
                <textarea
                  rows="3"
                  placeholder="아이 케어 만족도, 스타일링 후기를 남겨주세요."
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-3.5 text-xs focus:bg-white focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  📷 미용 사진 첨부 (선택)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleReviewPhotoChange}
                  className="block w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-orange-50 file:text-orange-600 hover:file:bg-orange-100"
                />
                {uploadingPhoto && (
                  <p className="text-[11px] text-orange-600 font-bold mt-1">사진 처리 중...</p>
                )}
                {reviewPhotoData && (
                  <div className="mt-2 relative">
                    <img
                      src={reviewPhotoData}
                      alt="첨부 미리보기"
                      className="w-full max-h-40 object-cover rounded-2xl border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => setReviewPhotoData('')}
                      className="mt-1.5 text-[11px] text-rose-600 font-bold underline"
                    >
                      첨부 사진 지우기
                    </button>
                  </div>
                )}
              </div>

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setReviewModalBooking(null);
                    setReviewPhotoData('');
                  }}
                  className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl text-xs font-bold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={uploadingPhoto}
                  className="flex-1 bg-amber-500 disabled:bg-amber-300 text-white py-3 rounded-xl text-xs font-bold shadow-sm"
                >
                  후기 등록
                </button>
              </div>
            </form>
          </div>
        )}

        {renderNotiModal()}
        {renderLiveToast()}
      </div>
    );
  }

  // [화면 C] 사장님(그로머) 대시보드 화면
  const displayedBookings = onlyMyShopBookings
    ? bookings.filter((b) => b.shopId === user.uid || b.shop === userProfile.extraInfo)
    : bookings;

  const myBlockedList = blockedSlots.filter((blk) => blk.shopId === user.uid);
  const myShopReviews = reviews.filter(
    (r) => r.shopId === user.uid || r.shopName === userProfile.extraInfo
  );

  const parsedOwnerSlots = shopTimeSlotsInput
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return (
    <div className="min-h-screen bg-slate-900 pb-20 text-slate-100">
      <header className="bg-slate-950 px-4 py-3.5 flex justify-between items-center sticky top-0 z-20 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <div className="bg-slate-800 text-slate-200 p-1.5 rounded-xl text-base shadow-sm">✂️</div>
          <div>
            <p className="text-[11px] text-slate-400 font-bold leading-none">
              {userProfile.name} 사장님
            </p>
            <h2 className="font-extrabold text-white text-sm mt-0.5">{userProfile.extraInfo}</h2>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowNotiModal(true)}
            className="relative text-xs bg-slate-800 hover:bg-slate-700 text-orange-300 px-3 py-1.5 rounded-xl font-extrabold border border-slate-700 transition"
          >
            🔔 알림
            {unreadNotiCount > 0 && (
              <span className="ml-1 bg-rose-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                {unreadNotiCount}
              </span>
            )}
          </button>
          <button
            onClick={handleLogout}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-xl font-bold transition"
          >
            로그아웃
          </button>
        </div>
      </header>

      <div className="bg-slate-950 border-b border-slate-800 sticky top-[57px] z-10 shadow-sm">
        <div className="max-w-md mx-auto grid grid-cols-3 text-center text-xs font-bold">
          <button
            onClick={() => setOwnerTab('bookings')}
            className={`py-3.5 border-b-2 transition ${
              ownerTab === 'bookings'
                ? 'border-orange-500 text-orange-400 bg-slate-900/50'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            📅 예약·케어일지
          </button>
          <button
            onClick={() => setOwnerTab('schedule')}
            className={`py-3.5 border-b-2 transition ${
              ownerTab === 'schedule'
                ? 'border-orange-500 text-orange-400 bg-slate-900/50'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            ⛔ 일정 차단 ({myBlockedList.length})
          </button>
          <button
            onClick={() => setOwnerTab('shop')}
            className={`py-3.5 border-b-2 transition ${
              ownerTab === 'shop'
                ? 'border-orange-500 text-orange-400 bg-slate-900/50'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            🏪 매장·후기 ({myShopReviews.length})
          </button>
        </div>
      </div>

      <main className="max-w-md mx-auto p-4 space-y-5">
        {ownerTab === 'bookings' && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-800 p-3.5 rounded-2xl border border-slate-700/60">
                <p className="text-[11px] text-slate-400 font-medium">전체 예약</p>
                <p className="text-xl font-black text-white mt-0.5">{displayedBookings.length}건</p>
              </div>
              <div className="bg-slate-800 p-3.5 rounded-2xl border border-slate-700/60">
                <p className="text-[11px] text-slate-400 font-medium">승인 진행중</p>
                <p className="text-xl font-black text-emerald-400 mt-0.5">
                  {displayedBookings.filter((b) => b.status === '승인됨').length}건
                </p>
              </div>
              <div className="bg-slate-800 p-3.5 rounded-2xl border border-slate-700/60">
                <p className="text-[11px] text-slate-400 font-medium">미용 완료</p>
                <p className="text-xl font-black text-blue-400 mt-0.5">
                  {displayedBookings.filter((b) => b.status === '미용 완료').length}건
                </p>
              </div>
            </div>

            <div className="flex justify-between items-center px-1">
              <h3 className="font-extrabold text-slate-200 text-xs tracking-wider uppercase">
                실시간 예약 리스트
              </h3>
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
                          item.status === '미용 완료'
                            ? 'bg-blue-900/60 text-blue-300 border border-blue-700/50'
                            : item.status === '승인됨'
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
                      <p className="font-bold text-white text-sm">
                        👤 {item.customer} 보호자님
                      </p>
                      <p className="text-slate-300">
                        🐾 대상 아이: <span className="font-bold text-white">{item.pet}</span>
                      </p>
                      <p className="text-orange-400 font-semibold">
                        ✂️ 선택 메뉴/비용: {item.service || '기본 미용'}
                      </p>
                      {item.styleDetail && (
                        <p className="text-amber-300 font-medium">
                          ✨ 미용 방식: {item.styleDetail}
                        </p>
                      )}
                      {item.petNote && item.petNote !== '특이사항 없음' && (
                        <p className="text-rose-400 font-medium">
                          ⚠️ 아이 특이사항: {item.petNote}
                        </p>
                      )}
                      {item.requestNote && item.requestNote !== '없음' && (
                        <p className="text-slate-400">💬 보호자 요청: {item.requestNote}</p>
                      )}
                    </div>

                    {item.status === '대기 중' && (
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
                    )}

                    {item.status === '승인됨' && (
                      <button
                        onClick={() => {
                          setCareModalBooking(item);
                          setCareCondition('컨디션 좋음 · 협조적');
                          setCareNoteInput('');
                        }}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs py-2.5 rounded-xl font-extrabold transition shadow-sm"
                      >
                        ✨ 미용 완료 처리 & 보호자 케어 일지 작성
                      </button>
                    )}

                    {item.careReport && (
                      <div className="bg-slate-900 border border-blue-800/60 p-3 rounded-xl text-xs space-y-1">
                        <p className="text-blue-400 font-bold">
                          📝 발송된 케어 일지 ({item.careReport.condition})
                        </p>
                        <p className="text-slate-300">{item.careReport.note}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {ownerTab === 'schedule' && (
          <div className="space-y-4">
            <form
              onSubmit={handleAddBlockedSlot}
              className="bg-slate-800 p-6 rounded-3xl border border-slate-700/60 space-y-4"
            >
              <div>
                <h3 className="font-black text-white text-base">⛔ 휴무일 & 특정 시간 차단</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  점심시간, 개인 일정, 정기 휴무일을 차단하면 보호자 앱에서 해당 시간이 즉시 마감 처리됩니다.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  차단할 날짜 선택
                </label>
                <input
                  type="date"
                  value={blockDate}
                  onChange={(e) => setBlockDate(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  차단 범위 선택
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBlockType('slot')}
                    className={`py-2.5 rounded-xl text-xs font-extrabold border transition ${
                      blockType === 'slot'
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-slate-900 text-slate-400 border-slate-700'
                    }`}
                  >
                    ⏰ 특정 1시간30분 타임만
                  </button>
                  <button
                    type="button"
                    onClick={() => setBlockType('full')}
                    className={`py-2.5 rounded-xl text-xs font-extrabold border transition ${
                      blockType === 'full'
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-slate-900 text-slate-400 border-slate-700'
                    }`}
                  >
                    🗓️ 하루 전체 (휴무일)
                  </button>
                </div>
              </div>

              {blockType === 'slot' && (
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    차단할 타임슬롯 선택
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {parsedOwnerSlots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setBlockTimeSlot(slot)}
                        className={`py-2 rounded-xl text-xs font-bold border transition ${
                          blockTimeSlot === slot
                            ? 'bg-orange-500 text-white border-orange-500'
                            : 'bg-slate-900 text-slate-300 border-slate-700'
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  사유 메모 (관리용)
                </label>
                <input
                  type="text"
                  placeholder="예: 점심시간 브레이크타임 / 세미나 참석"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-3.5 rounded-2xl text-sm transition shadow-md"
              >
                일정 차단 등록하기
              </button>
            </form>

            <div className="space-y-2.5">
              <h4 className="text-xs font-extrabold text-slate-400 uppercase px-1">
                현재 적용 중인 차단 일정 ({myBlockedList.length}건)
              </h4>
              {myBlockedList.length === 0 ? (
                <div className="bg-slate-800 p-6 rounded-2xl text-center text-xs text-slate-400 border border-slate-700/60">
                  등록된 휴무나 차단된 시간대가 없습니다.
                </div>
              ) : (
                myBlockedList.map((blk) => (
                  <div
                    key={blk.id}
                    className="bg-slate-800 p-4 rounded-2xl border border-slate-700/60 flex justify-between items-center"
                  >
                    <div>
                      <span className="text-xs font-black text-rose-400">
                        {blk.date} ·{' '}
                        {blk.type === 'full' ? '하루 전체 휴무' : `${blk.timeSlot} 타임 마감`}
                      </span>
                      <p className="text-xs text-slate-300 mt-0.5">{blk.reason}</p>
                    </div>
                    <button
                      onClick={() => handleRemoveBlockedSlot(blk.id)}
                      className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-xl font-bold"
                    >
                      해제
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {ownerTab === 'shop' && (
          <div className="space-y-5">
            <form
              onSubmit={handleRegisterShop}
              className="bg-slate-800 p-6 rounded-3xl border border-slate-700/60 space-y-4 shadow-sm"
            >
              <div>
                <h3 className="font-black text-white text-base">🏪 매장명 & 사장님 정보 수정</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  1시간 30분 단위 타임슬롯 및 대표 미용 메뉴 설정을 관리하세요. (소형 기본 / 중형 +15,000원 / 대형 +30,000원 자동 적용)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-orange-400 mb-1">매장명</label>
                  <input
                    type="text"
                    value={shopNameInput}
                    onChange={(e) => setShopNameInput(e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-orange-500/50 rounded-2xl px-3.5 py-3 text-sm text-white font-bold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    사장님 성함
                  </label>
                  <input
                    type="text"
                    value={ownerNameInput}
                    onChange={(e) => setOwnerNameInput(e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-3.5 py-3 text-sm text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  취급 미용 대상 선택
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'dog', label: '🐶 강아지 전용' },
                    { id: 'cat', label: '🐱 고양이 전용' },
                    { id: 'both', label: '🐶🐱 멍냥 모두' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setShopPetType(opt.id)}
                      className={`py-2.5 rounded-xl text-xs font-extrabold border transition ${
                        shopPetType === opt.id
                          ? 'bg-orange-500 text-white border-orange-500'
                          : 'bg-slate-900 text-slate-400 border-slate-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
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
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  매장 한 줄 소개
                </label>
                <input
                  type="text"
                  placeholder="예: 1시간30분 타임 집중 프리미엄 케어"
                  value={shopDesc}
                  onChange={(e) => setShopDesc(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  1시간30분 단위 타임슬롯 (쉼표로 구분)
                </label>
                <input
                  type="text"
                  value={shopTimeSlotsInput}
                  onChange={(e) => setShopTimeSlotsInput(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none"
                />
              </div>

              <div className="space-y-2 pt-1">
                <label className="block text-xs font-bold text-orange-400">
                  ✂️ 1시간 30분 대표 코스 3종 (소형 기준 기본가)
                </label>
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
                타임슬롯 및 정보 저장하기
              </button>
            </form>

            {/* 우리 매장 보호자 후기 관리 (가리기 · 답글 · 삭제) */}
            <div className="bg-slate-800 p-5 rounded-3xl border border-slate-700/60 space-y-3">
              <h4 className="font-black text-white text-sm">
                ⭐ 우리 매장 보호자 후기 ({myShopReviews.length}건)
              </h4>
              {myShopReviews.length === 0 ? (
                <p className="text-xs text-slate-400">아직 등록된 보호자 후기가 없습니다.</p>
              ) : (
                myShopReviews.map((rev) => {
                  const isHidden = Boolean(rev.hidden);
                  return (
                    <div
                      key={rev.id}
                      className={`p-4 rounded-2xl border text-xs space-y-2.5 ${
                        isHidden
                          ? 'bg-slate-950/80 border-amber-500/40'
                          : 'bg-slate-900 border-slate-800'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-amber-400">
                            {'⭐'.repeat(rev.rating)} ({rev.rating}점)
                          </span>
                          {isHidden && (
                            <span className="text-[10px] bg-amber-900/60 text-amber-300 px-2 py-0.5 rounded-full font-bold">
                              가리기 중
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-slate-400">
                            {maskCustomerName(rev.customerName)} 보호자님
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteReview(rev)}
                            className="text-[11px] text-rose-400 hover:underline font-bold"
                          >
                            삭제
                          </button>
                        </div>
                      </div>

                      <p className="text-slate-200 leading-relaxed">{rev.comment}</p>
                      {isHidden && (
                        <p className="text-[11px] text-amber-300/90 bg-amber-950/50 px-2.5 py-1.5 rounded-lg">
                          보호자 화면 노출 문구: "{BLIND_REVIEW_MESSAGE}"
                        </p>
                      )}

                      {rev.photoUrl && (
                        <img
                          src={rev.photoUrl}
                          alt="후기 사진"
                          className="w-full max-h-48 object-cover rounded-xl border border-slate-700"
                        />
                      )}

                      {rev.ownerReply && replyingReviewId !== rev.id && (
                        <div className="bg-slate-800/90 border border-orange-500/30 p-3 rounded-xl space-y-1">
                          <p className="text-[11px] font-black text-orange-400">✂️ 내 사장님 답글</p>
                          <p className="text-slate-200">{rev.ownerReply}</p>
                        </div>
                      )}

                      {replyingReviewId === rev.id ? (
                        <div className="space-y-2 pt-1">
                          <textarea
                            rows="2"
                            placeholder="보호자님께 감사 인사와 케어 코멘트를 남겨주세요."
                            value={replyDraftText}
                            onChange={(e) => setReplyDraftText(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none resize-none"
                          />
                          <div className="flex space-x-2">
                            <button
                              type="button"
                              onClick={() => {
                                setReplyingReviewId(null);
                                setReplyDraftText('');
                              }}
                              className="flex-1 bg-slate-700 text-slate-300 py-2 rounded-xl text-xs font-bold"
                            >
                              취소
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveOwnerReply(rev.id)}
                              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-xl text-xs font-bold"
                            >
                              답글 저장
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2 pt-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              setReplyingReviewId(rev.id);
                              setReplyDraftText(rev.ownerReply || '');
                            }}
                            className="bg-slate-800 hover:bg-slate-700 text-orange-300 border border-slate-700 px-3 py-1.5 rounded-xl text-[11px] font-bold transition"
                          >
                            {rev.ownerReply ? '✏️ 답글 수정하기' : '💬 사장님 답글 달기'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleHideReview(rev)}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition ${
                              isHidden
                                ? 'bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border-emerald-700/60'
                                : 'bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border-amber-700/60'
                            }`}
                          >
                            {isHidden ? '👁️ 가리기 해제' : '🙈 가리기 처리'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </main>

      {/* 사장님 미용 완료 케어 일지 작성 모달 */}
      {careModalBooking && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
          <form
            onSubmit={handleCompleteWithCareNote}
            className="bg-slate-800 border border-slate-700 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-white"
          >
            <div>
              <h3 className="font-black text-base">✨ 미용 완료 & 케어 일지 작성</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {careModalBooking.customer} 보호자님 ({careModalBooking.pet})
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                아이 미용 컨디션
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  '컨디션 좋음 · 협조적',
                  '약간 긴장했으나 무사 완료',
                  '털 엉킴 심함 · 보습 케어',
                  '예민함 · 다음엔 부분미용 추천',
                ].map((cond) => (
                  <button
                    key={cond}
                    type="button"
                    onClick={() => setCareCondition(cond)}
                    className={`py-2 px-2.5 rounded-xl text-[11px] font-bold border text-left transition ${
                      careCondition === cond
                        ? 'bg-blue-600 text-white border-blue-500'
                        : 'bg-slate-900 text-slate-400 border-slate-700'
                    }`}
                  >
                    {cond}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                보호자 전달 코멘트
              </label>
              <textarea
                rows="3"
                placeholder="예: 귀 세정과 발톱 정리도 깔끔하게 마쳤고, 드라이할 때도 아주 얌전했어요!"
                value={careNoteInput}
                onChange={(e) => setCareNoteInput(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-3.5 text-xs text-white focus:outline-none resize-none"
              />
            </div>

            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setCareModalBooking(null)}
                className="flex-1 bg-slate-700 text-slate-300 py-3 rounded-xl text-xs font-bold"
              >
                취소
              </button>
              <button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl text-xs font-bold shadow-sm"
              >
                완료 및 일지 발송
              </button>
            </div>
          </form>
        </div>
      )}

      {renderNotiModal()}
      {renderLiveToast()}
    </div>
  );
}
