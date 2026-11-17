import React, { useState, useMemo } from 'react';
import {
  Scissors,
  MapPin,
  Star,
  Calendar,
  Clock,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  X,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Lock,
  Unlock,
  Dog,
  Sparkles,
  FileText,
  Send,
  Search,
  Filter,
  User,
  Store,
  CreditCard,
  Info,
  RefreshCw,
  Ban,
  HeartHandshake
} from 'lucide-react';

// 초기 미용실 데이터
const SHOPS = [
  {
    id: 'shop-1',
    name: '포포 살롱 청담점',
    rating: 4.9,
    reviewCount: 342,
    distance: '450m',
    address: '서울 강남구 압구정로 79길 12',
    tags: ['가위컷 전문', '스파/케어', '스트레스 최소화'],
    category: 'scissor',
    basePrice: 55000,
    designer: '김하늘 원장 (경력 9년)',
    image: 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&w=800&q=80',
    portfolio: [
      { style: '테디베어 컷', breed: '푸들 (4.2kg)', img: 'https://images.unsplash.com/photo-1591769225440-811ad7d6eab3?auto=format&fit=crop&w=500&q=80' },
      { style: '하이바 컷', breed: '비숑 (5.8kg)', img: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=500&q=80' }
    ]
  },
  {
    id: 'shop-2',
    name: '멍냥 스튜디오 성수',
    rating: 4.8,
    reviewCount: 218,
    distance: '1.1km',
    address: '서울 성동구 연무장길 45',
    tags: ['대형견 가능', '통유리 오픈미용실', '탄산스파'],
    category: 'large',
    basePrice: 65000,
    designer: '박지훈 실장 (경력 7년)',
    image: 'https://images.unsplash.com/photo-1535930891776-0c2dfb7fda1a?auto=format&fit=crop&w=800&q=80',
    portfolio: [
      { style: '라이언 컷', breed: '포메라니안 (3.1kg)', img: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=500&q=80' },
      { style: '위생 + 전체가위컷', breed: '골든리트리버 (28kg)', img: 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=500&q=80' }
    ]
  },
  {
    id: 'shop-3',
    name: '코코 아뜰리에 한남',
    rating: 4.95,
    reviewCount: 189,
    distance: '1.8km',
    address: '서울 용산구 이태원로54길 31',
    tags: ['스파/케어', '고양이 무마취', '1:1 전담케어'],
    category: 'spa',
    basePrice: 60000,
    designer: '이서연 디자이너 (경력 6년)',
    image: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=800&q=80',
    portfolio: [
      { style: '머쉬룸 컷', breed: '말티푸 (3.8kg)', img: 'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?auto=format&fit=crop&w=500&q=80' },
      { style: '아로마 버블스파', breed: '시츄 (6.1kg)', img: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=500&q=80' }
    ]
  },
  {
    id: 'shop-4',
    name: '도그앤캣 케어하우스',
    rating: 4.7,
    reviewCount: 124,
    distance: '2.3km',
    address: '서울 마포구 독막로 88',
    tags: ['고양이 무마취', '노령견 케어', '픽업 가능'],
    category: 'cat',
    basePrice: 50000,
    designer: '최유진 원장 (경력 11년)',
    image: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=800&q=80',
    portfolio: [
      { style: '무마취 장화컷', breed: '페르시안 (4.5kg)', img: 'https://images.unsplash.com/photo-1573865526739-10659fec78a5?auto=format&fit=crop&w=500&q=80' }
    ]
  }
];

const CATEGORIES = [
  { id: 'all', label: '전체 보기' },
  { id: 'scissor', label: '가위컷 전문' },
  { id: 'large', label: '대형견 가능' },
  { id: 'spa', label: '스파/케어' },
  { id: 'cat', label: '고양이 무마취' }
];

const PET_SIZES = [
  { id: 'small', label: '소형견 (~5kg)', extra: 0 },
  { id: 'medium', label: '중형견 (5~12kg)', extra: 15000 },
  { id: 'large', label: '대형견 (12kg~)', extra: 35000 }
];

const GROOMING_STYLES = [
  { id: 'clip', label: '위생 + 목욕 + 클리핑', extra: 0 },
  { id: 'sport', label: '스포팅 (몸 클리핑 + 다리 가위컷)', extra: 20000 },
  { id: 'full_scissor', label: '전체 가위컷 (테디베어/하이바 등)', extra: 35000 },
  { id: 'spa_care', label: '탄산 아로마 스파 패키지', extra: 25000 }
];

const SPECIAL_NOTES = [
  { id: 'bite', label: '입질 주의', severe: true },
  { id: 'anxiety', label: '분리불안', severe: false },
  { id: 'skin', label: '피부 민감/습진', severe: false },
  { id: 'senior', label: '노령견 (관절 주의)', severe: true },
  { id: 'matting', label: '털 엉킴 있음', severe: false }
];

// 초기 예약 내역 (보호자 & 관리자 공통 데이터)
const INITIAL_BOOKINGS = [
  {
    id: 'BK-2026-8841',
    shopId: 'shop-1',
    shopName: '포포 살롱 청담점',
    petName: '두부',
    breed: '비숑 프리제',
    weight: '5.4kg',
    sizeLabel: '중형견 (5~12kg)',
    styleLabel: '전체 가위컷 (테디베어/하이바 등)',
    date: '2026-11-20',
    time: '14:00',
    freeCancelDeadline: '2026-11-19 14:00',
    totalPrice: 105000,
    depositAmount: 21000,
    balanceAmount: 84000,
    depositPaid: true,
    notes: ['분리불안', '털 엉킴 있음'],
    customMemo: '귀 주변 털은 동그랗게 살려주세요!',
    status: 'confirmed', // confirmed, completed, cancelled
    refundAmount: 0,
    report: null
  },
  {
    id: 'BK-2026-8790',
    shopId: 'shop-2',
    shopName: '멍냥 스튜디오 성수',
    petName: '초코',
    breed: '토이 푸들',
    weight: '3.9kg',
    sizeLabel: '소형견 (~5kg)',
    styleLabel: '스포팅 (몸 클리핑 + 다리 가위컷)',
    date: '2026-11-12',
    time: '11:00',
    freeCancelDeadline: '2026-11-11 11:00',
    totalPrice: 85000,
    depositAmount: 17000,
    balanceAmount: 68000,
    depositPaid: true,
    notes: ['입질 주의'],
    customMemo: '발톱 깎을 때 예민해요.',
    status: 'completed',
    refundAmount: 0,
    report: {
      clipperLength: '몸 6mm 정방향 / 얼굴 테디베어 가위컷',
      condition: '발톱 정리 시 약간 긴장했으나 간식 급여 후 얌전히 잘 마쳤습니다.',
      recommendation: '4주 후 위생미용, 6주 후 전체미용 권장',
      sentAt: '2026-11-12 13:15'
    }
  }
];

export default function PetGroomingPlatform() {
  // 모드 전환: 'customer' | 'admin'
  const [mode, setMode] = useState('customer');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [showAdminAuthModal, setShowAdminAuthModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  // 보호자 화면 상태
  const [customerTab, setCustomerTab] = useState('explore'); // 'explore' | 'bookings'
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPolicyAccordion, setShowPolicyAccordion] = useState(false);

  // 예약 모달 상태
  const [bookingShop, setBookingShop] = useState(null);
  const [petName, setPetName] = useState('콩이');
  const [breed, setBreed] = useState('말티푸');
  const [weight, setWeight] = useState('4.2kg');
  const [selectedSize, setSelectedSize] = useState(PET_SIZES[0]);
  const [selectedStyle, setSelectedStyle] = useState(GROOMING_STYLES[2]);
  const [bookingDate, setBookingDate] = useState('2026-11-22');
  const [bookingTime, setBookingTime] = useState('15:00');
  const [selectedNotes, setSelectedNotes] = useState(['분리불안']);
  const [customMemo, setCustomMemo] = useState('');
  const [policyAgreed, setPolicyAgreed] = useState(false);

  // 예약 데이터 (보호자 <-> 관리자 실시간 연동)
  const [bookings, setBookings] = useState(INITIAL_BOOKINGS);

  // 취소 모달 상태
  const [cancelTargetBooking, setCancelTargetBooking] = useState(null);
  const [cancelTier, setCancelTier] = useState('free'); // 'free' (100%), 'half' (50%), 'none' (0%)

  // 알림장 상세 보기 모달
  const [viewingReportBooking, setViewingReportBooking] = useState(null);

  // 관리자 화면 상태
  const [adminSelectedBooking, setAdminSelectedBooking] = useState(null);
  const [clipperInput, setClipperInput] = useState('');
  const [conditionInput, setConditionInput] = useState('');
  const [recommendInput, setRecommendInput] = useState('4주 후 위생미용 권장');
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3200);
  };

  // 필터링된 미용실 목록
  const filteredShops = useMemo(() => {
    return SHOPS.filter((shop) => {
      const matchesCat = selectedCategory === 'all' || shop.category === selectedCategory;
      const matchesSearch =
        shop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shop.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shop.tags.some((t) => t.includes(searchQuery));
      return matchesCat && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  // 실시간 예상 견적 및 노쇼 방지 예약금(20%, 최소 10,000원) 계산
  const estimateCalc = useMemo(() => {
    if (!bookingShop) return { total: 0, deposit: 0, balance: 0 };
    const total = bookingShop.basePrice + selectedSize.extra + selectedStyle.extra;
    const deposit = Math.max(10000, Math.round((total * 0.2) / 1000) * 1000);
    const balance = total - deposit;
    return { total, deposit, balance };
  }, [bookingShop, selectedSize, selectedStyle]);

  // 관리자 모드 전환 핸들러
  const handleModeSwitchClick = () => {
    if (mode === 'admin') {
      setMode('customer');
      return;
    }
    if (isAdminAuthenticated) {
      setMode('admin');
    } else {
      setPinInput('');
      setPinError('');
      setShowAdminAuthModal(true);
    }
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (pinInput === '1234') {
      setIsAdminAuthenticated(true);
      setShowAdminAuthModal(false);
      setMode('admin');
      showToast('사장님 관리자 계정으로 전환되었습니다.');
    } else {
      setPinError('PIN 번호가 일치하지 않습니다. (데모 PIN: 1234)');
    }
  };

  const handleDemoQuickLogin = () => {
    setIsAdminAuthenticated(true);
    setShowAdminAuthModal(false);
    setMode('admin');
    showToast('데모 관리자 권한으로 즉시 로그인되었습니다.');
  };

  // 특이사항 토글
  const toggleNote = (label) => {
    setSelectedNotes((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]
    );
  };

  // 예약 확정 처리
  const handleConfirmBooking = () => {
    if (!policyAgreed || !bookingShop) return;

    // 무료 취소 마감 시각 계산 (예약일 하루 전 동일 시간)
    const dateObj = new Date(`${bookingDate}T${bookingTime}`);
    dateObj.setDate(dateObj.getDate() - 1);
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const freeCancelDeadline = `${yyyy}-${mm}-${dd} ${bookingTime}`;

    const newBooking = {
      id: `BK-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      shopId: bookingShop.id,
      shopName: bookingShop.name,
      petName: petName || '우리아이',
      breed: breed || '견종 미입력',
      weight: weight || '미입력',
      sizeLabel: selectedSize.label,
      styleLabel: selectedStyle.label,
      date: bookingDate,
      time: bookingTime,
      freeCancelDeadline,
      totalPrice: estimateCalc.total,
      depositAmount: estimateCalc.deposit,
      balanceAmount: estimateCalc.balance,
      depositPaid: true,
      notes: selectedNotes,
      customMemo,
      status: 'confirmed',
      refundAmount: 0,
      report: null
    };

    setBookings([newBooking, ...bookings]);
    setBookingShop(null);
    setPolicyAgreed(false);
    setCustomerTab('bookings');
    showToast(`예약금 ${estimateCalc.deposit.toLocaleString()}원 결제 및 예약이 완료되었습니다!`);
  };

  // 예약 취소 처리
  const handleExecuteCancel = () => {
    if (!cancelTargetBooking) return;
    let refund = 0;
    if (cancelTier === 'free') refund = cancelTargetBooking.depositAmount;
    else if (cancelTier === 'half') refund = Math.floor(cancelTargetBooking.depositAmount * 0.5);
    else refund = 0;

    setBookings((prev) =>
      prev.map((bk) =>
        bk.id === cancelTargetBooking.id
          ? { ...bk, status: 'cancelled', refundAmount: refund }
          : bk
      )
    );
    setCancelTargetBooking(null);
    showToast(`예약이 취소되었습니다. (예약금 환불 예정액: ${refund.toLocaleString()}원)`);
  };

  // 관리자 알림장 발송 처리
  const handleSendReport = (e) => {
    e.preventDefault();
    if (!adminSelectedBooking) return;

    const now = new Date();
    const sentAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;

    setBookings((prev) =>
      prev.map((bk) =>
        bk.id === adminSelectedBooking.id
          ? {
              ...bk,
              status: 'completed',
              report: {
                clipperLength: clipperInput || '전체 가위컷 및 위생 정리',
                condition: conditionInput || '컨디션 양호하며 미용 협조도가 매우 좋았습니다.',
                recommendation: recommendInput || '4주 후 위생미용 권장',
                sentAt
              }
            }
          : bk
      )
    );

    setAdminSelectedBooking(null);
    setClipperInput('');
    setConditionInput('');
    showToast('보호자 앱으로 미용 알림장이 즉시 발송되었습니다!');
  };

  // 관리자 매출/예약 통계
  const adminStats = useMemo(() => {
    const activeBookings = bookings.filter((b) => b.status !== 'cancelled');
    const totalExpected = activeBookings.reduce((sum, b) => sum + b.totalPrice, 0);
    const totalDeposits = bookings.reduce(
      (sum, b) => sum + (b.status === 'cancelled' ? b.depositAmount - b.refundAmount : b.depositAmount),
      0
    );
    const pendingCount = bookings.filter((b) => b.status === 'confirmed').length;
    return { totalExpected, totalDeposits, pendingCount };
  }, [bookings]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16">
      {/* 토스트 알림 */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-full shadow-xl flex items-center gap-2.5 text-sm font-medium animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 상단 네비게이션 바 */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-sm">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg tracking-tight text-slate-900">포포그루밍</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  {mode === 'customer' ? '보호자용' : '사장님 관리자'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                투명한 견적 · 노쇼 방지 안심 예약 · 맞춤 미용 알림장
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleModeSwitchClick}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                mode === 'admin'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
            >
              {mode === 'admin' ? (
                <>
                  <User className="w-3.5 h-3.5 text-amber-400" />
                  <span>보호자 화면으로</span>
                </>
              ) : (
                <>
                  {isAdminAuthenticated ? (
                    <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  <span>사장님 관리자</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* =========================================================
          1. 보호자 모드 (기본 화면)
      ========================================================= */}
      {mode === 'customer' && (
        <main className="max-w-5xl mx-auto px-4 pt-5">
          {/* 보호자 서브 탭 */}
          <div className="flex gap-2 mb-6 bg-slate-200/70 p-1 rounded-2xl max-w-md">
            <button
              onClick={() => setCustomerTab('explore')}
              className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                customerTab === 'explore'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>미용실 찾기 & 견적</span>
            </button>
            <button
              onClick={() => setCustomerTab('bookings')}
              className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                customerTab === 'bookings'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>내 예약 & 알림장</span>
              <span className="bg-amber-500 text-white text-[11px] px-1.5 py-0.2 rounded-full">
                {bookings.length}
              </span>
            </button>
          </div>

          {/* 탭 1: 미용실 탐색 & 견적 예약 */}
          {customerTab === 'explore' && (
            <div>
              {/* 검색 및 위치 배너 */}
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-5 text-white mb-6 shadow-md">
                <div className="flex items-center gap-1.5 text-amber-100 text-xs font-semibold mb-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>현재 위치: 서울 강남구 청담동 주변</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold mb-3">
                  우리 아이 성향에 딱 맞는 미용실 찾기
                </h1>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="미용실 이름, 동네, 스타일(가위컷, 스파 등) 검색..."
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white text-slate-900 placeholder-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                </div>
              </div>

              {/* 카테고리 필터 */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-5 no-scrollbar">
                <Filter className="w-4 h-4 text-slate-400 shrink-0 mr-1" />
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                      selectedCategory === cat.id
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* 미용실 카드 그리드 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filteredShops.map((shop) => (
                  <div
                    key={shop.id}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col"
                  >
                    <div className="relative h-44 bg-slate-200">
                      <img
                        src={shop.image}
                        alt={shop.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-sm text-white text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-amber-400" />
                        <span>{shop.distance}</span>
                      </div>
                      <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm text-slate-900 text-xs font-extrabold px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-sm">
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        <span>{shop.rating}</span>
                        <span className="text-slate-400 font-normal">({shop.reviewCount})</span>
                      </div>
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h2 className="text-lg font-extrabold text-slate-900">{shop.name}</h2>
                        </div>
                        <p className="text-xs text-slate-500 mb-3">{shop.address} · {shop.designer}</p>

                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {shop.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200/60"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>

                        {/* 포트폴리오 미리보기 */}
                        <div className="mb-4">
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                            최근 스타일 포트폴리오
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {shop.portfolio.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-100"
                              >
                                <img
                                  src={item.img}
                                  alt={item.style}
                                  className="w-10 h-10 rounded-lg object-cover shrink-0"
                                />
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-800 truncate">{item.style}</p>
                                  <p className="text-[10px] text-slate-500 truncate">{item.breed}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          <span className="text-[11px] text-slate-400 block">기본 미용 시작가</span>
                          <span className="text-base font-extrabold text-slate-900">
                            {shop.basePrice.toLocaleString()}원~
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            setBookingShop(shop);
                            setPolicyAgreed(false);
                          }}
                          className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                        >
                          <span>견적 및 예약</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 탭 2: 내 예약 & 미용 알림장 */}
          {customerTab === 'bookings' && (
            <div className="space-y-5">
              {/* 노쇼 방지 예약금 & 취소/환불 통합 정책 아코디언 */}
              <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
                <button
                  onClick={() => setShowPolicyAccordion(!showPolicyAccordion)}
                  className="w-full px-5 py-4 flex items-center justify-between bg-amber-50/70 hover:bg-amber-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900">
                        노쇼 방지 예약금 및 취소·환불 기준 안내
                      </h3>
                      <p className="text-xs text-slate-600">
                        예약 시 총 견적의 20%(최소 1만원)가 예약금으로 선결제되며, 방문 24시간 전까지 100% 환불됩니다.
                      </p>
                    </div>
                  </div>
                  {showPolicyAccordion ? (
                    <ChevronUp className="w-5 h-5 text-slate-500 shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-500 shrink-0" />
                  )}
                </button>

                {showPolicyAccordion && (
                  <div className="p-5 border-t border-amber-100 bg-white text-xs text-slate-700 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                        <span className="font-extrabold text-emerald-800 block mb-1">
                          방문 24시간 전까지
                        </span>
                        <p className="text-emerald-700">예약금 <strong>100% 전액 환불</strong> 및 무료 일정 변경 가능</p>
                      </div>
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                        <span className="font-extrabold text-amber-800 block mb-1">
                          24시간 이내 ~ 2시간 전
                        </span>
                        <p className="text-amber-700">예약금의 <strong>50% 환불</strong> (50% 위약금 차감)</p>
                      </div>
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                        <span className="font-extrabold text-rose-800 block mb-1">
                          2시간 이내 및 노쇼(No-Show)
                        </span>
                        <p className="text-rose-700">예약금 <strong>환불 불가 (0%)</strong> — 전담 디자이너 타임 배정 손실</p>
                      </div>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-slate-500">
                      <li>예약 시간 기준 <strong>15분 이상 사전 연락 없이 지각</strong>할 경우 자동 노쇼 처리되어 당일 시술이 불가할 수 있습니다.</li>
                      <li>현장 결제 잔액은 미용 완료 후 아이의 모질/엉킴 상태에 따라 안내받은 금액으로 매장 결제합니다.</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* 예약 내역 리스트 */}
              {bookings.map((bk) => (
                <div
                  key={bk.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-400">{bk.id}</span>
                      {bk.status === 'confirmed' && (
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                          예약 확정 (예약금 결제완료)
                        </span>
                      )}
                      {bk.status === 'completed' && (
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          미용 완료
                        </span>
                      )}
                      {bk.status === 'cancelled' && (
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-600">
                          예약 취소됨
                        </span>
                      )}
                    </div>

                    {bk.status === 'confirmed' && (
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                        <Clock className="w-3.5 h-3.5" />
                        <span>무료 취소 마감: {bk.freeCancelDeadline}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <h3 className="text-lg font-extrabold text-slate-900">{bk.shopName}</h3>
                      <p className="text-sm font-semibold text-slate-700">
                        {bk.date} {bk.time} · <span className="text-amber-600">{bk.petName}</span> ({bk.breed}, {bk.weight})
                      </p>
                      <p className="text-xs text-slate-500">선택 시술: {bk.styleLabel}</p>

                      {bk.notes.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {bk.notes.map((n) => (
                            <span
                              key={n}
                              className="text-[11px] font-semibold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200"
                            >
                              주의: {n}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 금액 및 액션 버튼 영역 */}
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 min-w-[230px] space-y-1.5">
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>총 예상 미용비</span>
                        <span className="font-bold text-slate-800">{bk.totalPrice.toLocaleString()}원</span>
                      </div>
                      <div className="flex justify-between text-xs text-blue-700 font-semibold">
                        <span>선결제 예약금 (20%)</span>
                        <span>{bk.depositAmount.toLocaleString()}원</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-600 pt-1 border-t border-slate-200">
                        <span>현장 결제 잔액</span>
                        <span className="font-extrabold text-slate-900">{bk.balanceAmount.toLocaleString()}원</span>
                      </div>

                      {bk.status === 'cancelled' && (
                        <div className="pt-1.5 text-[11px] font-bold text-rose-600 flex justify-between">
                          <span>예약금 환불 처리액</span>
                          <span>{bk.refundAmount.toLocaleString()}원</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 하단 액션 버튼 */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end gap-2">
                    {bk.status === 'confirmed' && (
                      <button
                        onClick={() => {
                          setCancelTargetBooking(bk);
                          setCancelTier('free');
                        }}
                        className="text-xs font-bold text-slate-600 hover:text-rose-600 px-3.5 py-2 rounded-xl border border-slate-200 hover:border-rose-200 hover:bg-rose-50 transition-all"
                      >
                        예약 취소 및 환불 안내
                      </button>
                    )}

                    {bk.status === 'completed' && bk.report && (
                      <button
                        onClick={() => setViewingReportBooking(bk)}
                        className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>미용 알림장 확인하기</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* =========================================================
          2. 사장님 관리자 모드 (인증 완료 시 노출)
      ========================================================= */}
      {mode === 'admin' && isAdminAuthenticated && (
        <main className="max-w-5xl mx-auto px-4 pt-6">
          {/* 관리자 요약 대시보드 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500">대기 중인 확정 예약</span>
                <Calendar className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-2xl font-extrabold text-slate-900">{adminStats.pendingCount}건</p>
              <p className="text-[11px] text-slate-400 mt-1">노쇼 방지 예약금 선결제 완료 건</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500">확보된 예약금 매출</span>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-extrabold text-emerald-700">
                {adminStats.totalDeposits.toLocaleString()}원
              </p>
              <p className="text-[11px] text-slate-400 mt-1">선결제 예약금 + 취소 위약금 정산 합계</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500">총 예상 매출액 (현장잔액 포함)</span>
                <CreditCard className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-2xl font-extrabold text-slate-900">
                {adminStats.totalExpected.toLocaleString()}원
              </p>
              <p className="text-[11px] text-slate-400 mt-1">취소 건 제외 정상 예약 기준</p>
            </div>
          </div>

          {/* 실시간 예약 관리 리스트 */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-amber-400" />
                <h2 className="font-extrabold text-base">실시간 예약 접수 및 반려동물 히스토리 차트</h2>
              </div>
              <span className="text-xs text-slate-300">보호자 앱과 실시간 동기화됨</span>
            </div>

            <div className="divide-y divide-slate-200">
              {bookings.map((bk) => (
                <div key={bk.id} className="p-5 hover:bg-slate-50/80 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-400">{bk.id}</span>
                        <span className="text-sm font-extrabold text-slate-900">
                          {bk.date} {bk.time}
                        </span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {bk.shopName}
                        </span>
                        {bk.status === 'confirmed' && (
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                            시술 대기
                          </span>
                        )}
                        {bk.status === 'completed' && (
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            시술 & 알림장 발송완료
                          </span>
                        )}
                        {bk.status === 'cancelled' && (
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700">
                            보호자 취소 (환불 {bk.refundAmount.toLocaleString()}원)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Dog className="w-4 h-4 text-amber-600" />
                        <span className="font-extrabold text-base text-slate-900">{bk.petName}</span>
                        <span className="text-xs text-slate-600">
                          ({bk.breed} / {bk.weight} / {bk.sizeLabel})
                        </span>
                      </div>

                      <p className="text-xs font-semibold text-slate-700">시술 내역: {bk.styleLabel}</p>

                      {/* 특이사항 경고 배지 */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {bk.notes.map((note) => (
                          <span
                            key={note}
                            className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-md bg-rose-100 text-rose-800"
                          >
                            <AlertTriangle className="w-3 h-3" />
                            {note}
                          </span>
                        ))}
                        {bk.customMemo && (
                          <span className="text-xs text-slate-600 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md">
                            보호자 메모: &ldquo;{bk.customMemo}&rdquo;
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 정산 상태 및 차트 작성 버튼 */}
                    <div className="flex flex-col sm:items-end gap-2 shrink-0">
                      <div className="text-left sm:text-right bg-slate-100 px-3.5 py-2 rounded-xl">
                        <p className="text-[11px] text-slate-500">
                          예약금 선결제: <strong className="text-emerald-700">{bk.depositAmount.toLocaleString()}원</strong>
                        </p>
                        <p className="text-xs font-extrabold text-slate-900">
                          현장 수납 잔액: {bk.balanceAmount.toLocaleString()}원
                        </p>
                      </div>

                      {bk.status === 'confirmed' && (
                        <button
                          onClick={() => {
                            setAdminSelectedBooking(bk);
                            setClipperInput('');
                            setConditionInput('');
                          }}
                          className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
                        >
                          <Send className="w-3.5 h-3.5 text-amber-400" />
                          <span>미용 차트 기록 & 알림장 발송</span>
                        </button>
                      )}

                      {bk.status === 'completed' && bk.report && (
                        <button
                          onClick={() => setViewingReportBooking(bk)}
                          className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3.5 py-2 rounded-xl transition-all"
                        >
                          발송된 차트 보기
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      )}

      {/* =========================================================
          모달 1: 보호자 실시간 견적 및 예약 + 노쇼 방지 정책 동의
      ========================================================= */}
      {bookingShop && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-slate-100 flex items-center justify-between z-10">
              <div>
                <span className="text-xs font-bold text-amber-600">{bookingShop.name}</span>
                <h3 className="text-lg font-extrabold text-slate-900">실시간 견적 및 예약하기</h3>
              </div>
              <button
                onClick={() => setBookingShop(null)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* 반려동물 기본 정보 */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-2">
                  1. 반려동물 정보
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={petName}
                    onChange={(e) => setPetName(e.target.value)}
                    placeholder="이름 (예: 콩이)"
                    className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-amber-500"
                  />
                  <input
                    type="text"
                    value={breed}
                    onChange={(e) => setBreed(e.target.value)}
                    placeholder="견종 (예: 말티푸)"
                    className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-amber-500"
                  />
                  <input
                    type="text"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="몸무게 (4.2kg)"
                    className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* 체급 선택 */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-2">
                  2. 체급 선택 (기본가 {bookingShop.basePrice.toLocaleString()}원)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {PET_SIZES.map((sz) => (
                    <button
                      key={sz.id}
                      type="button"
                      onClick={() => setSelectedSize(sz)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        selectedSize.id === sz.id
                          ? 'border-amber-500 bg-amber-50 text-amber-900 font-bold'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-xs block">{sz.label}</span>
                      <span className="text-[11px] text-amber-700 font-semibold">
                        +{sz.extra.toLocaleString()}원
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 미용 스타일 선택 */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-2">
                  3. 미용 스타일 선택
                </label>
                <div className="space-y-2">
                  {GROOMING_STYLES.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setSelectedStyle(st)}
                      className={`w-full px-3.5 py-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                        selectedStyle.id === st.id
                          ? 'border-amber-500 bg-amber-50 text-amber-900 font-extrabold'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>{st.label}</span>
                      <span className="text-amber-700">+{st.extra.toLocaleString()}원</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 날짜 및 시간 */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-2">
                  4. 희망 날짜 및 시간
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold"
                  />
                  <select
                    value={bookingTime}
                    onChange={(e) => setBookingTime(e.target.value)}
                    className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white"
                  >
                    <option value="10:00">오전 10:00</option>
                    <option value="13:00">오후 1:00</option>
                    <option value="15:00">오후 3:00</option>
                    <option value="17:00">오후 5:00</option>
                  </select>
                </div>
              </div>

              {/* 특이사항 전달 */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-2">
                  5. 아이 성향 및 특이사항 전달 (디자이너 필수 확인)
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {SPECIAL_NOTES.map((note) => {
                    const active = selectedNotes.includes(note.label);
                    return (
                      <button
                        key={note.id}
                        type="button"
                        onClick={() => toggleNote(note.label)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                          active
                            ? 'bg-rose-600 text-white border-rose-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {note.label}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="text"
                  value={customMemo}
                  onChange={(e) => setCustomMemo(e.target.value)}
                  placeholder="디자이너에게 추가로 전달할 요청사항을 적어주세요."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* 예상 금액 및 노쇼 방지 예약금 분리 정산 박스 */}
              <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-2">
                <div className="flex justify-between text-xs text-slate-300">
                  <span>총 예상 미용 금액</span>
                  <span className="font-bold text-white">{estimateCalc.total.toLocaleString()}원</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold text-amber-400">
                  <span>지금 결제할 노쇼 방지 예약금 (20%)</span>
                  <span>{estimateCalc.deposit.toLocaleString()}원</span>
                </div>
                <div className="flex justify-between text-xs text-slate-300 pt-2 border-t border-slate-700">
                  <span>미용 완료 후 현장 결제 잔액</span>
                  <span className="font-bold text-white">{estimateCalc.balance.toLocaleString()}원</span>
                </div>
              </div>

              {/* 노쇼 방지 취소·환불 기준 및 필수 동의 */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center gap-1.5 text-amber-900 font-extrabold text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>노쇼 방지 예약금 및 취소·환불 규정 안내</span>
                </div>
                <ul className="text-[11px] text-amber-900/90 space-y-1 pl-4 list-disc">
                  <li><strong>방문 24시간 전까지:</strong> 예약금 100% 전액 환불</li>
                  <li><strong>방문 24시간 이내 ~ 2시간 전:</strong> 예약금 50% 환불</li>
                  <li><strong>방문 2시간 이내 및 노쇼(15분 이상 지각):</strong> 예약금 환불 불가</li>
                </ul>
                <label className="flex items-start gap-2 pt-2 border-t border-amber-200/80 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={policyAgreed}
                    onChange={(e) => setPolicyAgreed(e.target.checked)}
                    className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    [필수] 노쇼 방지 예약금 결제 및 시간대별 취소·환불 규정을 확인했으며 이에 동의합니다.
                  </span>
                </label>
              </div>

              <button
                type="button"
                disabled={!policyAgreed}
                onClick={handleConfirmBooking}
                className={`w-full py-3.5 rounded-2xl font-extrabold text-sm shadow-md transition-all ${
                  policyAgreed
                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                예약금 {estimateCalc.deposit.toLocaleString()}원 결제하고 예약 확정
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          모달 2: 보호자 예약 취소 및 환불 시뮬레이터 모달
      ========================================================= */}
      {cancelTargetBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-slate-900">예약 취소 및 환불 기준 확인</h3>
              <button
                onClick={() => setCancelTargetBooking(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              <strong>{cancelTargetBooking.shopName}</strong> ({cancelTargetBooking.date} {cancelTargetBooking.time}) 예약을 취소합니다. 취소 시점에 따른 환불 금액을 확인해 주세요.
            </p>

            {/* 데모용 취소 시점 시뮬레이션 선택 */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-400 block">
                취소 시점 기준 선택 (프로토타입 시뮬레이션)
              </span>
              <button
                type="button"
                onClick={() => setCancelTier('free')}
                className={`w-full p-3 rounded-xl border text-left text-xs flex justify-between items-center ${
                  cancelTier === 'free'
                    ? 'border-emerald-500 bg-emerald-50 font-bold text-emerald-900'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                <span>방문 24시간 이전 취소 (100% 환불)</span>
                <span>{cancelTargetBooking.depositAmount.toLocaleString()}원 환불</span>
              </button>
              <button
                type="button"
                onClick={() => setCancelTier('half')}
                className={`w-full p-3 rounded-xl border text-left text-xs flex justify-between items-center ${
                  cancelTier === 'half'
                    ? 'border-amber-500 bg-amber-50 font-bold text-amber-900'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                <span>방문 24시간 이내 ~ 2시간 전 (50% 환불)</span>
                <span>{Math.floor(cancelTargetBooking.depositAmount * 0.5).toLocaleString()}원 환불</span>
              </button>
              <button
                type="button"
                onClick={() => setCancelTier('none')}
                className={`w-full p-3 rounded-xl border text-left text-xs flex justify-between items-center ${
                  cancelTier === 'none'
                    ? 'border-rose-500 bg-rose-50 font-bold text-rose-900'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                <span>방문 2시간 이내 취소 (환불 불가)</span>
                <span>0원 환불</span>
              </button>
            </div>

            <div className="bg-slate-100 p-4 rounded-2xl flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">최종 예약금 환불 예정액</span>
              <span className="text-lg font-extrabold text-rose-600">
                {(cancelTier === 'free'
                  ? cancelTargetBooking.depositAmount
                  : cancelTier === 'half'
                  ? Math.floor(cancelTargetBooking.depositAmount * 0.5)
                  : 0
                ).toLocaleString()}
                원
              </span>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancelTargetBooking(null)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                예약 유지하기
              </button>
              <button
                type="button"
                onClick={handleExecuteCancel}
                className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-sm"
              >
                예약 취소 확정
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          모달 3: 미용 알림장 상세 조회 (보호자 & 관리자 공용)
      ========================================================= */}
      {viewingReportBooking && viewingReportBooking.report && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h3 className="text-lg font-extrabold text-slate-900">
                  {viewingReportBooking.petName}의 미용 알림장
                </h3>
              </div>
              <button
                onClick={() => setViewingReportBooking(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200/70">
                <span className="font-bold text-amber-800 block mb-1">시술 스타일 및 클리퍼 날 길이</span>
                <p className="text-slate-800 font-semibold">{viewingReportBooking.report.clipperLength}</p>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70">
                <span className="font-bold text-slate-600 block mb-1">오늘의 아이 컨디션 & 특이사항</span>
                <p className="text-slate-800 leading-relaxed">{viewingReportBooking.report.condition}</p>
              </div>

              <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200/70">
                <span className="font-bold text-emerald-800 block mb-1">다음 미용 추천 주기</span>
                <p className="text-emerald-900 font-semibold">{viewingReportBooking.report.recommendation}</p>
              </div>

              <p className="text-[11px] text-slate-400 text-right">
                발송 일시: {viewingReportBooking.report.sentAt} · {viewingReportBooking.shopName}
              </p>
            </div>

            <button
              onClick={() => setViewingReportBooking(null)}
              className="w-full py-3 rounded-xl bg-slate-900 text-white text-xs font-extrabold"
            >
              확인 완료
            </button>
          </div>
        </div>
      )}

      {/* =========================================================
          모달 4: 사장님 관리자 PIN 인증 모달
      ========================================================= */}
      {showAdminAuthModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-slate-900" />
                <h3 className="text-lg font-extrabold text-slate-900">사장님 관리자 인증</h3>
              </div>
              <button
                onClick={() => setShowAdminAuthModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              매장 예약 현황, 고객 히스토리 차트 및 정산 내역은 인증된 관리자 계정에서만 열람할 수 있습니다.
            </p>

            <form onSubmit={handleAdminLogin} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  관리자 PIN 번호 입력 (데모 번호: 1234)
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="••••"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-center text-lg font-extrabold tracking-widest focus:outline-none focus:border-slate-900"
                />
                {pinError && <p className="text-xs text-rose-600 font-semibold mt-1">{pinError}</p>}
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold shadow-sm"
              >
                PIN 번호로 로그인
              </button>
            </form>

            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleDemoQuickLogin}
                className="w-full py-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-extrabold transition-colors"
              >
                원클릭 데모 관리자 전환 (PIN 생략)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          모달 5: 사장님 미용 차트 기록 & 알림장 발송 모달
      ========================================================= */}
      {adminSelectedBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-bold text-amber-600">디자이너 전용 히스토리 차트</span>
                <h3 className="text-lg font-extrabold text-slate-900">
                  {adminSelectedBooking.petName} 미용 기록 및 알림장 발송
                </h3>
              </div>
              <button
                onClick={() => setAdminSelectedBooking(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendReport} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  사용 클리퍼 날 길이 / 스타일 상세 기록
                </label>
                <input
                  type="text"
                  required
                  value={clipperInput}
                  onChange={(e) => setClipperInput(e.target.value)}
                  placeholder="예: 몸 6mm 역방향 / 얼굴 테디베어 가위컷"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  오늘의 아이 컨디션 및 특이사항 메모
                </label>
                <textarea
                  rows={3}
                  required
                  value={conditionInput}
                  onChange={(e) => setConditionInput(e.target.value)}
                  placeholder="예: 드라이할 때 약간 긴장했지만 간식 급여 후 얌전히 잘 마쳤습니다."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  다음 미용 추천 주기
                </label>
                <input
                  type="text"
                  value={recommendInput}
                  onChange={(e) => setRecommendInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-slate-900"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-1.5"
              >
                <Send className="w-4 h-4" />
                <span>시술 완료 처리 및 보호자 알림장 발송</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
