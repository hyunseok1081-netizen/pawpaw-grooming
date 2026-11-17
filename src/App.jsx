import React, { useState } from 'react';

export default function App() {
  // 현재 선택된 모드 ('select': 역할 선택, 'user': 이용자 화면, 'owner': 사장님 화면)
  const [currentMode, setCurrentMode] = useState('select');

  // 가상 예약 데이터 (이용자가 예약하면 사장님 화면에 반영됨)
  const [bookings, setBookings] = useState([
    { id: 1, shop: '포포 멍뭉이 미용실', customer: '김철수', pet: '초코 (푸들)', time: '오늘 오후 2:00', status: '대기 중' },
    { id: 2, shop: '예쁜 댕댕이 샵', customer: '이영희', pet: '보리 (말티즈)', time: '내일 오전 11:00', status: '승인됨' },
  ]);

  // 새로운 예약 신청 함수 (이용자용)
  const handleNewBooking = (shopName) => {
    const newReq = {
      id: Date.now(),
      shop: shopName,
      customer: '진현석 (테스트 유저)',
      pet: '사랑이 (포메라니안)',
      time: '내일 오후 3:00',
      status: '대기 중',
    };
    setBookings([newReq, ...bookings]);
    alert(`"${shopName}"에 미용 예약이 신청되었습니다! 사장님 화면에서 확인해 보세요.`);
  };

  // 예약 상태 변경 함수 (사장님용)
  const updateStatus = (id, newStatus) => {
    setBookings(bookings.map(b => b.id === id ? { ...b, status: newStatus } : b));
  };

  // 1. 역할 선택 (로그인/모드 분기) 화면
  if (currentMode === 'select') {
    return (
      <div className="min-h-screen bg-orange-50 flex flex-col justify-center items-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <span className="text-4xl mb-3 block">🐾</span>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">포포그루밍 (PawPaw Grooming)</h1>
          <p className="text-gray-500 mb-8 text-sm">반려견 미용 예약 & 매칭 플랫폼</p>
          
          <div className="space-y-4">
            <button
              onClick={() => setCurrentMode('user')}
              className="w-full bg-orange-500 text-white font-semibold py-3 px-4 rounded-xl shadow-md hover:bg-orange-600 transition"
            >
              🐶 반려견 보호자 (이용자 모드)로 시작하기
            </button>
            <button
              onClick={() => setCurrentMode('owner')}
              className="w-full bg-slate-800 text-white font-semibold py-3 px-4 rounded-xl shadow-md hover:bg-slate-900 transition"
            >
              ✂️ 애견 미용사 (사장님 모드)로 시작하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. 이용자 홈 화면
  if (currentMode === 'user') {
    return (
      <div className="min-h-screen bg-gray-50 pb-10">
        {/* 상단바 */}
        <header className="bg-white shadow-sm p-4 flex justify-between items-center sticky top-0 z-10">
          <div className="flex items-center space-x-2">
            <span className="text-xl">🐾</span>
            <span className="font-bold text-gray-800">포포그루밍 (보호자용)</span>
          </div>
          <button
            onClick={() => setCurrentMode('select')}
            className="text-xs bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg font-medium"
          >
            모드 변경
          </button>
        </header>

        {/* 메인 콘텐츠 */}
        <main className="max-w-md mx-auto p-4 space-y-6">
          {/* 환영 배너 */}
          <div className="bg-orange-500 text-white rounded-2xl p-5 shadow-sm">
            <h2 className="text-lg font-bold">우리 아이 미용 예약할 때</h2>
            <p className="text-xs opacity-90 mt-1">가장 가까운 전문 미용실을 찾아보세요!</p>
          </div>

          {/* 숍 리스트 */}
          <div>
            <h3 className="font-bold text-gray-800 mb-3 text-sm">🔍 내 주변 추천 미용실</h3>
            <div className="space-y-3">
              {[
                { name: '포포 멍뭉이 미용실', distance: '1.2km', price: '스파/가위컷 전문' },
                { name: '예쁜 댕댕이 샵', distance: '2.5km', price: '오픈형 통유리 미용실' },
                { name: '힐링 반려동물 케어', distance: '3.0km', price: '노령견/특수견 케어 전문' },
              ].map((shop, idx) => (
                <div key={idx} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-gray-800 text-sm">{shop.name}</h4>
                    <p className="text-xs text-gray-400 mt-0.5">{shop.price} · {shop.distance}</p>
                  </div>
                  <button
                    onClick={() => handleNewBooking(shop.name)}
                    className="bg-orange-500 text-white text-xs px-3 py-2 rounded-lg font-medium shadow-sm hover:bg-orange-600"
                  >
                    예약하기
                  </button>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 3. 사장님(그로머) 대시보드 화면
  if (currentMode === 'owner') {
    return (
      <div className="min-h-screen bg-slate-100 pb-10">
        {/* 상단바 */}
        <header className="bg-slate-900 text-white p-4 flex justify-between items-center sticky top-0 z-10">
          <div className="flex items-center space-x-2">
            <span className="text-xl">✂️</span>
            <span className="font-bold">포포그루밍 (사장님 대시보드)</span>
          </div>
          <button
            onClick={() => setCurrentMode('select')}
            className="text-xs bg-slate-700 text-white px-3 py-1.5 rounded-lg font-medium"
          >
            모드 변경
          </button>
        </header>

        {/* 메인 대시보드 */}
        <main className="max-w-md mx-auto p-4 space-y-6">
          {/* 요약 카드 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              <p className="text-xs text-gray-400">오늘 들어온 예약</p>
              <p className="text-xl font-bold text-slate-800 mt-1">3건</p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              <p className="text-xs text-gray-400">정산 예정 금액</p>
              <p className="text-xl font-bold text-orange-500 mt-1">150,000원</p>
            </div>
          </div>

          {/* 예약 관리 리스트 */}
          <div>
            <h3 className="font-bold text-slate-800 mb-3 text-sm">📅 실시간 예약 관리</h3>
            <div className="space-y-3">
              {bookings.map((item) => (
                <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-2">
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
          </div>
        </main>
      </div>
    );
  }
}
