export interface DispatchInfo {
  dispatch_type: 'store' | 'hotel' | 'home';
  hotel_room_number?: string;
  home_address?: string;
  parking_available?: 'yes' | 'no';
  pickup_staff?: 'none' | 'hanamoto' | 'fukunaga' | 'takahashi' | 'reject';
}

export function parseDispatchFromNotes(notes: string | null | undefined): DispatchInfo {
  const result: DispatchInfo = { dispatch_type: 'store' };
  if (!notes) return result;

  // Search for home dispatch details
  const homeMatch = notes.match(/【派遣先】自宅派遣:\s*(.*?)\s*\(駐車場:\s*(あり|なし),\s*送迎:\s*(不要|花本|福永|高橋|お断り)\)/);
  if (homeMatch) {
    result.dispatch_type = 'home';
    result.home_address = homeMatch[1];
    result.parking_available = homeMatch[2] === 'あり' ? 'yes' : 'no';
    const staffMap: Record<string, DispatchInfo['pickup_staff']> = {
      '不要': 'none',
      '花本': 'hanamoto',
      '福永': 'fukunaga',
      '高橋': 'takahashi',
      'お断り': 'reject'
    };
    result.pickup_staff = staffMap[homeMatch[3]] || 'none';
    return result;
  }

  // Search for hotel room number
  const hotelMatch = notes.match(/【派遣先】ホテル部屋番号:\s*([^\n\r]*)/);
  if (hotelMatch) {
    result.dispatch_type = 'hotel';
    result.hotel_room_number = hotelMatch[1].trim();
    return result;
  }

  return result;
}

export function updateNotesWithDispatch(
  currentNotes: string | null | undefined,
  info: DispatchInfo
): string {
  let cleanNotes = currentNotes || '';
  
  // Remove existing dispatch patterns
  cleanNotes = cleanNotes.replace(/【派遣先】自宅派遣:.*?(?:\r?\n|$)/g, '');
  cleanNotes = cleanNotes.replace(/【派遣先】ホテル部屋番号:.*?(?:\r?\n|$)/g, '');
  
  cleanNotes = cleanNotes.trim();

  let dispatchLine = '';
  if (info.dispatch_type === 'home') {
    const parkingText = info.parking_available === 'yes' ? 'あり' : 'なし';
    const staffMap: Record<string, string> = {
      'none': '不要',
      'hanamoto': '花本',
      'fukunaga': '福永',
      'takahashi': '高橋',
      'reject': 'お断り'
    };
    const staffText = staffMap[info.pickup_staff || 'none'] || '不要';
    dispatchLine = `【派遣先】自宅派遣: ${info.home_address || ''} (駐車場: ${parkingText}, 送迎: ${staffText})`;
  } else if (info.dispatch_type === 'hotel') {
    dispatchLine = `【派遣先】ホテル部屋番号: ${info.hotel_room_number || ''}`;
  }

  if (dispatchLine) {
    return cleanNotes ? `${dispatchLine}\n${cleanNotes}` : dispatchLine;
  }
  return cleanNotes;
}
