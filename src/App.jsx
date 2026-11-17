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
      alert('반려견 프로필이 저장되었습니다! 다음 예약부터 자동 반영됩니다.');
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
      alert('매장 정보가 등록되었습니다! 이제 보호자 검색 화면에 노출됩니다.');
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
      <div className="min-h-screen flex items-center justify-center bg-orange-50">
        <p className="text-orange-600 font-bold">🐾 포포그루밍 불러오는 중...</p>
      </div>
    );
  }

  // [화면 A] 로그인 / 회원가입
  if (!user || !userProfile) {
    return (
      <div className="min-h-screen bg-orange-50 flex flex-col justify-center items-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-6">
            <span className="text-4xl block mb-2">🐾</span>
            <h1 className="text-2xl font-bold text-gray-800">포포그루밍</h1>
            <p className="text-xs text-gray-500 mt-1">
              {isSignUp ? '계정을 생성하고 서비스를 시작하세요' : '로그인하여 예약을 관리하세요'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('user')}
                    className={`py-2.5 rounded-xl text-xs font-bold border transition ${
                      role === 'user'
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-gray-50 text-gray-600 border-gray-200'
                    }`}
                  >
                    🐶 반려견 보호자
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('owner')}
                    className={`py-2.5 rounded-xl text-xs font-bold border transition ${
                      role === 'owner'
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-gray-50 text-gray-600 border-gray-200'
                    }`}
                  >
                    ✂️ 미용실 사장님
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="이름 (예: 홍길동)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm"
                />

                <input
                  type="text"
                  placeholder={
                    role === 'user'
                      ? '반려견 이름 (예: 초코)'
                      : '운영 중인 미용실 이름 (예: 포포 멍뭉이 미용실)'
                  }
                  value={extraInfo}
                  onChange={(e) => setExtraInfo(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm"
                />
              </>
            )}

            <input
              type="email"
              placeholder="이메일 주소"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm"
            />

            <input
              type="password"
              placeholder="비밀번호 (6자 이상)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm"
            />

            <button
              type="submit"
              className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl shadow-md hover:bg-orange-600 transition text-sm"
            >
              {isSignUp ? '회원가입 완료하기' : '로그인'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs text-gray-500 underline"
            >
              {isSignUp ? '이미 계정이 있으신가요? 로그인' : '처음이신가요? 보호자/사장님 회원가입'}
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
      <div className="min-h-screen bg-gray-50 pb-20">
        <header className="bg-white shadow-sm p-4 flex justify-between items-center sticky top-0 z-10">
          <div className="flex items-center space-x-2">
            <span className="text-xl">🐾</span>
            <span className="font-bold text-gray-800 text-sm">
              {userProfile.name}님 ({userProfile.extraInfo})
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg font-medium"
          >
            로그아웃
          </button>
        </header>

        {/* 상단 네비게이션 탭 */}
        <div className="bg-white border-b border-gray-200 sticky top-[57px] z-10">
          <div className="max-w-md mx-auto grid grid-cols-3 text-center text-xs font-bold">
            <button
              onClick={() => setUserTab('search')}
              className={`py-3 border-b-2 transition ${
                userTab === 'search' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500'
              }`}
            >
              🔍 미용실 찾기
            </button>
            <button
              onClick={() => setUserTab('bookings')}
              className={`py-3 border-b-2 transition ${
                userTab === 'bookings' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500'
              }`}
            >
              📋 내 예약 ({myBookings.length})
            </button>
            <button
              onClick={() => setUserTab('pet')}
              className={`py-3 border-b-2 transition ${
                userTab === 'pet' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500'
              }`}
            >
              🐶 반려견 관리
            </button>
          </div>
        </div>

        <main className="max-w-md mx-auto p-4 space-y-5">
          {/* 탭 1: 미용실 검색 & 예약 */}
          {userTab === 'search' && (
            <>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="지역(구/동), 미용실 이름, 특징 검색 (예: 구월동, 스파)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm shadow-sm focus:outline-none focus:border-orange-500"
                />

                <div className="grid grid-cols-4 gap-1.5">
                  {['전체', '서울', '인천', '경기'].map((region) => (
                    <button
                      key={region}
                      onClick={() => setSelectedRegion(region)}
                      className={`py-2 rounded-xl text-xs font-bold transition shadow-sm ${
                        selectedRegion === region
                          ? 'bg-slate-800 text-white'
                          : 'bg-white text-gray-600 border border-gray-200'
                      }`}
                    >
                      {region}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-bold text-gray-800 mb-3 text-sm">
                  검색 결과 ({filteredShops.length}곳)
                </h3>
                {filteredShops.length === 0 ? (
                  <p className="text-xs text-gray-400 bg-white p-6 rounded-xl text-center shadow-sm">
                    조건에 일치하는 미용실이 없습니다.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {filteredShops.map((shop) => (
                      <div
                        key={shop.id}
                        className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center"
                      >
                        <div className="pr-2">
                          <div className="flex items-center space-x-1.5 flex-wrap">
                            <span className="text-[11px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-bold">
                              {shop.region} {shop.district}
                            </span>
                            <h4 className="font-bold text-gray-800 text-sm">{shop.name}</h4>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{shop.desc}</p>
                          <p className="text-xs font-semibold text-orange-600 mt-1">{shop.price || '50,000원~'}</p>
                        </div>
                        <button
                          onClick={() => {
                            const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
                            setBookingDate(tomorrow);
                            setBookingModalShop(shop);
                          }}
                          className="shrink-0 bg-orange-500 text-white text-xs px-3.5 py-2.5 rounded-xl font-bold shadow-sm hover:bg-orange-600 transition"
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

          {/* 탭 2: 내 예약 신청 내역 */}
          {userTab === 'bookings' && (
            <div className="space-y-3">
              <h3 className="font-bold text-gray-800 text-sm">📋 내 예약 현황</h3>
              {myBookings.length === 0 ? (
                <p className="text-xs text-gray-400 bg-white p-6 rounded-xl text-center">
                  아직 신청한 예약이 없습니다.
                </p>
              ) : (
                myBookings.map((b) => (
                  <div
                    key={b.id}
                    className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-2"
                  >
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-gray-800 text-sm">{b.shop}</h4>
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                          b.status === '승인됨'
                            ? 'bg-emerald-100 text-emerald-700'
                            : b.status === '거절됨'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-orange-100 text-orange-600'
                        }`}
                      >
                        {b.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600">일시: {b.time}</p>
                    <p className="text-xs text-gray-500">서비스: {b.service || '기본 미용'}</p>
                    {b.requestNote && b.requestNote !== '없음' && (
                      <p className="text-xs text-gray-400">요청사항: {b.requestNote}</p>
                    )}
                    {b.status === '대기 중' && (
                      <div className="pt-2 border-t border-gray-100 text-right">
                        <button
                          onClick={() => handleCancelBooking(b.id)}
                          className="text-xs text-rose-500 font-medium underline"
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

          {/* 탭 3: 반려견 상세 정보 관리 */}
          {userTab === 'pet' && (
            <form onSubmit={handleSavePetDetail} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
              <h3 className="font-bold text-gray-800 text-sm">🐶 우리 아이 상세 프로필</h3>
              <p className="text-xs text-gray-400">입력한 정보는 미용 예약 시 사장님께 자동 전달됩니다.</p>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">반려견 이름</label>
                <input
                  type="text"
                  value={petName}
                  onChange={(e) => setPetName(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">견종</label>
                  <input
                    type="text"
                    placeholder="예: 말티푸"
                    value={petBreed}
                    onChange={(e) => setPetBreed(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">몸무게 (kg)</label>
                  <input
                    type="text"
                    placeholder="예: 4.5"
                    value={petWeight}
                    onChange={(e) => setPetWeight(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">특이사항 (입질, 피부질환, 겁많음 등)</label>
                <textarea
                  rows="3"
                  placeholder="미용사님이 미리 알아야 할 내용을 적어주세요."
                  value={petNote}
                  onChange={(e) => setPetNote(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl shadow-sm hover:bg-orange-600 text-sm"
              >
                반려견 정보 저장하기
              </button>
            </form>
          )}
        </main>

        {/* 상세 예약 신청 모달 */}
        {bookingModalShop && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-gray-800 text-base">{bookingModalShop.name} 예약</h3>
                <button
                  onClick={() => setBookingModalShop(null)}
                  className="text-gray-400 text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleConfirmBooking} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">희망 날짜</label>
                    <input
                      type="date"
                      value={bookingDate}
                      onChange={(e) => setBookingDate(e.target.value)}
                      required
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">희망 시간</label>
                    <select
                      value={bookingTime}
                      onChange={(e) => setBookingTime(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs"
                    >
                      {['10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">미용 스타일/서비스</label>
                  <select
                    value={bookingService}
                    onChange={(e) => setBookingService(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-xs"
                  >
                    <option>전체 미용 (가위컷/클리핑)</option>
                    <option>목욕 + 부분 미용 (위생/발바닥)</option>
                    <option>탄산 스파 + 힐링 케어</option>
                    <option>엉킴 제거 + 전체 클리핑</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">추가 요청사항</label>
                  <input
                    type="text"
                    placeholder="예: 얼굴은 동그랗게 곰돌이컷 부탁드려요"
                    value={bookingNote}
                    onChange={(e) => setBookingNote(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-xs"
                  />
                </div>

                <div className="flex space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setBookingModalShop(null)}
                    className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-xs font-bold"
                  >
                    닫기
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-orange-500 text-white py-2.5 rounded-xl text-xs font-bold shadow-md hover:bg-orange-600"
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
    <div className="min-h-screen bg-slate-100 pb-10">
      <header className="bg-slate-900 text-white p-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center space-x-2">
          <span className="text-xl">✂️</span>
          <span className="font-bold text-sm">{userProfile.extraInfo} (사장님)</span>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs bg-slate-700 text-white px-3 py-1.5 rounded-lg font-medium"
        >
          로그아웃
        </button>
      </header>

      {/* 사장님 상단 탭 */}
      <div className="bg-white border-b border-slate-200 sticky top-[57px] z-10">
        <div className="max-w-md mx-auto grid grid-cols-2 text-center text-xs font-bold">
          <button
            onClick={() => setOwnerTab('bookings')}
            className={`py-3 border-b-2 transition ${
              ownerTab === 'bookings' ? 'border-slate-900 text-slate-900' : 'border-transparent text-gray-400'
            }`}
          >
            📅 실시간 예약 관리
          </button>
          <button
            onClick={() => setOwnerTab('shop')}
            className={`py-3 border-b-2 transition ${
              ownerTab === 'shop' ? 'border-slate-900 text-slate-900' : 'border-transparent text-gray-400'
            }`}
          >
            🏪 내 매장 홍보 등록
          </button>
        </div>
      </div>

      <main className="max-w-md mx-auto p-4 space-y-5">
        {ownerTab === 'bookings' ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <p className="text-xs text-gray-400">접수된 예약</p>
                <p className="text-xl font-bold text-slate-800 mt-1">{displayedBookings.length}건</p>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <p className="text-xs text-gray-400">승인 완료</p>
                <p className="text-xl font-bold text-emerald-600 mt-1">
                  {displayedBookings.filter((b) => b.status === '승인됨').length}건
                </p>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm">예약 리스트</h3>
              <label className="flex items-center space-x-1.5 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyMyShopBookings}
                  onChange={(e) => setOnlyMyShopBookings(e.target.checked)}
                  className="rounded text-slate-800"
                />
                <span>내 매장 예약만 보기</span>
              </label>
            </div>

            {displayedBookings.length === 0 ? (
              <p className="text-xs text-gray-400 bg-white p-6 rounded-xl text-center">
                표시할 예약 내역이 없습니다.
              </p>
            ) : (
              <div className="space-y-3">
                {displayedBookings.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-2"
                  >
                    <div className="flex justify-between items-center">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          item.status === '승인됨'
                            ? 'bg-emerald-100 text-emerald-700'
                            : item.status === '거절됨'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-orange-100 text-orange-600'
                        }`}
                      >
                        {item.status}
                      </span>
                      <span className="text-xs font-bold text-slate-600">{item.time}</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">{item.customer} 보호자님</h4>
                      <p className="text-xs text-slate-700 font-medium mt-0.5">반려견: {item.pet}</p>
                      <p className="text-xs text-orange-600 font-medium mt-0.5">메뉴: {item.service || '기본 미용'}</p>
                      {item.petNote && item.petNote !== '특이사항 없음' && (
                        <p className="text-xs text-rose-500 mt-0.5">⚠️ 아이 특이사항: {item.petNote}</p>
                      )}
                      {item.requestNote && item.requestNote !== '없음' && (
                        <p className="text-xs text-gray-500 mt-0.5">💬 요청: {item.requestNote}</p>
                      )}
                      <p className="text-[11px] text-gray-400 mt-1">요청 샵: {item.shop}</p>
                    </div>
                    <div className="flex space-x-2 pt-2 border-t border-gray-100">
                      <button
                        onClick={() => updateStatus(item.id, '승인됨')}
                        className="flex-1 bg-emerald-500 text-white text-xs py-2 rounded-lg font-medium hover:bg-emerald-600"
                      >
                        예약 승인
                      </button>
                      <button
                        onClick={() => updateStatus(item.id, '거절됨')}
                        className="flex-1 bg-rose-500 text-white text-xs py-2 rounded-lg font-medium hover:bg-rose-600"
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
          /* 사장님 매장 등록 폼 */
          <form onSubmit={handleRegisterShop} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <h3 className="font-bold text-slate-800 text-sm">🏪 보호자 앱에 내 미용실 등록하기</h3>
            <p className="text-xs text-gray-400">
              등록하면 보호자 계정의 [미용실 찾기] 목록 최상단에 즉시 노출됩니다.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">매장명</label>
              <input
                type="text"
                value={userProfile.extraInfo}
                disabled
                className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">시/도</label>
                <select
                  value={shopRegion}
                  onChange={(e) => setShopRegion(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm"
                >
                  <option value="서울">서울</option>
                  <option value="인천">인천</option>
                  <option value="경기">경기</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">구/동네</label>
                <input
                  type="text"
                  placeholder="예: 남동구 구월동"
                  value={shopDistrict}
                  onChange={(e) => setShopDistrict(e.target.value)}
                  required
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">기본 가격 안내</label>
              <input
                type="text"
                placeholder="예: 45,000원~"
                value={shopPrice}
                onChange={(e) => setShopPrice(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">매장 한 줄 소개 / 강점</label>
              <input
                type="text"
                placeholder="예: 가위컷 전문 · 노령견 케어 · 100% 오픈형"
                value={shopDesc}
                onChange={(e) => setShopDesc(e.target.value)}
                required
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl shadow-sm hover:bg-slate-800 text-sm"
            >
              매장 정보 등록 및 노출하기
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
