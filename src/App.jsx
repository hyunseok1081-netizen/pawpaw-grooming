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
  collection,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';

export default function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // 인증 폼 상태
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('user'); // 'user' | 'owner'
  const [extraInfo, setExtraInfo] = useState('');

  // 실시간 예약 목록 상태
  const [bookings, setBookings] = useState([]);

  // 검색 및 필터 상태 (이용자용)
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('전체');

  // 가상의 제휴 미용실 풀 (추후 사장님 등록 기능과 연동 가능)
  const [shops] = useState([
    { id: 1, name: '포포 멍뭉이 미용실', region: '인천', distance: '1.2km', desc: '스파/가위컷 전문', tag: '스파' },
    { id: 2, name: '예쁜 댕댕이 샵', region: '서울', distance: '2.5km', desc: '오픈형 통유리 미용실', tag: '오픈형' },
    { id: 3, name: '힐링 반려동물 케어', region: '인천', distance: '3.0km', desc: '노령견/특수견 케어 전문', tag: '노령견' },
    { id: 4, name: '강남 프리미엄 펫살롱', region: '서울', distance: '4.1km', desc: '1:1 맞춤형 프리미엄 스타일링', tag: '프리미엄' },
  ]);

  // 1. 로그인 상태 감지 및 프로필 로드
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const docRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserProfile(docSnap.data());
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. 실시간 예약 데이터 구독 (Firestore)
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setBookings(list);
    });
    return () => unsubscribe();
  }, [user]);

  // 3. 회원가입 / 로그인 처리
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
          extraInfo: extraInfo || (role === 'user' ? '반려견 미등록' : '포포 제휴 미용실'),
          createdAt: serverTimestamp(),
        };
        await setDoc(doc(db, 'users', res.user.uid), profileData);
        setUserProfile(profileData);
        alert('회원가입이 완료되었습니다!');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      alert('오류가 발생했습니다: ' + err.message);
    }
  };

  // 4. 로그아웃
  const handleLogout = async () => {
    await signOut(auth);
  };

  // 5. 새로운 예약 신청 (보호자용)
  const handleNewBooking = async (shopName) => {
    try {
      await addDoc(collection(db, 'bookings'), {
        shop: shopName,
        customerId: user.uid,
        customer: userProfile?.name || '보호자',
        pet: userProfile?.extraInfo || '반려견',
        time: '내일 오후 2:00',
        status: '대기 중',
        createdAt: serverTimestamp(),
      });
      alert(`"${shopName}"에 예약 신청이 완료되었습니다!`);
    } catch (err) {
      alert('예약 저장 실패: ' + err.message);
    }
  };

  // 6. 예약 상태 변경 (사장님용)
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

  // [화면 A] 로그인/회원가입
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
                      ? '반려견 이름/견종 (예: 초코 / 푸들)'
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

  // [화면 B] 이용자(보호자) 홈 화면 (지역 검색 및 필터 강화)
  if (userProfile.role === 'user') {
    const myBookings = bookings.filter((b) => b.customerId === user.uid);

    // 검색어 및 지역 필터링 로직
    const filteredShops = shops.filter((shop) => {
      const matchesRegion = selectedRegion === '전체' || shop.region === selectedRegion;
      const matchesSearch = shop.name.toLowerCase().includes(searchTerm.toLowerCase()) || shop.desc.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesRegion && matchesSearch;
    });

    return (
      <div className="min-h-screen bg-gray-50 pb-10">
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

        <main className="max-w-md mx-auto p-4 space-y-6">
          <div className="bg-orange-500 text-white rounded-2xl p-5 shadow-sm">
            <h2 className="text-lg font-bold">우리 아이 미용 예약하기</h2>
            <p className="text-xs opacity-90 mt-1">지역별 전문 미용실을 검색하고 간편하게 예약하세요!</p>
          </div>

          {/* 검색 및 필터 영역 */}
          <div className="space-y-3">
            <input
              type="text"
              placeholder="미용실 이름 또는 특징 검색 (예: 스파, 가위컷)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm shadow-sm focus:outline-none focus:border-orange-500"
            />

            {/* 지역 선택 탭 */}
            <div className="flex space-x-2">
              {['전체', '서울', '인천'].map((region) => (
                <button
                  key={region}
                  onClick={() => setSelectedRegion(region)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
                    selectedRegion === region
                      ? 'bg-slate-800 text-white'
                      : 'bg-white text-gray-600 border border-gray-200'
                  }`}
                >
                  {region} 지역
                </button>
              ))}
            </div>
          </div>

          {/* 숍 리스트 */}
          <div>
            <h3 className="font-bold text-gray-800 mb-3 text-sm">
              🔍 검색된 미용실 ({filteredShops.length}개)
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
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-bold">
                          {shop.region}
                        </span>
                        <h4 className="font-bold text-gray-800 text-sm">{shop.name}</h4>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {shop.desc} · {shop.distance}
                      </p>
                    </div>
                    <button
                      onClick={() => handleNewBooking(shop.name)}
                      className="bg-orange-500 text-white text-xs px-3 py-2 rounded-lg font-medium shadow-sm hover:bg-orange-600 transition"
                    >
                      예약하기
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 내 예약 현황 */}
          <div>
            <h3 className="font-bold text-gray-800 mb-3 text-sm">📋 내 예약 신청 내역 ({myBookings.length}건)</h3>
            {myBookings.length === 0 ? (
              <p className="text-xs text-gray-400 bg-white p-4 rounded-xl text-center">
                아직 신청한 예약이 없습니다.
              </p>
            ) : (
              <div className="space-y-2">
                {myBookings.map((b) => (
                  <div
                    key={b.id}
                    className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center"
                  >
                    <div>
                      <h4 className="font-bold text-gray-800 text-sm">{b.shop}</h4>
                      <p className="text-xs text-gray-400">{b.time}</p>
                    </div>
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
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  // [화면 C] 사장님 대시보드 화면
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

      <main className="max-w-md mx-auto p-4 space-y-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <p className="text-xs text-gray-400">전체 접수 예약</p>
            <p className="text-xl font-bold text-slate-800 mt-1">{bookings.length}건</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <p className="text-xs text-gray-400">승인 완료</p>
            <p className="text-xl font-bold text-emerald-600 mt-1">
              {bookings.filter((b) => b.status === '승인됨').length}건
            </p>
          </div>
        </div>

        <div>
          <h3 className="font-bold text-slate-800 mb-3 text-sm">📅 실시간 예약 관리</h3>
          {bookings.length === 0 ? (
            <p className="text-xs text-gray-400 bg-white p-4 rounded-xl text-center">
              접수된 예약이 없습니다.
            </p>
          ) : (
            <div className="space-y-3">
              {bookings.map((item) => (
                <div
                  key={item.id}
                  className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-2"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-orange-100 text-orange-600">
                      {item.status}
                    </span>
                    <span className="text-xs text-gray-400">{item.time}</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">{item.customer} 보호자님</h4>
                    <p className="text-xs text-gray-500">반려견: {item.pet}</p>
                    <p className="text-xs text-gray-400 mt-1">요청 샵: {item.shop}</p>
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
        </div>
      </main>
    </div>
  );
}
