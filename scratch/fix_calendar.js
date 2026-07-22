const fs = require('fs');

let code = fs.readFileSync('app/components/WeeklyShiftCalendar.tsx', 'utf-8');

// 1. Fix displayToDbTime
const displayToDbTimeOld = `const displayToDbTime = (t: string): string => {
  const [h, m] = t.split(':').map(Number)
  const actualH = h >= 24 ? h - 24 : h
  return \`\${String(actualH).padStart(2, '0')}:\${String(m).padStart(2, '0')}:00\`
}`;
const displayToDbTimeNew = `const displayToDbTime = (t: string): string => {
  const [h, m] = t.split(':').map(Number)
  // DBのtime型はPostgreSQLでは24:00までが公式仕様ですが、文字列として24:00以降も保存可能
  return \`\${String(h).padStart(2, '0')}:\${String(m).padStart(2, '0')}:00\`
}`;
code = code.replace(displayToDbTimeOld, displayToDbTimeNew);

// 2. Fix openModal
const openModalOld = `    if (shift) {
      setEditingShift(shift)
      setStartTime(shift.start_time.slice(0, 5))
      setEndTime(dbTimeToDisplay(shift.end_time, shift.start_time))
      setRoomId(shift.room_id || '')
    } else {`;
const openModalNew = `    if (shift) {
      setEditingShift(shift)
      
      const st = shift.start_time.slice(0, 5)
      const stH = Number(st.slice(0, 2))
      const adjustedSt = stH < 6 ? \`\${String(stH + 24).padStart(2, '0')}\${st.slice(2)}\` : st
      
      setStartTime(adjustedSt)
      setEndTime(dbTimeToDisplay(shift.end_time, shift.start_time))
      setRoomId(shift.room_id || '')
    } else {`;
code = code.replace(openModalOld, openModalNew);

// 3. Fix rendering
const renderOld = `<div>{shift.start_time.slice(0, 5)} - {dbTimeToDisplay(shift.end_time, shift.start_time)}</div>`;
const renderNew = `<div>{Number(shift.start_time.slice(0, 2)) < 6 ? \`\${Number(shift.start_time.slice(0, 2)) + 24}\${shift.start_time.slice(2, 5)}\` : shift.start_time.slice(0, 5)} - {dbTimeToDisplay(shift.end_time, shift.start_time)}</div>`;
code = code.replace(renderOld, renderNew);

fs.writeFileSync('app/components/WeeklyShiftCalendar.tsx', code);
console.log('Fixed WeeklyShiftCalendar.tsx');
