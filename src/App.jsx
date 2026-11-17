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
  { id: 'default-1', name: '포포 멍뭉이 미용실', region: '인천', district: '남동구 구월동', desc: '스파/가위컷 전문 · 100% 예약제', price: '45,000원~', tag: '스파' },
  { id: 'default-2', name: '예쁜 댕댕이 샵', region: '서울', district: '마포구 연남동', desc: '오픈형 통유리 미용실 · 대형견 가능', price: '50,000원~', tag: '오픈형' },
  { id: 'default-3', name: '힐링 반려동물 케어', region: '인천', district: '연수구 송도동', desc: '노령견/특수견 저자극 케어 전문', price: '55,000원~', tag: '노령견' },
  { id: 'default-4', name: '강남 프리미엄 펫살롱', region: '서울', district: '강남구 신사동', desc: '1:1 맞춤형 프리미엄 스타일링', price: '65,000원~', tag: '프리미엄' },
  { id: 'default-5', name: '분당 코지 그루밍', region: '경기', district: '성남시 분당구', desc: '스트레스 프리 탄산스파 전문', price: '50,000원~', tag: '탄산스파' },
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
  const [userTab, setUserTab] = useState('search');
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
  const [ownerTab, setOwnerTab] = useState('bookings');
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
      alert('예약 날짜를 선택해 주세요.');
      return;
    }
    const petSummary = petBreed
      ? `${petName} (${petBreed}${petWeight ? `, ${petWeight}kg` : ''})`
      : petName || userProfile?.extraInfo || '반려견';

    try {
      await addDoc(collection(db, 'bookings'), {
        shop: bookingModalShop.name,
        shopRegion: `${bookingModalShop.region} ${bookingModalShop.district || ''}`.trim(),
        customerId: user.uid,
        customer: userProfile?.name || '보호자',
        pet: petSummary,
        petNote: petNote || '특이사항 없음',
        service: bookingService,
        requestNote: bookingNote || '없음',
        time: `${bookingDate} ${bookingTime}`,
        status: '대기 중',
        createdAt: serverTimestamp(),
      });
      alert(`"${bookingModalShop.name}"에 예약 신청이 완료되었습니다!`);
      setBookingModalShop(null);
      setBookingNote('');
      setUserTab('bookings');
    } catch (err) {
      alert('예약 저장 실패: ' + err.message);
    }
  };

  // 5. 보호자: 대기 중 예약 취소
  const handleCancelBooking = async (id) => {
    if (!window.confirm('정말 이 예약을 취소하시겠습니까?')) return;
    try {
      await deleteDoc(doc(db, 'bookings', id));
    } catch (err) {
      alert('취소 실패: ' + err.message);
    }
  };

  // 6. 보호자: 반려견 상세 프로필 저장
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

  // 7. 사장님: 내 매장 등록/업데이트
  const handleRegisterShop = async (e) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'shops', user.uid), {
        ownerId: user.uid,
        name: userProfile.extraInfo,
        region: shopRegion,
        district: shopDistrict || '중심가',
        desc: shopDesc || '정성껏 케어하는 반려견 전문 미용실',
        price: shopPrice || '50,000원~',
        createdAt: serverTimestamp(),
      });
      alert('매장 정보가 등록되어 보호자 홈에 노출됩니다!');
      setOwnerTab('bookings');
    } catch (err) {
      alert('매장 등록 실패: ' + err.message);
    }
  };

  // 8. 사장님: 예약 상태 변경
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

  // [화면 A] 로그인 / 회원가입 (감성적인 디자인 적용)
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
    const allShops = [...dbShops, ...DEFAULT_SHOPS];
    const myBookings = bookings.filter((b) => b.customerId === user.uid);

    const filteredShops = allShops.filter((shop) => {
      const matchesRegion = selectedRegion === '전체' || shop.region === selectedRegion;
      const keyword = searchTerm.toLowerCase();
      const matchesSearch =
        shop.name.toLowerCase().includes(keyword) ||
        (shop.district && shop.district.toLowerCase().includes(keyword)) ||
        (shop.desc && shop.desc.toLowerCase().includes(keyword));
      return matchesRegion && matchesSearch;
    });

    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        {/* 상단 네비게이션 */}
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

        {/* 하단 탭 (모바일 최적화 하단바 스타일 혹은 상단 서브 탭) */}
        <div className="bg-white border-b border-gray-100 sticky top-[57px] z-10 shadow-sm">
          <div className="max-w-md mx-auto grid grid-cols-3 text-center text-xs font-bold">
            <button
              onClick={() => setUserTab('search')}
              className={`py-3.5 border-b-2 transition flex items-center justify-center space-x-1 ${
                userTab === 'search' ? 'border-orange-500 text-orange-600 bg-orange-50/30' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <span>🔍</span>
              <span>미용실 찾기</span>
            </button>
            <button
              onClick={() => setUserTab('bookings')}
              className={`py-3.5 border-b-2 transition flex items-center justify-center space-x-1 ${
                userTab === 'bookings' ? 'border-orange-500 text-orange-600 bg-orange-50/30' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <span>📋</span>
              <span>내 예약 ({myBookings.length})</span>
            </button>
            <button
              onClick={() => setUserTab('pet')}
              className={`py-3.5 border-b-2 transition flex items-center justify-center space-x-1 ${
                userTab === 'pet' ? 'border-orange-500 text-orange-600 bg-orange-50/30' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <span>🐶</span>
              <span>반려견 관리</span>
            </button>
          </div>
        </div>

        <main className="max-w-md mx-auto p-4 space-y-5">
          {userTab === 'search' && (
            <>
              {/* 환영 배너 */}
              <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-3xl p-5 shadow-lg shadow-orange-500/20 relative overflow-hidden">
                <div className="absolute right-[-10px] bottom-[-10px] text-7xl opacity-15">🐕</div>
                <h2 className="text-base font-black tracking-tight">우리 아이 맞춤 미용실</h2>
                <p className="text-xs opacity-90 mt-1 font-medium">실시간으로 예약하고 안전하게 케어받으세요.</p>
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">🔍</span>
                  <input
                    type="text"
                    placeholder="지역(구/동), 미용실 이름, 특징 검색"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-2xl pl-10 pr-4 py-3.5 text-sm shadow-sm focus:border-orange-500 focus:outline-none transition"
                  />
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {['전체', '서울', '인천', '경기'].map((region) => (
                    <button
                      key={region}
                      onClick={() => setSelectedRegion(region)}
                      className={`py-2.5 rounded-2xl text-xs font-bold transition shadow-sm ${
                        selectedRegion === region
                          ? 'bg-slate-900 text-white shadow-md'
                          : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {region}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-extrabold text-gray-800 mb-3 text-xs tracking-wide uppercase text-gray-400">
                  추천 제휴 미용실 ({filteredShops.length}곳)
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
                        className="bg-white p-4.5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center hover:shadow-md transition duration-200"
                      >
                        <div className="pr-2 space-y-1">
                          <div className="flex items-center space-x-1.5 flex-wrap">
                            <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">
                              {shop.region} {shop.district}
                            </span>
                            <h4 className="font-extrabold text-gray-900 text-sm">{shop.name}</h4>
                          </div>
                          <p className="text-xs text-gray-500 font-medium">{shop.desc}</p>
                          <p className="text-xs font-bold text-orange-600">{shop.price || '50,000원~'}</p>
                        </div>
                        <button
                          onClick={() => {
                            const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
                            setBookingDate(tomorrow);
                            setBookingModalShop(shop);
                          }}
                          className="shrink-0 bg-orange-500 hover:bg-orange-600 text-white text-xs px-4 py-2.5 rounded-xl font-bold shadow-sm shadow-orange-500/20 transition active:scale-95"
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
                      <p>🗓️ 일시: <span className="font-bold text-gray-800">{b.time}</span></p>
                      <p>✂️ 메뉴: <span className="font-bold text-gray-800">{b.service || '기본 미용'}</span></p>
                      {b.requestNote && b.requestNote !== '없음' && (
                        <p>💬 요청: <span className="text-gray-700">{b.requestNote}</span></p>
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

        {/* 예약 모달 */}
        {bookingModalShop && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-gray-100">
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <div>
                  <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">미용 예약</span>
                  <h3 className="font-black text-gray-900 text-base mt-1">{bookingModalShop.name}</h3>
                </div>
                <button
                  onClick={() => setBookingModalShop(null)}
                  className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 font-bold hover:bg-gray-200 transition"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleConfirmBooking} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">희망 날짜</label>
                    <input
                      type="date"
                      value={bookingDate}
                      onChange={(e) => setBookingDate(e.target.value)}
                      required
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">희망 시간</label>
                    <select
                      value={bookingTime}
                      onChange={(e) => setBookingTime(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:bg-white focus:outline-none font-bold"
                    >
                      {['10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">미용 서비스 선택</label>
                  <select
                    value={bookingService}
                    onChange={(e) => setBookingService(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 text-xs focus:bg-white focus:outline-none font-bold text-gray-800"
                  >
                    <option>전체 미용 (가위컷/클리핑)</option>
                    <option>목욕 + 부분 미용 (위생/발바닥)</option>
                    <option>탄산 스파 + 힐링 케어</option>
                    <option>엉킴 제거 + 전체 클리핑</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">요청사항</label>
                  <input
                    type="text"
                    placeholder="예: 얼굴은 곰돌이컷으로 부탁드려요"
                    value={bookingNote}
                    onChange={(e) => setBookingNote(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-3 text-xs focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="flex space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setBookingModalShop(null)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-3 rounded-2xl text-xs font-bold transition"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-2xl text-xs font-bold shadow-md shadow-orange-500/20 transition"
                  >
                    예약 확정하기
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
            🏪 매장 홍보 관리
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
                      <p className="text-orange-400 font-semibold">✂️ 미용 메뉴: {item.service || '기본 미용'}</p>
                      {item.petNote && item.petNote !== '특이사항 없음' && (
                        <p className="text-rose-400 font-medium">⚠️ 특이사항: {item.petNote}</p>
                      )}
                      {item.requestNote && item.requestNote !== '없음' && (
                        <p className="text-slate-400">💬 요청: {item.requestNote}</p>
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
              <h3 className="font-black text-white text-base">🏪 보호자 앱 홍보 매장 등록</h3>
              <p className="text-xs text-slate-400 mt-0.5">등록 즉시 보호자 화면의 [미용실 찾기] 최상단에 노출됩니다.</p>
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
              <label className="block text-xs font-bold text-slate-300 mb-1">기본 가격 안내</label>
              <input
                type="text"
                placeholder="예: 45,000원~"
                value={shopPrice}
                onChange={(e) => setShopPrice(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">매장 한 줄 소개 및 강점</label>
              <input
                type="text"
                placeholder="예: 가위컷 전문 · 스파 케어 · 100% 예약제"
                value={shopDesc}
                onChange={(e) => setShopDesc(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 rounded-2xl shadow-md shadow-orange-500/20 text-sm transition"
            >
              매장 정보 등록 및 노출하기
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
